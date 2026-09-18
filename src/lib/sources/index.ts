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
import { sidearmNews, sidearmSchedule } from "./sidearm";
import { recordOf, splitPrograms } from "./split";
import { fallbackSnapshot, type Team } from "./teams";
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

export async function getSnapshot(team: Team): Promise<TeamSnapshot> {
  if (team.source.kind !== "espn") return fallbackSnapshot(team);
  const snap = await espnSnapshot(team.source);
  return snap ?? fallbackSnapshot(team);
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
  // 학교 사이트는 로스터를 내보내는 문이 없다. 없는 것은 없다고 말한다 — 화면이 탭을 접는다.
  if (team.source.kind !== "espn") return { coaches: [], players: [] };
  return espnRoster(team.source);
}

export async function getNews(team: Team, limit = 20): Promise<Fetched<Article[]>> {
  if (team.source.kind === "espn") return espnNews(team.source, limit);
  return sidearmNews(team.source, limit);
}

export async function getStandings(team: Team): Promise<Fetched<StandingsGroup[]>> {
  if (team.source.kind !== "espn") return [];
  return espnStandings(team.source);
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
