/**
 * 화면이 부르는 창구.
 *
 * 팀이 ESPN 에서 오는지 학교 캘린더에서 오는지는 **여기서 갈리고 여기서 끝난다.** 페이지는
 * `getSchedule(team)` 만 부르고, 어디서 왔는지 모른다 — 나중에 출처가 하나 더 늘어도
 * 화면은 안 고친다.
 */

import {
  espnInjuries,
  espnLive,
  espnNews,
  espnRoster,
  espnSchedule,
  espnSnapshot,
  espnStandings,
  type Injury,
  type Roster,
} from "./espn";
import { maxprepsRoster, maxprepsStandings, maxprepsTeam, type SchoolStanding } from "./maxpreps";
import { sidearmNews, sidearmSchedule } from "./sidearm";
import { recordOf, splitPrograms } from "./split";
import { fallbackSnapshot, type SchoolSource, type Team } from "./teams";
import type { Article, Fetched, Game, StandingsGroup, TeamSnapshot } from "./types";

export type { Injury, Roster };

/** 한 팀 안의 종목 하나. ESPN 팀은 늘 하나고, 오렌지 루터란은 풋볼·야구 둘이다. */
export type Program = {
  key: string;
  label: string;
  games: Game[];
  /** 이번 시즌이 아직 안 열려서 지난 시즌을 보여 주는 중이면 그 해. 아니면 null. */
  pastSeason: number | null;
};

/**
 * 지금 시즌인 종목.
 *
 * 오렌지 루터란은 풋볼과 야구를 같이 챙긴다. 가을에 야구 순위표를, 봄에 풋볼 순위표를
 * 보여 주면 틀린 건 아니어도 **지금 궁금한 게 아니다.** MaxPreps 가 전적을 주는 쪽이
 * 곧 지금 하는 종목이라, 달력을 따로 들고 있지 않아도 된다(비시즌에는 전적이 null 이다).
 */
async function inSeason(src: SchoolSource): Promise<{ sport: string; standing: SchoolStanding | null }> {
  const found = await Promise.all(
    src.programs.map(async (p) => ({ sport: p.maxprepsSport, standing: await maxprepsTeam(src.maxpreps, p.maxprepsSport) })),
  );
  const live = found.find((f) => f.standing?.record);
  return live ?? found[0] ?? { sport: src.programs[0]?.maxprepsSport ?? "", standing: null };
}

export async function getSnapshot(team: Team): Promise<TeamSnapshot> {
  if (team.source.kind === "espn") {
    const snap = await espnSnapshot(team.source);
    return snap ?? fallbackSnapshot(team);
  }

  const { standing } = await inSeason(team.source);
  if (!standing) return fallbackSnapshot(team);

  /*
    한 줄에 리그 순위와 전국/주 랭킹을 같이 적는다 — "1st in Trinity · No. 9 in California".
    트리니티 리그는 해마다 전국 순위에 올라오는 리그라, 이 팀 팬에게는 리그 안 순위만큼이나
    밖에서 몇 등인지가 궁금한 것이다. 랭킹은 두 개까지만 — 여섯 개를 늘어놓으면 아무것도 안 읽힌다.
  */
  const bits: string[] = [];
  if (standing.leaguePlacement && standing.leagueName) {
    bits.push(`${standing.leaguePlacement} in ${standing.leagueName}`);
  }
  for (const r of standing.rankings.slice(0, 2)) bits.push(`No. ${r.rank} in ${r.scope}`);

  return {
    record: standing.record,
    standingSummary: bits.length ? bits.join(" · ") : null,
    logo: team.logo,
    venue: team.homeVenue,
    venueCity: null,
  };
}

/**
 * 일정.
 *
 * **null 은 "못 가져왔다" 이고, 빈 배열은 "경기가 없다" 이다.** 비시즌(야구는 가을에 0건)과
 * 남의 서버가 흔들린 순간을 화면이 같게 그리면 안 된다.
 */
export async function getSchedule(team: Team): Promise<Fetched<Program[]>> {
  if (team.source.kind === "espn") {
    const schedule = await espnSchedule(team.source);
    if (schedule === null) return null;
    return [
      {
        key: "main",
        label: team.sport,
        games: schedule.games,
        pastSeason: schedule.isPastSeason ? schedule.seasonYear : null,
      },
    ];
  }

  const src = team.source;
  const results = await Promise.all(
    src.programs.map(async (p) => ({ p, games: await sidearmSchedule(src, p.sportId) })),
  );
  // 하나라도 받았으면 그것만으로 그린다. 한 종목이 실패했다고 나머지를 버리지 않는다.
  if (results.every((r) => r.games === null)) return null;
  return results
    .filter((r) => r.games !== null)
    .map((r) => ({ key: r.p.key, label: r.p.label, games: r.games as Game[], pastSeason: null }));
}

export async function getRoster(team: Team): Promise<Fetched<Roster>> {
  if (team.source.kind === "espn") return espnRoster(team.source);

  // 학교 공식 사이트는 로스터를 안 내보낸다. MaxPreps 가 들고 있다(코치진은 거기에도 없다).
  const { sport } = await inSeason(team.source);
  const players = await maxprepsRoster(team.source.maxpreps, sport);
  if (players === null) return null;
  return { coaches: [], players };
}

export async function getNews(team: Team, limit = 20): Promise<Fetched<Article[]>> {
  if (team.source.kind === "espn") return espnNews(team.source, limit);
  return sidearmNews(team.source, limit);
}

export async function getStandings(team: Team): Promise<Fetched<StandingsGroup[]>> {
  if (team.source.kind === "espn") return espnStandings(team.source);

  const { standing } = await inSeason(team.source);
  if (!standing?.leagueUrl) return [];
  const label = standing.leagueName ? `${standing.leagueName} League` : "League";
  return maxprepsStandings(standing.leagueUrl, team.source.maxprepsName, label);
}

export async function getInjuries(team: Team): Promise<Fetched<Injury[]>> {
  if (team.source.kind !== "espn") return [];
  return espnInjuries(team.source);
}

export async function getLive(team: Team): Promise<Fetched<Game | null>> {
  if (team.source.kind !== "espn") return null;
  return espnLive(team.source);
}

export { splitSchedule, splitPrograms, type ScheduleSplit } from "./split";

/* ────────────────────────────── 홈 화면 ────────────────────────────── */

export type ShelfCard = {
  team: Team;
  snapshot: TeamSnapshot;
  /** 전적. 출처가 안 주면 끝난 경기에서 센다(학교 캘린더가 그렇다). */
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
 * 팀마다 두어 번씩 남의 서버를 부르지만 **전부 동시에** 부른다 — 줄 세워 부르면 홈 화면이
 * 팀 수만큼 느려진다. 캐시가 받아 주므로 대부분의 방문은 아예 안 나간다.
 */
export async function getShelfCard(team: Team): Promise<ShelfCard> {
  const [snapshot, programs] = await Promise.all([getSnapshot(team), getSchedule(team)]);
  if (programs === null) {
    return { team, snapshot, record: snapshot.record, next: null, live: null, last: null, scheduleFailed: true };
  }
  const split = splitPrograms(programs);
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
