/**
 * 네이버 스포츠의 공개 JSON — KBO 와 K리그.
 *
 * ESPN 에는 두 리그가 아예 없다(리그 주소부터 404). 네이버는 키 없이 일정·순위표·뉴스를 주고,
 * 포스트시즌 경기에는 시리즈 전적까지 붙여 준다. **두 리그가 같은 모양**이라 어댑터가 하나다.
 *
 * 없는 것: 로스터. 선수 주소는 리그 전체 기록 순위표라(팀으로 안 걸러진다) 로스터 대신 쓸 수
 * 없다. 그래서 로스터는 빈 것으로 돌려주고, 화면은 그 탭을 안 그린다.
 *
 * **시각은 구역 표시 없이 한국 벽시계로 온다**("2026-10-17T14:00:00"). 한국은 서머타임이
 * 없으니 +09:00 을 붙이면 그대로 진짜 시각이다.
 */

import { unstable_cache } from "next/cache";
import { orderStandings, ordinal } from "./split";
import type { NaverSource } from "./teams";
import type {
  Article,
  BracketRound,
  BracketTeam,
  Fetched,
  Game,
  GameStatus,
  Matchup,
  StandingsGroup,
  StandingsRow,
} from "./types";

const API = "https://api-gw.sports.naver.com";

const TTL = { live: 60, schedule: 900, news: 1_800, standings: 3_600 } as const;

async function read<T>(url: string, revalidate: number | false): Promise<Fetched<T>> {
  try {
    const res = await fetch(url, {
      ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; result?: T };
    return json.success && json.result ? json.result : null;
  } catch {
    return null;
  }
}

/* ────────────────────────────── 생김새 ────────────────────────────── */

type NaverGame = {
  gameId?: string;
  gameDateTime?: string;
  timeTbd?: boolean;
  stadium?: string | null;
  homeTeamCode?: string;
  homeTeamName?: string;
  homeTeamScore?: number;
  homeTeamEmblemUrl?: string | null;
  awayTeamCode?: string;
  awayTeamName?: string;
  awayTeamScore?: number;
  awayTeamEmblemUrl?: string | null;
  /** "BEFORE" | "STARTED" | "RESULT". 우천 취소는 BEFORE 에 `cancel` 이 붙어 온다. */
  statusCode?: string;
  statusInfo?: string | null;
  cancel?: boolean;
  suspended?: boolean;
  neutralGround?: boolean;
  /** "kbo_r"(정규시즌) · "kbo_ps_wd" · "kbo_ps_sp" · "kbo_ps_po" · "kbo_ps_ks". K리그는 빈 값. */
  roundCode?: string | null;
  /** 이 경기까지(끝났으면 포함) 시리즈 이긴 수 — 홈/원정 기준. 와일드카드는 4위의 1승 이점이 들어 있다. */
  seriesOutcome?: { home?: number; away?: number } | null;
  seriesGameNo?: number;
  broadChannel?: string | null;
};

/** 한국 벽시계 → 진짜 시각. */
function kst(local: string | undefined): string | null {
  return local && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local) ? `${local.slice(0, 19)}+09:00` : null;
}

/** 지금 한국에서 몇 년인가. 1월 1일 새벽의 태평양 시계로 세면 한 해 늦는다. */
function kstYear(): number {
  return new Date(Date.now() + 9 * 3_600_000).getUTCFullYear();
}

function statusOf(g: NaverGame): GameStatus {
  if (g.suspended) return "postponed";
  if (g.statusCode === "STARTED") return "in";
  if (g.statusCode === "RESULT") return "final";
  return "scheduled";
}

/**
 * 진행 중 한 줄을 화면 말로. "3회말" → "Bot 3rd", "전반 23'" 은 그대로 두지 않고 "1H 23'".
 * 모르는 모양은 받은 그대로다 — 틀리게 옮기느니 안 옮긴다.
 */
function liveDetail(info: string | null | undefined): string | null {
  if (!info) return null;
  const inning = info.match(/^(\d+)회(초|말)$/);
  if (inning) return `${inning[2] === "초" ? "Top" : "Bot"} ${ordinal(Number(inning[1]))}`;
  return info.replace(/^전반/, "1H").replace(/^후반/, "2H").replace(/^하프타임$/, "HT");
}

/** KBO 포스트시즌 라운드. 확인한 코드(2025-26). */
const ROUNDS: Record<string, { name: string; wins: number }> = {
  kbo_ps_wd: { name: "Wild Card", wins: 2 },
  kbo_ps_sp: { name: "Semi-Playoff", wins: 3 },
  kbo_ps_po: { name: "Playoff", wins: 3 },
  kbo_ps_ks: { name: "Korean Series", wins: 4 },
};

function toGame(g: NaverGame, src: NaverSource): Game | null {
  /*
    **우천 취소 경기는 뺀다.** 네이버는 취소된 경기를 "경기취소" 로 남겨 두고 재경기를 다른 경기로
    따로 잡는다. 남겨 두면 7월 5일 취소 경기가 10월에도 "다음 홈경기" 로 떴다 — 날짜가 지나도
    안 끝난 경기라서다. 재경기가 일정에 따로 있으니 빠지는 것은 없다.
  */
  if (!g.gameId || g.cancel) return null;
  const home = g.homeTeamCode === src.teamCode;
  if (!home && g.awayTeamCode !== src.teamCode) return null;
  const them = home
    ? { name: g.awayTeamName, logo: g.awayTeamEmblemUrl }
    : { name: g.homeTeamName, logo: g.homeTeamEmblemUrl };
  if (!them.name) return null;

  const status = statusOf(g);
  const scored = status === "in" || status === "final";
  const ourScore = scored ? ((home ? g.homeTeamScore : g.awayTeamScore) ?? null) : null;
  const theirScore = scored ? ((home ? g.awayTeamScore : g.homeTeamScore) ?? null) : null;

  let result: Game["result"] = null;
  if (status === "final" && ourScore != null && theirScore != null) {
    // 축구에서는 비긴 것을 "D". KBO 는 연장 12회 무승부가 있고 "T" 다.
    const tie = src.sport === "kfootball" ? "D" : "T";
    result = ourScore > theirScore ? "W" : ourScore < theirScore ? "L" : tie;
  }

  const round = g.roundCode ? ROUNDS[g.roundCode] : undefined;
  const note = round ? `${round.name}${g.seriesGameNo ? ` · Game ${g.seriesGameNo}` : ""}` : null;

  return {
    id: g.gameId,
    startsAt: kst(g.gameDateTime),
    /*
      시각이 안 정해진 경기는 자정으로 온다(`timeTbd` 는 늘 false). K리그 최종 라운드들이 그렇다.
      한국 리그는 자정에 시작하는 경기가 없으니 00:00 이면 아직 모르는 것이다.
    */
    timeTbd: g.timeTbd === true || g.gameDateTime?.slice(11, 16) === "00:00",
    opponent: { name: them.name, shortName: null, logo: them.logo ?? null },
    isHome: home,
    neutralSite: g.neutralGround === true,
    status,
    ourScore,
    theirScore,
    result,
    shootout: null,
    venue: g.stadium || null,
    broadcast: g.broadChannel || null,
    note,
    statusDetail: status === "in" ? liveDetail(g.statusInfo) : null,
    links: [{ label: "Naver", url: `https://m.sports.naver.com/game/${g.gameId}` }],
  };
}

/* ────────────────────────────── 일정 ────────────────────────────── */

function gamesUrl(src: NaverSource, from: string, to: string): string {
  // `schedule` 칸에 구장·라운드·시리즈가, `baseball` 칸에 중계 채널이 있다. `all` 은 네 배 무겁다.
  const fields = src.sport === "kbaseball" ? "basic,schedule,baseball" : "basic,schedule";
  return `${API}/schedule/games?fields=${fields}&upperCategoryId=${src.sport}&categoryId=${src.league}&fromDate=${from}&toDate=${to}&size=1000`;
}

type GamesPage = { games?: NaverGame[]; gameTotalCount?: number };

/**
 * 리그 한 해 전체를 받아서 우리 경기만 남긴다.
 *
 * **팀으로 거르는 칸이 없다**(`teamCode=` 를 붙여도 리그 전체가 온다 — 2026-10 확인). KBO 한 해가
 * 860경기·880KB 라 받은 것이 아니라 **추려 낸 것을 캐시한다**(이유는 espn.ts 의 `readFresh`).
 *
 * **한 번에 1000경기까지다.** 1001 을 달라고 하면 말없이 10경기만 준다(2026-10 확인). KBO 한 해가
 * 거기 가까워서 반년씩 두 번 읽는다. 덜 받았으면(`gameTotalCount` 보다 적으면) 못 받은 것이다 —
 * 반쪽 일정은 틀린 일정이다.
 *
 * 비시즌 초입(1월)에 새 해 일정이 비어 있으면 지난해를 대신 보여 주고 지난 것이라고 적는다.
 */
async function fetchSchedule(src: NaverSource): Promise<Fetched<{ games: Game[]; raw: NaverGame[]; year: number; isPastSeason: boolean }>> {
  const load = async (year: number) => {
    const pages = await Promise.all([
      read<GamesPage>(gamesUrl(src, `${year}-01-01`, `${year}-06-30`), false),
      read<GamesPage>(gamesUrl(src, `${year}-07-01`, `${year}-12-31`), false),
    ]);
    if (pages.some((p) => !p || (typeof p.gameTotalCount === "number" && (p.games ?? []).length < p.gameTotalCount))) {
      return null;
    }
    const all = pages.flatMap((p) => p?.games ?? []);
    // 포스트시즌 브래킷은 남의 경기도 쓴다. 그것만 따로 남긴다(KBO 가을 열 몇 경기).
    const post = all.filter((g) => !g.cancel && g.roundCode && ROUNDS[g.roundCode]);
    const games = all.map((g) => toGame(g, src)).filter((g): g is Game => g !== null);
    return { games, raw: post, year };
  };

  const year = kstYear();
  const now = await load(year);
  if (!now) return null;
  if (now.games.length > 0) return { ...now, isPastSeason: false };
  const prev = await load(year - 1);
  if (!prev || prev.games.length === 0) return { ...now, isPastSeason: false };
  return { ...prev, isPastSeason: true };
}

const cachedSchedule = unstable_cache(fetchSchedule, ["naver-schedule"], { revalidate: TTL.schedule });

export type NaverSchedule = { games: Game[]; seasonYear: number; isPastSeason: boolean };

export async function naverSchedule(src: NaverSource): Promise<Fetched<NaverSchedule>> {
  const s = await cachedSchedule(src);
  return s && { games: s.games, seasonYear: s.year, isPastSeason: s.isPastSeason };
}

/**
 * 오늘(한국 날짜) 하는 우리 경기. 일정은 15분 캐시라 점수가 늦는다 — 이건 1분이다.
 * 어제 날짜도 같이 본다. 한국 밤 경기가 끝나기 전에 자정을 넘기기도 한다.
 */
export async function naverLive(src: NaverSource): Promise<Fetched<Game | null>> {
  const day = (offset: number) => new Date(Date.now() + 9 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
  const page = await read<GamesPage>(gamesUrl(src, day(-1), day(0)), TTL.live);
  if (!page) return null;
  const games = (page.games ?? []).map((g) => toGame(g, src)).filter((g): g is Game => g !== null);
  return games.find((g) => g.status === "in") ?? null;
}

/* ────────────────────────────── 순위표 ────────────────────────────── */

type BaseballRow = {
  teamId?: string;
  teamName?: string;
  teamImageUrl?: string;
  ranking?: number;
  winGameCount?: number;
  loseGameCount?: number;
  drawnGameCount?: number;
  wra?: number;
  gameBehind?: number;
  /** "10승" · "3패" · "1무". */
  continuousGameResult?: string;
};

type FootballRow = {
  teamId?: string;
  teamName?: string;
  rank?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  points?: number;
  goalsDifference?: number;
};

function streakOf(raw: string | undefined): string | null {
  const m = raw?.match(/^(\d+)(승|패|무)$/);
  return m ? `${{ 승: "W", 패: "L", 무: "T" }[m[2]]}${m[1]}` : null;
}

/**
 * 리그 순위표. 네이버가 매긴 순위(`ranking`·`rank`)를 시드 칸에 넣어 그 순서로 세운다 —
 * 리그가 직접 매긴 순서이고, 동률 처리까지 들어 있다.
 *
 * 비시즌 초입에 새 해 표가 비어 있으면 일정과 같은 해(`year`)를 읽는다.
 */
export async function naverStandings(src: NaverSource, year: number): Promise<Fetched<StandingsGroup[]>> {
  const res = await read<{ seasonTeamStats?: (BaseballRow & FootballRow)[] }>(
    `${API}/statistics/categories/${src.league}/seasons/${year}/teams`,
    TTL.standings,
  );
  if (!res) return null;
  const list = res.seasonTeamStats ?? [];
  if (list.length === 0) return [];

  const soccer = src.sport === "kfootball";
  const rows: StandingsRow[] = list.map((r) => {
    const base = {
      teamId: r.teamId ?? null,
      name: r.teamName ?? "",
      abbreviation: null,
      // 축구 순위표에는 엠블럼 주소가 안 온다. 일정에 오는 것과 같은 자리라 코드로 짓는다.
      logo: soccer
        ? r.teamId
          ? `https://sports-phinf.pstatic.net/team/kleague/default/${r.teamId}.png`
          : null
        : (r.teamImageUrl?.replace(/\?.*$/, "") ?? null),
      isUs: r.teamId === src.teamCode,
      otLosses: null,
      conferenceRecord: null,
    };
    if (soccer) {
      const gd = r.goalsDifference;
      return {
        ...base,
        wins: r.wins ?? null,
        losses: r.losses ?? null,
        ties: r.draws ?? null,
        winPercent: null,
        gamesBehind: null,
        streak: null,
        points: r.points ?? null,
        playoffSeed: r.rank ?? null,
        differential: typeof gd === "number" ? (gd > 0 ? `+${gd}` : String(gd)) : null,
      } satisfies StandingsRow;
    }
    return {
      ...base,
      wins: r.winGameCount ?? null,
      losses: r.loseGameCount ?? null,
      ties: r.drawnGameCount ?? null,
      // KBO 승률은 무승부를 빼고 센다(승 / (승+패)). 네이버의 `wra` 가 그 값이다.
      winPercent: typeof r.wra === "number" ? r.wra.toFixed(3).replace(/^0/, "") : null,
      gamesBehind: typeof r.gameBehind === "number" ? (r.gameBehind === 0 ? "-" : String(r.gameBehind)) : null,
      streak: streakOf(r.continuousGameResult),
      points: null,
      playoffSeed: r.ranking ?? null,
      differential: null,
    } satisfies StandingsRow;
  });

  const { rows: sorted, ordered } = orderStandings(rows);
  return [{ name: src.leagueName, shortName: src.leagueName, parent: null, rows: sorted, ordered, soccer }];
}

/* ────────────────────────────── 포스트시즌 ────────────────────────────── */

/**
 * KBO 포스트시즌 — **사다리**다.
 *
 * 5위와 4위가 와일드카드(4위가 1승을 안고 시작, 2승이면 끝)를 치르고, 이긴 팀이 3위와 준플레이오프
 * (5전 3선승), 거기서 이긴 팀이 2위와 플레이오프(5전 3선승), 마지막에 1위와 한국시리즈(7전 4선승).
 * 나무가 아니라서 화면은 라운드 목록으로 그린다(`layoutBracket` 이 매치업 하나짜리 라운드만
 * 있으면 사다리로 본다).
 *
 * 아직 안 열린 라운드도 **기다리는 팀은 안다** — 플레이오프 위 칸은 2위, 한국시리즈 위 칸은 1위다.
 * 그 자리만 채우고 아래 칸은 비워 둔다(`null`). 포스트시즌 경기가 하나도 없으면 `[]` 다.
 *
 * K리그는 아직 안 그린다 — `[]`.
 */
export async function naverPostseason(src: NaverSource): Promise<Fetched<BracketRound[]>> {
  if (src.sport !== "kbaseball") return [];
  const sched = await cachedSchedule(src);
  if (!sched) return null;
  if (sched.raw.length === 0) return [];
  const table = await naverStandings(src, sched.year);
  const rank = new Map((table?.[0]?.rows ?? []).map((r) => [r.teamId, r.playoffSeed]));
  const byRank = new Map((table?.[0]?.rows ?? []).map((r) => [r.playoffSeed, r]));

  const team = (code: string | undefined, name: string | undefined, logo: string | null | undefined): BracketTeam | null =>
    code && name
      ? { id: code, name, shortName: null, logo: logo ?? null, seed: rank.get(code) ?? null, isUs: code === src.teamCode, score: null, won: false }
      : null;

  const order = Object.keys(ROUNDS);
  const rounds: BracketRound[] = [];
  let winner: BracketTeam | null = null;

  for (const [i, code] of order.entries()) {
    const how = ROUNDS[code];
    const games = sched.raw
      .filter((g) => g.roundCode === code)
      .sort((a, b) => (a.gameDateTime ?? "").localeCompare(b.gameDateTime ?? ""));
    // 기다리는 팀 — 준PO 는 3위, PO 는 2위, KS 는 1위. 와일드카드는 4위·5위가 둘 다 경기로 정해진다.
    const waiting = i === 0 ? null : byRank.get(4 - i);

    if (games.length === 0) {
      if (!waiting) continue;
      const top = team(waiting.teamId ?? undefined, waiting.name, waiting.logo);
      rounds.push({
        name: how.name,
        pre: false,
        matchups: [{
          id: code,
          group: null,
          label: null,
          teams: [top, winner ? { ...winner, score: null, won: false } : null],
          series: true,
          status: "scheduled",
          startsAt: null,
          detail: `Best of ${how.wins * 2 - 1}`,
          live: null,
          slot: null,
        }],
      });
      winner = null;
      continue;
    }

    const first = games[0];
    const a = team(first.homeTeamCode, first.homeTeamName, first.homeTeamEmblemUrl);
    const b = team(first.awayTeamCode, first.awayTeamName, first.awayTeamEmblemUrl);
    if (!a || !b) continue;
    // 시드가 높은 쪽이 위.
    const [top, bottom] = (a.seed ?? 99) <= (b.seed ?? 99) ? [a, b] : [b, a];

    const done = games.filter((g) => statusOf(g) === "final");
    const latest = done[done.length - 1];
    const live = games.find((g) => statusOf(g) === "in") ?? null;
    const next = games.find((g) => statusOf(g) === "scheduled") ?? null;

    // 이긴 수 — 끝난 마지막 경기의 시리즈 전적을 팀에 옮긴다. 홈/원정은 경기마다 바뀐다.
    const winsOf = (t: BracketTeam) => {
      const o = latest?.seriesOutcome;
      if (!latest || !o) return null;
      return (latest.homeTeamCode === t.id ? o.home : o.away) ?? null;
    };
    top.score = winsOf(top);
    bottom.score = winsOf(bottom);
    const champ = [top, bottom].find((t) => (t.score ?? 0) >= how.wins) ?? null;
    if (champ) champ.won = true;

    const scoreIn = (t: BracketTeam) =>
      live ? ((live.homeTeamCode === t.id ? live.homeTeamScore : live.awayTeamScore) ?? null) : null;

    let detail: string | null;
    if (live) detail = [live.seriesGameNo ? `Game ${live.seriesGameNo}` : null, liveDetail(live.statusInfo)].filter(Boolean).join(" · ") || null;
    else if (champ) detail = `${champ.name} win ${champ.score}-${(champ === top ? bottom : top).score}`;
    else if (top.score != null && bottom.score != null) {
      detail = top.score === bottom.score ? `Tied ${top.score}-${bottom.score}` : `${top.score > bottom.score ? top.name : bottom.name} lead ${Math.max(top.score, bottom.score)}-${Math.min(top.score, bottom.score)}`;
    } else detail = code === "kbo_ps_wd" ? `${top.name} start 1-0 up` : `Best of ${how.wins * 2 - 1}`;

    const status: GameStatus = live ? "in" : champ ? "final" : "scheduled";
    rounds.push({
      name: how.name,
      pre: false,
      matchups: [{
        id: code,
        group: null,
        label: null,
        teams: [top, bottom],
        series: true,
        status,
        startsAt: kst((live ?? (champ ? latest : (next ?? latest)))?.gameDateTime),
        detail,
        live: live ? [scoreIn(top), scoreIn(bottom)] : null,
        slot: null,
      } satisfies Matchup],
    });
    winner = champ;
  }

  return rounds;
}

/* ────────────────────────────── 뉴스 ────────────────────────────── */

/**
 * 팀 기사. **사진 한 장짜리 기사는 뺀다** — 경기 날에는 "임찬규 ‘막아낸다’[포토]" 같은 것이
 * 스무 개 중 열 개다. 제목에 [포토] 가 붙어 오니 그걸로 거른다.
 *
 * 한 번에 스무 개까지만 준다(`size` 를 키워도 20). 거르고 나면 모자라서 세 쪽을 읽는다.
 */
export async function naverNews(src: NaverSource, limit = 20): Promise<Fetched<Article[]>> {
  type Item = {
    oid?: string;
    aid?: string;
    title?: string;
    subContent?: string;
    sourceName?: string;
    thumbnail?: string;
    dateTime?: string;
  };
  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      read<{ newsList?: Item[] }>(`${API}/news/articles/${src.sport}?team=${src.teamCode}&size=20&page=${page}`, TTL.news),
    ),
  );
  if (!pages[0]) return null;
  // 쪽 사이에 새 기사가 들어오면 앞 쪽 것이 뒤로 밀려 겹친다.
  const unique = [...new Map(pages.flatMap((p) => p?.newsList ?? []).map((a) => [`${a.oid}-${a.aid}`, a])).values()];
  return unique
    .filter((a) => a.oid && a.aid && a.title && !/\[포토|포토S?\]/.test(a.title))
    .slice(0, limit)
    .map((a) => ({
      id: `${a.oid}-${a.aid}`,
      headline: a.title as string,
      description: a.subContent ?? null,
      publishedAt: kst(a.dateTime),
      url: `https://m.sports.naver.com/${src.sport}/article/${a.oid}/${a.aid}`,
      image: a.thumbnail ?? null,
      kind: "Story",
      byline: a.sourceName ?? null,
    }));
}
