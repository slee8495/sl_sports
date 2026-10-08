/**
 * ESPN 의 공개 JSON.
 *
 * 키가 없고 그냥 읽으면 된다. **모델을 안 태우니 비용이 0 이고, 지어낼 자리도 없다** —
 * 예전 구조(Claude 에게 웹 검색을 시켜 DB 에 적어 두던 것)를 통째로 대신하는 자리다.
 *
 * 캐시는 Next 의 데이터 캐시에 맡긴다. 값이 얼마나 빨리 늙는지가 종류마다 달라서
 * TTL 도 따로 준다 — 로스터는 하루에 한 번 바뀌면 많이 바뀌는 것이고, 점수는 1분이면 늙는다.
 */

import { unstable_cache } from "next/cache";
import { orderBracket } from "./bracket";
import { orderStandings } from "./split";
import type { EspnSource } from "./teams";
import type {
  Article,
  BracketRound,
  BracketTeam,
  Coach,
  Fetched,
  Game,
  GameStatus,
  Matchup,
  Player,
  StandingsGroup,
  StandingsRow,
  TeamSnapshot,
} from "./types";

const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const SITE_V2 = "https://site.api.espn.com/apis/v2/sports";
const CORE = "https://sports.core.api.espn.com/v2/sports";

export const TTL = {
  live: 60,
  snapshot: 300,
  schedule: 900,
  news: 1_800,
  injuries: 1_800,
  standings: 3_600,
  roster: 21_600,
  /** 지난 날의 포스트시즌 스코어보드. 끝난 경기는 안 바뀐다. */
  pastDay: 21_600,
} as const;

/**
 * 한 번 읽는다.
 *
 * **못 읽으면 null 이다.** 빈 값으로 바꾸지 않는다 — 부른 쪽이 "경기가 없다" 와
 * "못 가져왔다" 를 구분해서 화면에 다르게 적어야 하기 때문이다.
 *
 * User-Agent 를 보내지 않는다. 브라우저 UA 를 붙이면 ESPN 이 403 을 준다(직접 확인).
 */
async function read<T>(url: string, revalidate: number): Promise<Fetched<T>> {
  try {
    const res = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * 캐시를 안 거치고 그냥 읽는다.
 *
 * **Next 의 데이터 캐시는 2MB 까지만 받는다.** MLB 의 162경기 일정은 3.7MB 라 조용히
 * 캐시를 빠져나가고(서버 로그에 한 줄 남는다), 그러면 화면을 열 때마다 3.7MB 를 새로 받는다.
 *
 * 그래서 일정만은 **받은 것을 캐시하지 않고, 추려 낸 결과를 캐시한다**(아래 `espnSchedule`).
 * 162경기를 우리 모양으로 줄이면 수십 KB 라 넉넉히 들어간다.
 */
async function readFresh<T>(url: string): Promise<Fetched<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ────────────────────────────── 생김새 ────────────────────────────── */

type EspnLogo = { href?: string; rel?: string[] };
type EspnTeamRef = {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  logos?: EspnLogo[];
  logo?: string;
};

type EspnStatus = {
  type?: { state?: string; name?: string; completed?: boolean; shortDetail?: string; detail?: string };
  displayClock?: string;
  period?: number;
};

type EspnCompetitor = {
  id?: string;
  homeAway?: string;
  winner?: boolean;
  score?: string | { value?: number; displayValue?: string };
  team?: EspnTeamRef;
  /** 토너먼트(대학)에서는 시드가 여기 온다. 프로는 99 같은 빈 값이다. */
  curatedRank?: { current?: number };
};

type EspnCompetition = {
  id?: string;
  date?: string;
  neutralSite?: boolean;
  venue?: { fullName?: string; address?: { city?: string; state?: string } };
  broadcasts?: { media?: { shortName?: string }; names?: string[] }[];
  competitors?: EspnCompetitor[];
  status?: EspnStatus;
  notes?: { headline?: string }[];
  /** "ALLSTAR" — 포스트시즌 주차에 프로볼이 끼어 온다. */
  type?: { abbreviation?: string };
  /** 플레이오프 시리즈. 단판에는 없다. */
  series?: {
    type?: string;
    summary?: string;
    completed?: boolean;
    totalCompetitions?: number;
    competitors?: { id?: string; wins?: number }[];
  };
  tickets?: { summary?: string; links?: { href?: string }[] }[];
};

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  timeValid?: boolean;
  week?: { number?: number; text?: string };
  seasonType?: { name?: string; abbreviation?: string };
  /** 3 = 포스트시즌, 5 = NBA 플레이인. */
  season?: { year?: number; type?: number };
  competitions?: EspnCompetition[];
  links?: { href?: string; text?: string; rel?: string[] }[];
  status?: EspnStatus;
};

/* ────────────────────────────── 옮기기 ────────────────────────────── */

function logoOf(t: EspnTeamRef | undefined): string | null {
  if (!t) return null;
  if (t.logo) return t.logo;
  const full = t.logos?.find((l) => l.rel?.includes("full") && !l.rel?.includes("dark"));
  return full?.href ?? t.logos?.[0]?.href ?? null;
}

/** ".667" — 앞의 0 을 떼는 것이 스포츠 표의 관례다. 한 판도 안 했으면 없는 값이다. */
function percentOf(w: number | null, l: number | null, t: number | null): string | null {
  const played = (w ?? 0) + (l ?? 0) + (t ?? 0);
  if (played === 0) return null;
  return (((w ?? 0) + (t ?? 0) / 2) / played).toFixed(3).replace(/^0/, "");
}

function scoreOf(c: EspnCompetitor | undefined): number | null {
  const raw = c?.score;
  if (raw == null) return null;
  const n = typeof raw === "string" ? Number(raw) : raw.value;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

/** ESPN 의 상태 낱말을 우리 것으로. 모르는 것은 예정으로 본다 — 없는 상태를 짓지 않는다. */
function statusOf(s: EspnStatus | undefined): GameStatus {
  const name = s?.type?.name ?? "";
  if (name.includes("POSTPONED") || name.includes("CANCELED") || name.includes("SUSPENDED")) {
    return "postponed";
  }
  const state = s?.type?.state;
  if (state === "in") return "in";
  if (state === "post") return "final";
  return "scheduled";
}

/**
 * 그 경기가 무엇인지 한 줄.
 *
 * 리그마다 뜻 있는 것이 다르다 — NFL 은 몇 주차인지가 곧 정체성이고, 대학은 볼 게임 이름이,
 * 야구·농구는 시즌 종류(프리시즌/포스트시즌)만 뜻이 있다. **정규시즌이면 아무 말도 안 한다.**
 */
function noteOf(e: EspnEvent, comp: EspnCompetition): string | null {
  const bits: string[] = [];
  const headline = comp.notes?.[0]?.headline;
  if (headline) bits.push(headline);
  if (e.week?.text) bits.push(e.week.text);
  const season = e.seasonType?.name;
  if (season && !/regular/i.test(season)) bits.push(season);
  return bits.length ? bits.join(" · ") : null;
}

/** 우리 팀 기준으로 한 경기를 읽는다. 상대가 누구인지는 우리가 어느 쪽인지를 알아야 나온다. */
function toGame(e: EspnEvent, ourTeamId: string): Game | null {
  const comp = e.competitions?.[0];
  if (!comp || !e.id) return null;

  const us = comp.competitors?.find((c) => c.team?.id === ourTeamId || c.id === ourTeamId);
  const them = comp.competitors?.find((c) => c !== us);
  if (!them?.team?.displayName) return null;

  const status = statusOf(comp.status ?? e.status);
  const done = status === "final";
  const ourScore = done ? scoreOf(us) : null;
  const theirScore = done ? scoreOf(them) : null;

  let result: Game["result"] = null;
  if (done && ourScore != null && theirScore != null) {
    result = ourScore > theirScore ? "W" : ourScore < theirScore ? "L" : "T";
  }

  const links = (e.links ?? [])
    .filter((l) => l.href && (l.rel?.includes("tickets") || l.rel?.includes("video")))
    .map((l) => ({ label: l.text ?? "Link", url: l.href as string }));

  const live = status === "in";
  const city = comp.venue?.address?.city;

  return {
    id: e.id,
    startsAt: comp.date ?? e.date ?? null,
    /*
      **시각이 안 정해진 경기가 있다.** ESPN 은 그런 경기에도 날짜를 주는데 시간은 자정으로
      채워 보낸다. 그대로 그리면 "오후 5시 킥오프" 처럼 보이지만 사실은 아직 모르는 것이다.
    */
    timeTbd: e.timeValid === false,
    opponent: {
      name: them.team.displayName,
      shortName: them.team.shortDisplayName ?? them.team.abbreviation ?? null,
      logo: logoOf(them.team),
    },
    isHome: us?.homeAway ? us.homeAway === "home" : null,
    neutralSite: comp.neutralSite === true,
    status,
    ourScore,
    theirScore,
    result,
    venue: comp.venue?.fullName ? (city ? `${comp.venue.fullName} · ${city}` : comp.venue.fullName) : null,
    broadcast: comp.broadcasts?.[0]?.media?.shortName ?? comp.broadcasts?.[0]?.names?.[0] ?? null,
    note: noteOf(e, comp),
    /*
      **진행 중일 때만 채운다.** 끝난 경기에 "4th Quarter 0:00" 이 남아 있으면 아직 하는
      중인 것처럼 보이고, 시작 전 경기의 "1st Quarter" 는 아예 거짓이다.
    */
    statusDetail: live ? (comp.status?.type?.shortDetail ?? null) : null,
    links,
  };
}

/* ────────────────────────────── 읽는 것들 ────────────────────────────── */

export async function espnSnapshot(src: EspnSource): Promise<Fetched<TeamSnapshot>> {
  const json = await read<{
    team?: {
      logos?: EspnLogo[];
      standingSummary?: string;
      record?: { items?: { type?: string; summary?: string }[] };
      franchise?: { venue?: { fullName?: string; address?: { city?: string; state?: string } } };
    };
  }>(`${SITE}/${src.path}/teams/${src.teamId}`, TTL.snapshot);

  const t = json?.team;
  if (!t) return null;

  const total = t.record?.items?.find((i) => i.type === "total") ?? t.record?.items?.[0];
  const venue = t.franchise?.venue;
  const city = [venue?.address?.city, venue?.address?.state].filter(Boolean).join(", ");

  return {
    record: total?.summary ?? null,
    standingSummary: t.standingSummary ?? null,
    logo: logoOf({ logos: t.logos }),
    venue: venue?.fullName ?? null,
    venueCity: city || null,
  };
}

export type Schedule = {
  games: Game[];
  /** ESPN 이 부르는 시즌 해 — 대학 농구의 2026-27 시즌은 2027 이다. */
  seasonYear: number | null;
  /** 이번 시즌 일정이 아직 안 올라와서 **지난 시즌을 대신 보여 주는 중**이다. */
  isPastSeason: boolean;
};

/**
 * 시즌 전체 일정.
 *
 * 지난 경기와 앞으로의 경기가 한 배열로 온다 — 화면에서 가른다.
 *
 * **비시즌에는 이번 시즌이 통째로 비어 있다.** UCSD 농구를 9월에 열면 0건이다(확인함).
 * 그때 빈 화면을 주면 앱이 고장 난 것처럼 보이므로 **지난 시즌을 대신 가져오고, 지난 것이라고
 * 화면에 적는다.** 아무것도 없는 것과 지난 시즌인 것은 다르고, 팬은 지난 시즌 결과라도 본다.
 *
 * 받은 JSON 이 아니라 **추려 낸 결과를 캐시한다** — 이유는 `readFresh` 에 적었다.
 */
async function fetchSchedule(path: string, teamId: string): Promise<Fetched<Schedule>> {
  const json = await readFresh<{ events?: EspnEvent[]; season?: { year?: number } }>(
    `${SITE}/${path}/teams/${teamId}/schedule`,
  );
  if (!json) return null;

  const toGames = (events: EspnEvent[]) =>
    events.map((e) => toGame(e, teamId)).filter((g): g is Game => g !== null);

  const games = toGames(json.events ?? []);
  const year = typeof json.season?.year === "number" ? json.season.year : null;
  if (games.length > 0 || year === null) {
    return { games, seasonYear: year, isPastSeason: false };
  }

  const prev = await readFresh<{ events?: EspnEvent[] }>(
    `${SITE}/${path}/teams/${teamId}/schedule?season=${year - 1}`,
  );
  const prevGames = prev ? toGames(prev.events ?? []) : [];
  if (prevGames.length === 0) return { games: [], seasonYear: year, isPastSeason: false };
  return { games: prevGames, seasonYear: year - 1, isPastSeason: true };
}

const cachedSchedule = unstable_cache(fetchSchedule, ["espn-schedule"], { revalidate: TTL.schedule });

export async function espnSchedule(src: EspnSource): Promise<Fetched<Schedule>> {
  return cachedSchedule(src.path, src.teamId);
}

/** 오늘 하는 경기만 따로. 점수가 살아 움직이는 자리라 TTL 이 짧다. */
export async function espnLive(src: EspnSource): Promise<Fetched<Game | null>> {
  const json = await read<{ events?: EspnEvent[] }>(
    `${SITE}/${src.path}/scoreboard?limit=300`,
    TTL.live,
  );
  if (!json) return null;
  for (const e of json.events ?? []) {
    const comp = e.competitions?.[0];
    const mine = comp?.competitors?.some((c) => c.team?.id === src.teamId);
    if (!mine) continue;
    const game = toGame(e, src.teamId);
    /*
      **늙은 스코어보드를 거른다.** 데이터 캐시는 오래 잠들었다 깨면 낡은 값을 한 번 먼저
      내준다 — 9월 19일 7회 초 스코어보드가 10월에 "지금 하는 중" 으로 떴다(직접 봤다).
      야구 연장전도 12시간은 안 간다.
    */
    const started = game?.startsAt ? Date.parse(game.startsAt) : NaN;
    if (Number.isFinite(started) && Date.now() - started > 12 * 3_600_000) continue;
    if (game && (game.status === "in" || game.status === "final")) return game;
  }
  return null;
}

export type Roster = { coaches: Coach[]; players: Player[] };

export async function espnRoster(src: EspnSource): Promise<Fetched<Roster>> {
  type Athlete = {
    id?: string;
    fullName?: string;
    displayName?: string;
    jersey?: string;
    position?: { displayName?: string; abbreviation?: string; parent?: { displayName?: string } };
    displayHeight?: string;
    displayWeight?: string;
    age?: number;
    experience?: { years?: number; displayValue?: string };
    college?: { name?: string };
    birthPlace?: { city?: string; state?: string; country?: string };
    headshot?: { href?: string };
    injuries?: { status?: string; details?: { type?: string } }[];
  };

  const json = await read<{
    athletes?: ({ position?: string; items?: Athlete[] } | Athlete)[];
    coach?: { firstName?: string; lastName?: string; experience?: number }[];
  }>(`${SITE}/${src.path}/teams/${src.teamId}/roster`, TTL.roster);
  if (!json) return null;

  /*
    **묶여 오기도 하고 안 묶여 오기도 한다.** 미식축구는 포지션 그룹(offense/defense/…)으로
    묶여 오고, 농구·야구는 선수가 그냥 줄줄이 온다. 둘 다 같은 모양으로 편다.
  */
  const players: Player[] = [];
  for (const entry of json.athletes ?? []) {
    const group = "items" in entry && Array.isArray(entry.items) ? entry : null;
    const list: Athlete[] = group ? (group.items ?? []) : [entry as Athlete];
    for (const a of list) {
      if (!a?.id || !(a.fullName || a.displayName)) continue;
      /*
        **"Active" 는 부상이 아니다.** ESPN 은 성한 선수에게도 상태 칸을 채워 보내는데,
        그걸 그대로 부상으로 옮기면 로스터 전체에 빨간 딱지가 붙는다(한 번 그렇게 만들었다).
      */
      const raw = a.injuries?.[0];
      const injury = raw?.status && !/^active$/i.test(raw.status) ? raw : null;
      const hometown = [a.birthPlace?.city, a.birthPlace?.state ?? a.birthPlace?.country]
        .filter(Boolean)
        .join(", ");
      players.push({
        id: a.id,
        name: a.fullName ?? a.displayName ?? "",
        jersey: a.jersey ?? null,
        position: a.position?.abbreviation ?? a.position?.displayName ?? null,
        positionGroup:
          (group && "position" in group ? group.position : null) ??
          a.position?.parent?.displayName ??
          a.position?.displayName ??
          null,
        height: a.displayHeight ?? null,
        weight: a.displayWeight ?? null,
        age: typeof a.age === "number" ? a.age : null,
        experience: a.experience?.displayValue ?? (a.experience?.years != null ? `${a.experience.years} yr` : null),
        college: a.college?.name ?? null,
        hometown: hometown || null,
        headshot: a.headshot?.href ?? null,
        injury: injury ? [injury.status, injury.details?.type].filter(Boolean).join(" · ") : null,
      });
    }
  }

  const coaches: Coach[] = (json.coach ?? [])
    .map((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
      if (!name) return null;
      return {
        name,
        title: "Head Coach",
        experience: typeof c.experience === "number" ? `${c.experience} yr` : null,
      };
    })
    .filter((c): c is Coach => c !== null);

  return { coaches, players };
}

export async function espnNews(src: EspnSource, limit = 20): Promise<Fetched<Article[]>> {
  type EspnArticle = {
    id?: number | string;
    headline?: string;
    description?: string;
    published?: string;
    type?: string;
    byline?: string;
    images?: { url?: string }[];
    links?: { web?: { href?: string } };
  };

  const json = await read<{ articles?: EspnArticle[] }>(
    `${SITE}/${src.path}/news?team=${src.teamId}&limit=${limit}`,
    TTL.news,
  );
  if (!json) return null;

  return (json.articles ?? [])
    .filter((a) => a.headline)
    .map((a) => ({
      id: String(a.id ?? a.headline),
      headline: a.headline as string,
      description: a.description ?? null,
      publishedAt: a.published ?? null,
      url: a.links?.web?.href ?? null,
      image: a.images?.[0]?.url ?? null,
      kind: a.type ?? null,
      byline: a.byline ?? null,
    }));
}

/**
 * 스탠딩.
 *
 * ESPN 은 리그 > 컨퍼런스 > 디비전 으로 파고드는 나무를 준다. 우리는 **우리 팀이 들어 있는
 * 묶음을 맨 앞에** 두고 나머지를 뒤에 붙인다 — 내 순위를 보러 들어온 화면이기 때문이다.
 */
export async function espnStandings(src: EspnSource): Promise<Fetched<StandingsGroup[]>> {
  type Node = {
    name?: string;
    abbreviation?: string;
    children?: Node[];
    standings?: {
      entries?: {
        team?: EspnTeamRef;
        stats?: { name?: string; type?: string; value?: number; displayValue?: string }[];
      }[];
    };
  };

  const json = await read<Node>(
    `${SITE_V2}/${src.path}/standings?level=${src.standingsLevel}`,
    TTL.standings,
  );
  if (!json) return null;

  const groups: StandingsGroup[] = [];

  function walk(node: Node, parent: string | null) {
    if (node.standings?.entries?.length) {
      const rows = node.standings.entries.map((e) => {
          const stat = (n: string) => e.stats?.find((s) => s.name === n);
          /*
            **대학은 `losses` 를 아예 안 보낸다.** 대신 `type: "total"` 에 "1-1" 이라는
            문자열이 들어 있다. 이름으로만 찾고 있었더니 승수만 뜨고 패수 칸이 비어
            있었다(소유자 지적). 있는 쪽을 쓰고, 없으면 문자열을 갈라 쓴다.
          */
          const byType = (t: string) => e.stats?.find((s) => s.type === t)?.displayValue ?? null;
          const parts = (byType("total") ?? "").split("-").map((x) => Number(x.trim()));
          const fromRecord = (i: number) => (Number.isFinite(parts[i]) ? parts[i] : null);
          const num = (n: string) => {
            const v = stat(n)?.value;
            return typeof v === "number" ? Math.round(v) : null;
          };
          return {
            teamId: e.team?.id ?? null,
            name: e.team?.displayName ?? "",
            abbreviation: e.team?.abbreviation ?? null,
            logo: logoOf(e.team),
            isUs: e.team?.id === src.teamId,
            wins: num("wins") ?? fromRecord(0),
            losses: num("losses") ?? fromRecord(1),
            ties: num("ties") ?? fromRecord(2),
            /*
              승률도 대학에는 없다. 전적이 있으면 직접 센다 — 무승부는 반 승으로,
              이건 미식축구·축구가 쓰는 셈법이다.
            */
            winPercent: stat("winPercent")?.displayValue ?? percentOf(num("wins") ?? fromRecord(0), num("losses") ?? fromRecord(1), num("ties") ?? fromRecord(2)),
            gamesBehind: stat("gamesBehind")?.displayValue ?? null,
            streak: stat("streak")?.displayValue ?? null,
            points: num("points"),
            playoffSeed: num("playoffSeed"),
            differential: stat("pointDifferential")?.displayValue ?? stat("differential")?.displayValue ?? null,
            conferenceRecord: byType("vsconf"),
        } satisfies StandingsRow;
      });

      // **받은 순서를 믿지 않는다.** 이유는 `orderStandings` 에 적었다.
      const { rows: sorted, ordered } = orderStandings(rows);
      groups.push({ name: node.name ?? parent ?? "Standings", parent, rows: sorted, ordered });
    }
    for (const child of node.children ?? []) walk(child, node.name ?? parent);
  }
  walk(json, null);

  const ours = groups.filter((g) => g.rows.some((r) => r.isUs));
  const rest = groups.filter((g) => !g.rows.some((r) => r.isUs));
  return [...ours, ...rest];
}

export type Injury = { player: string; status: string; detail: string | null; date: string | null };

/**
 * 부상자 명단.
 *
 * 로스터에도 부상 표시가 붙어 오지만 **거기 것은 자주 비어 있다.** 코어 API 쪽이 실제로
 * 채워져 오는 자리라 따로 읽는다. 골수팬 화면에서 이 칸이 비면 화면을 볼 이유가 줄어든다.
 */
export async function espnInjuries(src: EspnSource): Promise<Fetched<Injury[]>> {
  const league = src.path.split("/");
  const url = `${CORE}/${league[0]}/leagues/${league[1]}/teams/${src.teamId}/injuries?limit=60`;
  const index = await read<{ items?: { $ref?: string }[] }>(url, TTL.injuries);
  if (!index) return null;

  const refs = (index.items ?? []).map((i) => i.$ref).filter((r): r is string => !!r);
  if (refs.length === 0) return [];

  const rows = await Promise.all(
    refs.slice(0, 40).map(async (ref) => {
      /*
        코어 API 는 자기 사설 호스트(espn.pvt)로 링크를 준다. 그대로 부르면 못 간다 —
        공개 호스트로 바꿔 부른다.
      */
      const open = ref.replace("sports.core.api.espn.pvt", "sports.core.api.espn.com").replace("http://", "https://");
      const d = await read<{
        status?: string;
        date?: string;
        type?: { description?: string };
        details?: { type?: string; detail?: string; returnDate?: string };
        athlete?: { $ref?: string; displayName?: string };
        shortComment?: string;
      }>(open, TTL.injuries);
      if (!d) return null;

      let player = d.athlete?.displayName ?? null;
      if (!player && d.athlete?.$ref) {
        const aRef = d.athlete.$ref
          .replace("sports.core.api.espn.pvt", "sports.core.api.espn.com")
          .replace("http://", "https://");
        const a = await read<{ displayName?: string }>(aRef, TTL.roster);
        player = a?.displayName ?? null;
      }
      if (!player) return null;

      return {
        player,
        status: d.status ?? d.type?.description ?? "Injured",
        detail: d.details?.detail ?? d.shortComment ?? d.details?.type ?? null,
        date: d.date ?? null,
      } satisfies Injury;
    }),
  );

  return rows.filter((r): r is Injury => r !== null);
}

/* ────────────────────────────── 포스트시즌 브래킷 ────────────────────────────── */

/**
 * 리그마다 포스트시즌을 읽는 법.
 *
 * ESPN 에는 **브래킷 주소가 없다**(bracket·postseason 류를 다 두드려 봤다, 전부 404). 있는 것은
 * 날짜별·주차별 스코어보드이고, 경기마다 "NLDS - Game 4" 같은 이름표와 "LAD win series 3-1"
 * 같은 시리즈 상태가 붙어 온다. 그걸 모아 브래킷을 세운다.
 *
 * - **day**: 날짜마다 한 번. 기간 조회(`dates=A-B`)는 400 을 준다(2026-10 확인).
 * - **week**: 미식축구는 주차로 묶여 있어서 주차마다 한 번이면 된다.
 *
 * `keep` 은 그 리그의 포스트시즌 중 **브래킷인 것만** 남긴다 — 대학 풋볼의 볼 게임 마흔 개
 * 중 플레이오프는 열한 개고, 대학 농구는 NIT·CBI 가 같은 날 같이 열린다.
 *
 * `rounds` 는 **나무의 모양**이다 — 아직 안 열린 라운드도 빈 상자로 자리를 그려야 해서, 라운드
 * 이름을 미리 안다(`roundOf` 가 내는 이름 그대로, 마지막이 결승). `pre` 는 나무 밖의 판.
 *
 * `seeds` 는 첫 라운드 자리를 잡는 법:
 * - **standings**: 순위표의 플레이오프 시드(`playoffSeed`) — 경기 데이터에는 시드가 없다.
 * - **division**: NHL 은 시드 1-8 로 짝을 안 짓는다. 디비전 안에서 짝을 짓는다(1위 대 와일드카드,
 *   2위 대 3위). 그래서 시드는 안 그리고 디비전으로 자리만 잡는다.
 * - 없으면 경기에 붙어 오는 시드(대학 — CFP·NCAA 는 `curatedRank` 가 시드다).
 *
 * 팀이 아니라 리그에 딸린 것이라 `teams.ts` 가 아니라 여기 둔다. 같은 리그 팀을 더할 때는
 * 손댈 게 없고, 표에 없는 리그는 날짜별로 다 읽어 목록으로 그린다.
 */
type PostseasonHow = {
  by: "day" | "week";
  query?: string;
  keep?: RegExp;
  playIn?: boolean;
  rounds?: string[];
  pre?: string[];
  seeds?: "standings" | "division";
  /** 라운드마다 시드를 다시 매긴다(NFL — 1번 시드가 남은 팀 중 가장 낮은 시드와 붙는다). */
  reseed?: boolean;
};

const POSTSEASON: Record<string, PostseasonHow> = {
  "football/nfl": {
    by: "week",
    rounds: ["Wild Card", "Divisional", "Conference Championship", "Super Bowl"],
    seeds: "standings",
    reseed: true,
  },
  "football/college-football": {
    by: "week",
    query: "groups=80&limit=200",
    keep: /College Football Playoff/i,
    rounds: ["First Round", "Quarterfinal", "Semifinal", "National Championship"],
  },
  "baseball/mlb": {
    by: "day",
    rounds: ["Wild Card Series", "Division Series", "Championship Series", "World Series"],
    seeds: "standings",
  },
  "basketball/nba": {
    by: "day",
    playIn: true,
    pre: ["Play-In"],
    rounds: ["1st Round", "Conference Semifinals", "Conference Finals", "NBA Finals"],
    seeds: "standings",
  },
  "hockey/nhl": {
    by: "day",
    rounds: ["1st Round", "2nd Round", "Conference Final", "Stanley Cup Final"],
    seeds: "division",
  },
  "basketball/mens-college-basketball": {
    by: "day",
    query: "groups=100&limit=100",
    keep: /NCAA Men's Basketball Championship/i,
    pre: ["First Four"],
    rounds: ["1st Round", "2nd Round", "Sweet 16", "Elite 8", "Final Four", "National Championship"],
  },
};

type Round = { round: string; group: string | null; label: string | null };

/**
 * 경기 이름표를 라운드·묶음으로 가른다. 확인한 이름표(2025-26 시즌):
 *
 *   MLB  "ALWC - Game 2" · "NLDS - Game 4" · "ALDS - Game 4 If Necessary" · "World Series - Game 2"
 *   NBA  "NBA Play-In - East - 7th Place vs 8th Place" · "West 1st Round - Game 3" ·
 *        "East Semifinals - Game 4" · "East Finals - Game 4" · "NBA Finals - Game 4"
 *   NHL  "East 1st Round - Game 4" · "West 2nd Round - Game 4" · ...
 *   NFL  "NFC Wild Card Playoffs" · "AFC Divisional Playoffs" · "Super Bowl LX"
 *   CFP  "College Football Playoff Quarterfinal at the Rose Bowl Presented by Prudential"
 *   NCAA "NCAA Men's Basketball Championship - West Region - Sweet 16"
 *
 * 모르는 모양은 이름표 통째가 라운드 이름이 된다 — 틀리게 가르느니 덜 가르는 쪽이다.
 */
function roundOf(headline: string): Round {
  // "ALDS - Game 4 If Necessary" — 열릴지 모르는 경기도 같은 시리즈다.
  const h = headline.replace(/\s*-\s*Game \d+(\s+If Necessary)?\s*$/i, "").trim();

  const mlb = h.match(/^(AL|NL)(WC|DS|CS)$/);
  if (mlb) {
    const name = { WC: "Wild Card Series", DS: "Division Series", CS: "Championship Series" }[mlb[2]] ?? h;
    return { round: name, group: mlb[1], label: null };
  }

  const playIn = h.match(/^NBA Play-In - (East|West) - (.+)$/i);
  if (playIn) return { round: "Play-In", group: playIn[1], label: playIn[2].replace(/ Place/g, "") };

  const conf = h.match(/^(East|West)(?:ern)?(?: Conference)? (.+)$/);
  if (conf) {
    // "East Finals" 는 리그 결승이 아니라 컨퍼런스 결승이다. 결승과 헷갈리지 않게 이름을 늘린다.
    const rest = conf[2].replace(/^(Semifinals|Finals?)$/i, "Conference $1");
    return { round: rest, group: conf[1], label: null };
  }

  const nfl = h.match(/^(AFC|NFC) (Wild Card|Divisional|Championship)/);
  if (nfl) return { round: nfl[2] === "Championship" ? "Conference Championship" : nfl[2], group: nfl[1], label: null };

  const cfp = h.match(/^College Football Playoff (First Round|Quarterfinal|Semifinal|National Championship)(?:.* at the (.+))?/i);
  if (cfp) {
    const bowl = cfp[2]?.replace(/\s+Presented by.*$/i, "").trim() ?? null;
    return { round: cfp[1], group: null, label: bowl };
  }

  const ncaa = h.match(/^NCAA Men's Basketball Championship - (?:(\w+) Region - )?(.+)$/i);
  if (ncaa) return { round: ncaa[2], group: ncaa[1] ?? null, label: null };

  return { round: h, group: null, label: null };
}

/** 순위표에서 읽은 팀별 시드와 디비전. 팀 id 로 찾는다. */
type Seeds = Map<string, { seed: number | null; division: string | null }>;

function bracketTeam(c: EspnCompetitor | undefined, ourTeamId: string, seeds: Seeds | null, showSeeds: boolean): BracketTeam | null {
  const t = c?.team;
  if (!t?.displayName) return null;
  const rank = c?.curatedRank?.current;
  const fromGame = typeof rank === "number" && rank > 0 && rank < 99 ? rank : null;
  const fromTable = t.id ? (seeds?.get(t.id)?.seed ?? null) : null;
  return {
    id: t.id ?? null,
    name: t.displayName,
    shortName: t.shortDisplayName ?? t.abbreviation ?? null,
    logo: logoOf(t),
    seed: showSeeds ? (fromTable ?? fromGame) : null,
    isUs: t.id === ourTeamId,
    score: null,
    won: false,
  };
}

/** 한 경기에서 읽은 것. 시리즈는 이걸 여러 개 모아 매치업 하나가 된다. */
type PostGame = { e: EspnEvent; comp: EspnCompetition; round: Round; status: GameStatus; at: string };

/**
 * 같은 매치업의 경기들을 한 장으로.
 *
 * 시리즈면 **최근에 열린 경기**의 시리즈 상태가 지금 상태다(이긴 수·"LAD win series 3-1").
 * 두 팀의 위아래는 1차전 홈팀이 위 — 상위 시드가 1차전 홈이다. 시드가 있는 대학은 시드 순.
 */
function toMatchup(games: PostGame[], ourTeamId: string, seeds: Seeds | null, showSeeds: boolean): Matchup | null {
  const sorted = [...games].sort((a, b) => a.at.localeCompare(b.at));
  const opener = sorted[0];
  const played = sorted.filter((g) => g.status === "in" || g.status === "final");
  const latest = played[played.length - 1] ?? opener;
  const live = sorted.find((g) => g.status === "in") ?? null;
  const upcoming = sorted.find((g) => g.status === "scheduled") ?? null;

  const cs = opener.comp.competitors ?? [];
  const home = cs.find((c) => c.homeAway === "home") ?? cs[0];
  const away = cs.find((c) => c !== home);
  let pair = [bracketTeam(home, ourTeamId, seeds, showSeeds), bracketTeam(away, ourTeamId, seeds, showSeeds)];
  if (pair[0]?.seed != null && pair[1]?.seed != null && pair[1].seed < pair[0].seed) pair = [pair[1], pair[0]];
  const [top, bottom] = pair;
  if (!top || !bottom) return null;

  const series = latest.comp.series;
  const isSeries = series?.type === "playoff" && (series.totalCompetitions ?? 0) > 1;
  const idOf = (name: string) => cs.find((c) => c.team?.displayName === name)?.team?.id;

  let status: GameStatus;
  if (isSeries) {
    status = live ? "in" : series?.completed ? "final" : "scheduled";
    for (const t of [top, bottom]) {
      const wins = series?.competitors?.find((c) => c.id === idOf(t.name))?.wins;
      t.score = typeof wins === "number" && played.length > 0 ? wins : null;
    }
    if (series?.completed) {
      const max = Math.max(top.score ?? 0, bottom.score ?? 0);
      for (const t of [top, bottom]) t.won = t.score === max && max > 0;
    }
  } else {
    status = latest.status;
    const comp = latest.comp;
    for (const t of [top, bottom]) {
      const c = comp.competitors?.find((x) => x.team?.displayName === t.name);
      t.score = status === "in" || status === "final" ? scoreOf(c) : null;
      t.won = status === "final" && c?.winner === true;
    }
  }

  // 지금 하는 경기가 있으면 그 이닝·쿼터가, 아니면 시리즈 한 줄이 이 매치업의 한 줄이다.
  const gameNo = (g: PostGame) => g.comp.notes?.[0]?.headline?.match(/Game (\d+)/i)?.[1];
  let detail: string | null = null;
  if (live) {
    const no = isSeries ? gameNo(live) : null;
    detail = [no ? `Game ${no}` : null, live.comp.status?.type?.shortDetail ?? null].filter(Boolean).join(" · ") || null;
  } else if (isSeries && played.length > 0) {
    detail = series?.summary ?? null;
  } else if (isSeries && upcoming) {
    detail = series?.totalCompetitions ? `Best of ${series.totalCompetitions}` : null;
  }

  // 지금 하는 경기의 점수. 시리즈의 `score` 는 이긴 수라서 이건 따로 든다.
  const liveScore = (name: string) => scoreOf(live?.comp.competitors?.find((x) => x.team?.displayName === name));
  const liveLine: Matchup["live"] = live ? [liveScore(top.name), liveScore(bottom.name)] : null;

  return {
    id: isSeries ? `${opener.round.round}-${[top.name, bottom.name].sort().join("-")}` : (opener.e.id ?? opener.at),
    group: opener.round.group,
    label: opener.round.label,
    teams: [top, bottom],
    series: isSeries,
    status,
    startsAt: (live ?? (status === "final" ? latest : upcoming ?? latest)).at,
    detail,
    live: liveLine,
    slot: null,
  };
}

/** YYYYMMDD — ESPN 의 `dates=` 모양. 날짜는 UTC 로 센다(창의 시작·끝을 ESPN 이 UTC 로 준다). */
function ymd(t: number): string {
  return new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchPostseason(path: string, ourTeamId: string): Promise<Fetched<BracketRound[]>> {
  const how = POSTSEASON[path] ?? { by: "day" as const };
  const [sport, league] = path.split("/");

  // 지금 시즌이 몇 년인지, 그리고 주차형 리그면 포스트시즌 주차가 무엇인지.
  const board = await read<{
    leagues?: {
      season?: { year?: number };
      calendar?: { value?: string; startDate?: string; entries?: { value?: string }[] }[] | string[];
    }[];
  }>(`${SITE}/${path}/scoreboard`, TTL.live);
  const year = board?.leagues?.[0]?.season?.year;
  if (typeof year !== "number") return null;

  // 포스트시즌 창. 플레이인은 그 앞에 따로 열린다(시즌 종류 5).
  type Window = { startDate?: string; endDate?: string };
  const typeUrl = (n: number) => `${CORE}/${sport}/leagues/${league}/seasons/${year}/types/${n}`;
  const [post, playIn] = await Promise.all([
    read<Window>(typeUrl(3), TTL.standings),
    how.playIn ? read<Window>(typeUrl(5), TTL.standings) : Promise.resolve(null),
  ]);
  if (!post?.startDate) return null;

  const start = Date.parse(playIn?.startDate ?? post.startDate);
  const end = Date.parse(post.endDate ?? "");
  const now = Date.now();
  // **아직 안 열렸으면 없는 것이다.** 정규시즌 내내 빈 브래킷 탭을 띄우지 않는다.
  if (!Number.isFinite(start) || now < start) return [];

  const urls: { url: string; ttl: number }[] = [];
  const extra = how.query ? `&${how.query}` : "";
  if (how.by === "week") {
    const cal = board?.leagues?.[0]?.calendar;
    const postCal = Array.isArray(cal) ? cal.find((c) => typeof c === "object" && c.value === "3") : undefined;
    const weeks = typeof postCal === "object" ? (postCal.entries ?? []).map((w) => w.value).filter(Boolean) : [];
    for (const w of weeks) urls.push({ url: `${SITE}/${path}/scoreboard?dates=${year}&seasontype=3&week=${w}${extra}`, ttl: TTL.live });
  } else {
    // 오늘 다음 이틀까지 — 시리즈의 다음 경기 시각이 거기 있다. 끝난 날은 길게 캐시한다.
    const last = Math.min(Number.isFinite(end) ? end : now, now + 2 * 86_400_000);
    for (let t = start; t <= last; t += 86_400_000) {
      const old = now - t > 2 * 86_400_000;
      urls.push({ url: `${SITE}/${path}/scoreboard?dates=${ymd(t)}${extra}`, ttl: old ? TTL.pastDay : TTL.live });
    }
  }

  const [pages, seeds] = await Promise.all([
    Promise.all(urls.map((u) => read<{ events?: EspnEvent[] }>(u.url, u.ttl))),
    how.seeds ? readSeeds(path, year) : Promise.resolve(null),
  ]);
  // 한 장이라도 못 읽으면 브래킷에 구멍이 난다. 구멍 난 브래킷은 틀린 브래킷이다.
  if (pages.some((p) => p === null)) return null;
  const showSeeds = how.seeds !== "division";

  const seen = new Set<string>();
  const games: PostGame[] = [];
  for (const page of pages) {
    for (const e of page?.events ?? []) {
      const comp = e.competitions?.[0];
      if (!e.id || !comp || seen.has(e.id)) continue;
      seen.add(e.id);
      const type = e.season?.type;
      if (type !== 3 && !(how.playIn && type === 5)) continue;
      if (comp.type?.abbreviation === "ALLSTAR") continue;
      const headline = comp.notes?.[0]?.headline ?? "";
      if (!headline || (how.keep && !how.keep.test(headline))) continue;
      games.push({ e, comp, round: roundOf(headline), status: statusOf(comp.status ?? e.status), at: comp.date ?? e.date ?? "" });
    }
  }

  // 시리즈는 라운드+두 팀으로, 단판은 경기 하나로 묶는다.
  const buckets = new Map<string, PostGame[]>();
  for (const g of games) {
    const s = g.comp.series;
    const isSeries = s?.type === "playoff" && (s.totalCompetitions ?? 0) > 1;
    const ids = (g.comp.competitors ?? []).map((c) => c.team?.id ?? "").sort().join("-");
    const key = isSeries ? `${g.round.round}|${g.round.group ?? ""}|${ids}` : `game|${g.e.id}`;
    buckets.set(key, [...(buckets.get(key) ?? []), g]);
  }

  const rounds = new Map<string, Matchup[]>();
  for (const list of buckets.values()) {
    const m = toMatchup(list, ourTeamId, seeds, showSeeds);
    if (!m) continue;
    const name = list[0].round.round;
    rounds.set(name, [...(rounds.get(name) ?? []), m]);
  }

  // 모양을 모르는 리그는 있는 라운드만 목록으로.
  if (!how.rounds) return orderBracket([...rounds.entries()].map(([name, matchups]) => ({ name, pre: false, matchups })));

  /*
    **모양대로 세운다.** 아직 안 열린 라운드도 이름과 빈 매치업 목록으로 자리를 둔다 — 화면이
    거기 빈 상자를 그린다. 이름은 데이터에 있는 것을 쓴다("Super Bowl" 자리에 "Super Bowl LX").
  */
  const used = new Set<string>();
  const pick = (want: string) => {
    const name = [...rounds.keys()].find((n) => !used.has(n) && (n === want || n.startsWith(want)));
    if (name) used.add(name);
    return name;
  };
  const pre = (how.pre ?? []).flatMap((want) => {
    const name = pick(want);
    return name ? [{ name, pre: true, matchups: rounds.get(name) ?? [] }] : [];
  });
  const main = how.rounds.map((want) => {
    const name = pick(want);
    return { name: name ?? want, pre: false, matchups: name ? (rounds.get(name) ?? []) : [] };
  });
  // 모양에 없는 라운드는 버리지 않고 나무 밖에 둔다. 버리면 경기가 사라진다.
  const leftover = [...rounds.entries()].filter(([n]) => !used.has(n)).map(([name, matchups]) => ({ name, pre: true, matchups }));

  if (how.seeds === "division" && seeds) placeByDivision(main[0].matchups, seeds);
  if (how.reseed && main[1]?.matchups.length) placeUnderNext(main[0].matchups, main[1].matchups);

  return [...orderBracket([...pre, ...leftover]), ...orderBracket(main)];
}

/**
 * 순위표의 플레이오프 시드와 디비전.
 *
 * 경기 데이터에는 시드가 없다(MLB·NBA·NFL 은 `curatedRank` 가 비어 있고, NHL 은 99 다).
 * 순위표의 `playoffSeed` 가 그 자리다 — 2026 NBA 동부가 DET 1 · BOS 2 · … · ORL 8 로, 리그
 * 브래킷 그림과 같다. 디비전 깊이(level=3)로 읽어 디비전 이름도 같이 든다.
 */
async function readSeeds(path: string, year: number): Promise<Seeds | null> {
  type Node = {
    name?: string;
    children?: Node[];
    standings?: { entries?: { team?: { id?: string }; stats?: { name?: string; value?: number }[] }[] };
  };
  const json = await read<Node>(`${SITE_V2}/${path}/standings?level=3&season=${year}`, TTL.standings);
  if (!json) return null;
  const out: Seeds = new Map();
  const walk = (n: Node) => {
    for (const e of n.standings?.entries ?? []) {
      const v = e.stats?.find((x) => x.name === "playoffSeed")?.value;
      if (e.team?.id) out.set(e.team.id, { seed: typeof v === "number" && v > 0 ? Math.round(v) : null, division: n.name ?? null });
    }
    for (const c of n.children ?? []) walk(c);
  };
  walk(json);
  return out;
}

/**
 * 다시 매기는 리그(NFL)의 첫 라운드 자리 — **다음 라운드에서 실제로 누구와 만났는지로.**
 *
 * NFL 은 와일드카드가 끝나면 시드를 다시 매긴다. 1번 시드는 4·5번 승자가 아니라 남은 팀 중
 * 가장 낮은 시드와 붙는다(2025: 시호크스 1번이 6번 49ers 와). 시드 배치로 자리를 잡으면
 * 와일드카드 칸에서 그어진 선이 엉뚱한 디비저널 경기로 간다. 그래서 디비저널이 나오면 그
 * 짝대로 자리를 다시 놓는다 — 시드 높은 경기가 위, 부전승 팀이 있으면 그 자리가 먼저.
 * 디비저널 전에는 시드 배치 그대로다(아직 모르는 대진이다).
 */
function placeUnderNext(first: Matchup[], next: Matchup[]) {
  const best = (m: Matchup) => Math.min(...m.teams.map((t) => t?.seed ?? 99));
  const byGroup = new Map<string, Matchup[]>();
  for (const m of next) byGroup.set(m.group ?? "", [...(byGroup.get(m.group ?? "") ?? []), m]);

  for (const [group, parents] of byGroup) {
    parents.sort((a, b) => best(a) - best(b));
    const kids = first.filter((m) => (m.group ?? "") === group);
    parents.forEach((p, k) => {
      const names = p.teams.map((t) => t?.name);
      const linked = kids.filter((m) => m.teams.some((t) => t && names.includes(t.name))).sort((a, b) => best(a) - best(b));
      // 부전승 팀이 있는 경기는 한 칸만 내려온다 — 그 칸이 아래, 위는 부전승 자리.
      const offset = linked.length === 1 ? 1 : 0;
      linked.forEach((m, i) => (m.slot = k * 2 + offset + i));
    });
  }
}

/**
 * NHL 첫 라운드의 자리.
 *
 * NHL 은 디비전 안에서 짝을 짓는다 — 1위 대 와일드카드, 2위 대 3위, 그 둘의 승자가 2라운드에서
 * 만난다. 그래서 매치업의 디비전은 **시드가 높은 쪽 팀의 디비전**이고(와일드카드는 남의
 * 디비전에서 올 수 있다), 디비전마다 1위가 있는 매치업이 위다. 2026 동부로 확인: CAR–OTT 와
 * PIT–PHI 가 메트로폴리탄, 그 승자 CAR–PHI 가 실제 2라운드였다.
 */
function placeByDivision(matchups: Matchup[], seeds: Seeds) {
  // 매치업에서 시드가 제일 높은 팀 — 그 팀의 디비전이 이 매치업의 디비전이다.
  const top = (m: Matchup) =>
    m.teams
      .map((t) => (t?.id ? seeds.get(t.id) : undefined))
      .filter((r): r is { seed: number; division: string } => r?.seed != null && !!r.division)
      .sort((a, b) => a.seed - b.seed)[0] ?? null;

  const byGroup = new Map<string, Matchup[]>();
  for (const m of matchups) byGroup.set(m.group ?? "", [...(byGroup.get(m.group ?? "") ?? []), m]);

  for (const list of byGroup.values()) {
    if (list.some((m) => !top(m))) continue;
    const divisions = [...new Set(list.map((m) => top(m)!.division))].sort();
    const here = divisions.map((d) => list.filter((m) => top(m)!.division === d).sort((a, b) => top(a)!.seed - top(b)!.seed));
    // 디비전마다 매치업이 둘이어야 짝이 맞다. 아니면 모양이 바뀐 것이라 자리를 안 박는다.
    if (here.some((h) => h.length !== 2)) continue;
    here.forEach((h, d) => h.forEach((m, i) => (m.slot = d * 2 + i)));
  }
}

const cachedPostseason = unstable_cache(fetchPostseason, ["espn-postseason"], { revalidate: TTL.live });

/**
 * 이 팀 리그의 포스트시즌 브래킷.
 *
 * **우리 팀이 있든 없든 리그 전체를 준다.** `[]` 는 포스트시즌이 아직 안 열렸다는 것이고,
 * null 은 못 읽었다는 것이다. 한 번 열리면 다음 시즌이 시작될 때까지(ESPN 의 시즌 해가
 * 넘어갈 때까지) 남는다 — 우승팀은 겨울 내내 우승팀이다.
 */
export async function espnPostseason(src: EspnSource): Promise<Fetched<BracketRound[]>> {
  return cachedPostseason(src.path, src.teamId);
}
