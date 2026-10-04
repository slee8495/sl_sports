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
import { orderStandings } from "./split";
import type { EspnSource } from "./teams";
import type {
  Article,
  Coach,
  Fetched,
  Game,
  GameStatus,
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
