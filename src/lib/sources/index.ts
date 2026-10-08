/**
 * 화면이 부르는 창구.
 *
 * 팀이 ESPN 에서 오는지 학교 캘린더에서 오는지는 **여기서 갈리고 여기서 끝난다.** 페이지는
 * `getPrograms(team)` 만 부르고, 어디서 왔는지 모른다 — 나중에 출처가 하나 더 늘어도
 * 화면은 안 고친다.
 *
 * ## 팀이 아니라 "종목" 이 단위다
 *
 * 프로 팀은 종목이 하나뿐이라 팀과 종목이 같은 말이지만, **고등학교는 아니다.** 오렌지
 * 루터란은 한 학교가 풋볼도 하고 야구도 한다. 전적도 순위표도 로스터도 종목마다 따로다 —
 * 가을의 3승 1패는 풋볼 이야기이고, 야구 로스터와 풋볼 로스터는 사람이 다르다.
 *
 * 그래서 팀이 들고 있는 것은 **종목 목록**이고, 화면은 그중 하나를 골라 그린다. 종목이
 * 하나뿐인 팀에서는 고를 것이 없으므로 고르는 자리도 안 그린다.
 */

import {
  espnInjuries,
  espnLive,
  espnNews,
  espnPostseason,
  espnRoster,
  espnSchedule,
  espnSnapshot,
  espnStandings,
  type Injury,
  type Roster,
} from "./espn";
import { maxprepsBracket, maxprepsRoster, maxprepsStandings, maxprepsTeam } from "./maxpreps";
import { sidearmNews, sidearmSchedule } from "./sidearm";
import { recordOf, splitSchedule } from "./split";
import { fallbackSnapshot, type SchoolSource, type Team } from "./teams";
import type { Article, BracketRound, Fetched, Game, StandingsGroup, TeamSnapshot } from "./types";

export type { Injury, Roster };
export { splitSchedule, splitPrograms, recordOf, type ScheduleSplit } from "./split";

/** 화면에서 종목을 고르는 단추에 그려지는 공. */
export type Ball = "football" | "baseball" | "basketball" | "hockey";

const BALLS: Record<string, Ball> = {
  football: "football",
  baseball: "baseball",
  basketball: "basketball",
  hockey: "hockey",
};

/** 한 팀 안의 종목 하나. 이 안에 그 종목의 모든 것이 들어 있다. */
export type Program = {
  key: string;
  label: string;
  ball: Ball;
  games: Game[];
  /** 이번 시즌이 아직 안 열려서 지난 시즌을 보여 주는 중이면 그 해. 아니면 null. */
  pastSeason: number | null;
  snapshot: TeamSnapshot;
  standings: Fetched<StandingsGroup[]>;
  roster: Fetched<Roster>;
  injuries: Fetched<Injury[]>;
  /**
   * 리그 포스트시즌 브래킷. **우리 팀이 없어도 채운다.** `[]` 는 아직 안 열렸다는 것.
   */
  postseason: Fetched<BracketRound[]>;
  /**
   * 지금 하는 중인 종목인가.
   *
   * 화면을 열었을 때 어느 쪽을 먼저 보여 줄지를 이걸로 정한다 — 가을에 야구 순위표를
   * 먼저 띄우면 틀린 건 아니어도 **지금 궁금한 게 아니다.**
   */
  inSeason: boolean;
};

/* ────────────────────────────── ESPN 팀 ────────────────────────────── */

async function espnProgram(team: Team): Promise<Fetched<Program[]>> {
  if (team.source.kind !== "espn") return null;
  const src = team.source;

  // 전부 동시에 부른다. 줄 세워 부르면 한 화면에 대여섯 번의 왕복이 쌓인다.
  const [schedule, snapshot, standings, roster, injuries, postseason] = await Promise.all([
    espnSchedule(src),
    espnSnapshot(src),
    espnStandings(src),
    espnRoster(src),
    espnInjuries(src),
    espnPostseason(src),
  ]);
  if (schedule === null) return null;

  return [
    {
      key: "main",
      label: team.sport,
      ball: BALLS[team.sport.toLowerCase()] ?? "football",
      games: schedule.games,
      pastSeason: schedule.isPastSeason ? schedule.seasonYear : null,
      snapshot: snapshot ?? fallbackSnapshot(team),
      standings,
      roster,
      injuries,
      postseason,
      inSeason: true,
    },
  ];
}

/* ────────────────────────────── 학교 팀 ────────────────────────────── */

async function schoolPrograms(team: Team, src: SchoolSource): Promise<Fetched<Program[]>> {
  const built = await Promise.all(
    src.programs.map(async (p) => {
      const [games, standing, roster, postseason] = await Promise.all([
        sidearmSchedule(src, p.sportId),
        maxprepsTeam(src.maxpreps, p.maxprepsSport),
        maxprepsRoster(src.maxpreps, p.maxprepsSport),
        maxprepsBracket(src.maxpreps, p.maxprepsSport, src.maxprepsName),
      ]);
      if (games === null) return null;

      /*
        한 줄에 리그 순위와 전국·주 랭킹을 같이 적는다 — "1st in Trinity · No. 9 in California".
        트리니티 리그는 해마다 전국 순위에 올라오는 리그라, 이 팀 팬에게는 리그 안 순위만큼이나
        밖에서 몇 등인지가 궁금하다. 랭킹은 두 개까지만 — 여섯 개를 늘어놓으면 아무것도 안 읽힌다.
      */
      const bits: string[] = [];
      if (standing?.leaguePlacement && standing.leagueName) {
        bits.push(`${standing.leaguePlacement} in ${standing.leagueName}`);
      }
      for (const r of standing?.rankings.slice(0, 2) ?? []) bits.push(`No. ${r.rank} in ${r.scope}`);

      const standings =
        standing?.leagueUrl
          ? await maxprepsStandings(
              standing.leagueUrl,
              src.maxprepsName,
              standing.leagueName ? `${standing.leagueName} League` : "League",
            )
          : [];

      return {
        key: p.key,
        label: p.label,
        ball: BALLS[p.key] ?? "football",
        games,
        pastSeason: null,
        snapshot: {
          // 학교 피드는 전적을 안 준다. MaxPreps 가 주면 그걸, 아니면 결과에서 직접 센다.
          record: standing?.record ?? recordOf(games),
          standingSummary: bits.length ? bits.join(" · ") : null,
          logo: team.logo,
          venue: team.homeVenue,
          venueCity: null,
        } satisfies TeamSnapshot,
        standings,
        roster: roster === null ? null : { coaches: [], players: roster },
        injuries: [],
        postseason,
        // 전적이 올라와 있는 쪽이 지금 하는 종목이다. 비시즌에는 MaxPreps 도 비워 둔다.
        inSeason: !!standing?.record,
      } satisfies Program;
    }),
  );

  const got = built.filter((p) => p !== null);
  // 하나라도 받았으면 그것만으로 그린다. 한 종목이 실패했다고 나머지를 버리지 않는다.
  return got.length > 0 ? got : null;
}

/**
 * 이 팀의 종목들.
 *
 * **null 은 "못 가져왔다" 이고, 빈 경기 배열은 "경기가 없다" 이다.** 비시즌(야구는 가을에
 * 0건)과 남의 서버가 흔들린 순간을 화면이 같게 그리면 안 된다.
 */
export async function getPrograms(team: Team): Promise<Fetched<Program[]>> {
  return team.source.kind === "espn" ? espnProgram(team) : schoolPrograms(team, team.source);
}

/** 화면을 열었을 때 먼저 보여 줄 종목. 시즌 중인 것, 없으면 첫 번째. */
export function defaultProgram(programs: Program[]): Program | null {
  return programs.find((p) => p.inSeason) ?? programs[0] ?? null;
}

/* ────────────────────────────── 종목과 상관없는 것 ────────────────────────────── */

export async function getNews(team: Team, limit = 20): Promise<Fetched<Article[]>> {
  if (team.source.kind === "espn") return espnNews(team.source, limit);
  // 학교 기사는 종목을 안 가린다. 학교가 하나고 기사도 몇 개 안 된다.
  return sidearmNews(team.source, limit);
}

export async function getLive(team: Team): Promise<Fetched<Game | null>> {
  if (team.source.kind !== "espn") return null;
  return espnLive(team.source);
}

/* ────────────────────────────── 홈 화면 ────────────────────────────── */

export type ShelfCard = {
  team: Team;
  snapshot: TeamSnapshot;
  record: string | null;
  next: Game | null;
  live: Game | null;
  last: Game | null;
  /** 일정을 아예 못 가져왔다. 화면이 "경기 없음" 이 아니라 그렇게 적는다. */
  scheduleFailed: boolean;
};

/**
 * 서가 한 장에 필요한 것만.
 *
 * 종목이 둘인 팀은 **지금 하는 종목**으로 표지를 그린다 — 가을의 표지에 야구 전적이
 * 적혀 있으면 서가를 훑는 사람이 한 번 멈칫한다.
 */
export async function getShelfCard(team: Team): Promise<ShelfCard> {
  const programs = await getPrograms(team);
  if (programs === null) {
    const snapshot = fallbackSnapshot(team);
    return { team, snapshot, record: null, next: null, live: null, last: null, scheduleFailed: true };
  }

  const active = defaultProgram(programs);
  const split = splitSchedule(programs.flatMap((p) => p.games));
  const snapshot = active?.snapshot ?? fallbackSnapshot(team);

  return {
    team,
    snapshot,
    record: snapshot.record ?? recordOf(split.finished),
    next: split.next,
    live: split.live,
    last: split.last,
    scheduleFailed: false,
  };
}
