/**
 * MaxPreps — 고등학교의 전적·리그 순위표·로스터·전국 랭킹.
 *
 * 학교 캘린더(`sidearm.ts`)는 **일정만** 준다. 그런데 오렌지 루터란은 트리니티 리그 —
 * 전국 순위에 늘 올라오는 리그다. 몇 승 몇 패인지, 리그에서 몇 위인지, 캘리포니아에서
 * 몇 위인지가 이 팀 팬이 제일 먼저 보는 것들인데 그게 화면에 없었다.
 *
 * MaxPreps 는 그걸 다 들고 있고, 페이지 안에 **자기가 그리는 데 쓰는 JSON 을 그대로**
 * 심어 둔다(`__NEXT_DATA__`). 화면 글자를 긁는 것보다 훨씬 덜 부러진다 — 디자인이 바뀌어도
 * 이 데이터는 그대로다.
 *
 * ## 그래도 남의 집 안쪽이다
 *
 * ESPN·학교 캘린더와 달리 이건 **공개하라고 만든 문이 아니다.** 그래서 두 가지를 지킨다.
 *
 * 1. **모양이 다르면 그냥 없다고 한다.** 특히 로스터는 이름표 없는 배열(자리로만 뜻이 정해진
 *    줄)로 와서, 순서가 바뀌면 키를 몸무게 자리에 넣는 일이 생긴다. 그래서 줄마다
 *    "전체 이름 == 이름 + 성" 을 확인하고, 안 맞으면 **통째로 null** 을 돌려준다. 화면은
 *    로스터 탭을 접는다. 틀린 걸 보여 주느니 없는 게 낫다.
 * 2. **조금만 부른다.** 종목당 세 페이지, 결과는 길게 캐시한다.
 */

import { unstable_cache } from "next/cache";
import { orderStandings } from "./split";
import type { Fetched, Player, StandingsGroup, StandingsRow } from "./types";

const TTL = { team: 1_800, standings: 1_800, roster: 43_200 } as const;

/**
 * 페이지에 심긴 JSON 한 덩어리.
 *
 * 브라우저 UA 를 보낸다 — 안 보내면 막힌다(ESPN 은 정반대라 거기선 UA 를 안 보낸다).
 */
async function readNextData(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    const json = JSON.parse(m[1]) as { props?: { pageProps?: Record<string, unknown> } };
    return json.props?.pageProps ?? null;
  } catch {
    return null;
  }
}

/* ────────────────────────────── 팀 한 장 ────────────────────────────── */

export type SchoolStanding = {
  /** "3-1". 시즌이 아직 안 열렸으면 null. */
  record: string | null;
  /** "W3" */
  streak: string | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  /** "Trinity" */
  leagueName: string | null;
  /** "1st" */
  leaguePlacement: string | null;
  /** 리그 순위표가 있는 곳. 이게 있어야 표를 가져온다. */
  leagueUrl: string | null;
  /** "No. 9 in California" 같은 줄들. 골수팬 화면에서 제일 먼저 읽는 칸이다. */
  rankings: { rank: number; scope: string }[];
};

type TeamContext = {
  standingsData?: {
    overallStanding?: {
      overallWinLossTies?: string;
      points?: number;
      pointsAgainst?: number;
      streak?: number;
      streakResult?: string;
    } | null;
    leagueStanding?: {
      leagueName?: string;
      canonicalUrl?: string;
      conferenceStandingPlacement?: string;
    } | null;
  };
  rankingsData?: { data?: { rank?: number; contextName?: string }[] };
};

async function fetchTeam(base: string, sport: string): Promise<Fetched<SchoolStanding>> {
  const pp = await readNextData(`${base}/${sport}/`);
  const tc = (pp?.teamContext ?? null) as TeamContext | null;
  if (!tc) return null;

  const overall = tc.standingsData?.overallStanding ?? null;
  const league = tc.standingsData?.leagueStanding ?? null;

  return {
    record: overall?.overallWinLossTies ?? null,
    streak: overall?.streakResult && overall?.streak ? `${overall.streakResult}${overall.streak}` : null,
    pointsFor: overall?.points ?? null,
    pointsAgainst: overall?.pointsAgainst ?? null,
    leagueName: league?.leagueName ?? null,
    leaguePlacement: league?.conferenceStandingPlacement ?? null,
    leagueUrl: league?.canonicalUrl ?? null,
    rankings: (tc.rankingsData?.data ?? [])
      .filter((r) => typeof r.rank === "number" && r.contextName)
      .map((r) => ({ rank: r.rank as number, scope: r.contextName as string })),
  };
}

const cachedTeam = unstable_cache(fetchTeam, ["maxpreps-team"], { revalidate: TTL.team });

export async function maxprepsTeam(base: string, sport: string): Promise<Fetched<SchoolStanding>> {
  return cachedTeam(base, sport);
}

/* ────────────────────────────── 리그 순위표 ────────────────────────────── */

type LeagueRow = {
  schoolName?: string;
  schoolNameAcronym?: string;
  schoolMascotUrl?: string;
  overallWins?: number;
  overallLosses?: number;
  overallTies?: number;
  winningPercentage?: number;
  points?: number;
  pointsAgainst?: number;
  streak?: number;
  streakResult?: string;
  contextStandingPlacement?: number;
};

async function fetchStandings(
  leagueUrl: string,
  ourName: string,
  groupName: string,
): Promise<Fetched<StandingsGroup[]>> {
  const pp = await readNextData(leagueUrl);
  const table = (pp?.layoutProps as { tableData?: LeagueRow[] } | undefined)?.tableData;
  if (!Array.isArray(table) || table.length === 0) return null;

  const out: StandingsRow[] = table
    .filter((r) => r.schoolName)
    .map((r) => {
      const pf = r.points ?? null;
      const pa = r.pointsAgainst ?? null;
      const diff = pf != null && pa != null ? pf - pa : null;
      return {
        teamId: r.schoolName ?? null,
        name: r.schoolName as string,
        abbreviation: r.schoolNameAcronym ?? null,
        logo: r.schoolMascotUrl ?? null,
        isUs: r.schoolName === ourName,
        wins: r.overallWins ?? null,
        losses: r.overallLosses ?? null,
        ties: r.overallTies ?? null,
        // 다른 리그 표와 같은 모양으로 — ".750" 처럼 앞의 0 을 뗀다.
        winPercent:
          typeof r.winningPercentage === "number" ? r.winningPercentage.toFixed(3).replace(/^0/, "") : null,
        gamesBehind: null,
        streak: r.streakResult && r.streak ? `${r.streakResult}${r.streak}` : null,
        points: null,
        playoffSeed: r.contextStandingPlacement ?? null,
        differential: diff == null ? null : diff > 0 ? `+${diff}` : String(diff),
      } satisfies StandingsRow;
    });

  const { rows, ordered } = orderStandings(out);
  return [{ name: groupName, parent: null, rows, ordered }];
}

const cachedStandings = unstable_cache(fetchStandings, ["maxpreps-standings"], {
  revalidate: TTL.standings,
});

export async function maxprepsStandings(
  leagueUrl: string,
  ourName: string,
  groupName: string,
): Promise<Fetched<StandingsGroup[]>> {
  return cachedStandings(leagueUrl, ourName, groupName);
}

/* ────────────────────────────── 로스터 ────────────────────────────── */

/*
  선수 한 줄이 이름표 없이 **자리로만** 온다. 확인한 자리(2026-09-18, 78명 전부 맞음):

    5 이름 · 6 성 · 8 등번호 · 11 몸무게 · 32 포지션 · 33 전체 이름 · 34 키 · 36 학년

  33 번이 "5번 + 6번" 과 같은지로 줄이 안 밀렸는지 본다. 한 줄이라도 어긋나면 표가
  통째로 바뀐 것이므로 **없는 셈 친다** — 키 자리에 몸무게를 그려 놓는 것보다 낫다.
*/
const NAME = 33;
const FIRST = 5;
const LAST = 6;
const JERSEY = 8;
const WEIGHT = 11;
const POSITION = 32;
const HEIGHT = 34;
const CLASS = 36;

async function fetchRoster(base: string, sport: string): Promise<Fetched<Player[]>> {
  const pp = await readNextData(`${base}/${sport}/roster/`);
  const rows = pp?.athleteData;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const players: Player[] = [];
  for (const row of rows as unknown[][]) {
    if (!Array.isArray(row)) return null;
    const name = row[NAME];
    if (typeof name !== "string" || name !== `${row[FIRST]} ${row[LAST]}`) return null;

    const weight = typeof row[WEIGHT] === "number" ? `${row[WEIGHT]} lbs` : null;
    players.push({
      id: `${name}-${String(row[JERSEY] ?? "")}`,
      name,
      jersey: row[JERSEY] == null ? null : String(row[JERSEY]),
      position: typeof row[POSITION] === "string" && row[POSITION] ? (row[POSITION] as string) : null,
      // 고등학교는 포지션 그룹으로 안 묶는다. 한 선수가 공·수를 같이 뛴다.
      positionGroup: null,
      height: typeof row[HEIGHT] === "string" ? (row[HEIGHT] as string) : null,
      weight,
      age: null,
      // 대학 로스터의 "학년" 자리에 고등학교는 Fr./So./Jr./Sr. 가 온다.
      experience: typeof row[CLASS] === "string" ? (row[CLASS] as string) : null,
      college: null,
      hometown: null,
      headshot: null,
      injury: null,
    });
  }

  return players;
}

const cachedRoster = unstable_cache(fetchRoster, ["maxpreps-roster"], { revalidate: TTL.roster });

export async function maxprepsRoster(base: string, sport: string): Promise<Fetched<Player[]>> {
  return cachedRoster(base, sport);
}
