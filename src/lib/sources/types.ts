/**
 * 어느 출처에서 왔든 화면은 이 모양만 안다.
 *
 * ESPN 이 주는 것과 학교 캘린더가 주는 것은 풍부함이 다르다 — 고등학교 일정에는 상대 팀
 * 로고도, 로스터도, 스탠딩도 없다. **없는 것은 null 로 온다.** 화면은 null 을 보고 그 칸을
 * 통째로 접는다. 비어 있는 것과 없는 것을 같게 그리면, 쓰는 사람은 앱이 고장 난 줄 안다.
 */

/** 못 가져온 것(null)과 없는 것([])은 다르다. 이 구분을 끝까지 들고 간다. */
export type Fetched<T> = T | null;

export type GameStatus = "scheduled" | "in" | "final" | "postponed";

export type Opponent = {
  name: string;
  shortName: string | null;
  logo: string | null;
};

export type Game = {
  /** 출처 안에서의 id. 화면의 key 로 쓴다. */
  id: string;
  startsAt: string | null;
  /** 시각이 아직 안 정해진 경기(TBD). 날짜만 있고 시간이 없다. */
  timeTbd: boolean;
  opponent: Opponent;
  isHome: boolean | null;
  neutralSite: boolean;
  status: GameStatus;
  /** 우리 팀 점수 / 상대 점수. 안 끝났으면 null. */
  ourScore: number | null;
  theirScore: number | null;
  result: "W" | "L" | "T" | null;
  venue: string | null;
  /** 중계 채널 — "CBS", "ESPN+". */
  broadcast: string | null;
  /** 그 경기가 무엇인지 한 줄 — "Week 2", "Trinity League", "Preseason". */
  note: string | null;
  /** 진행 중일 때만 — "Top 7th", "3rd Quarter 4:21". */
  statusDetail: string | null;
  /** 티켓·중계 같은 바깥 링크. 없으면 빈 배열. */
  links: { label: string; url: string }[];
};

export type Player = {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  positionGroup: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  experience: string | null;
  college: string | null;
  hometown: string | null;
  headshot: string | null;
  /** 지금 다친 상태면 한 줄. 골수팬이 제일 먼저 보는 칸이다. */
  injury: string | null;
};

export type Coach = {
  name: string;
  title: string;
  experience: string | null;
};

export type Article = {
  id: string;
  headline: string;
  description: string | null;
  publishedAt: string | null;
  url: string | null;
  image: string | null;
  /** "Story" | "Media"(영상) — 영상은 화면에서 다르게 그린다. */
  kind: string | null;
  byline: string | null;
};

export type StandingsRow = {
  teamId: string | null;
  name: string;
  abbreviation: string | null;
  logo: string | null;
  isUs: boolean;
  /** 리그마다 뜻이 다른 칸들. 있는 것만 채운다. */
  wins: number | null;
  losses: number | null;
  ties: number | null;
  winPercent: string | null;
  gamesBehind: string | null;
  streak: string | null;
  points: number | null;
  playoffSeed: number | null;
  /** 득실 — "+15". */
  differential: string | null;
};

export type StandingsGroup = {
  /** "AFC West", "Mountain West", "Big West". */
  name: string;
  /** 그 위 묶음 — "American Football Conference". 없으면 null. */
  parent: string | null;
  rows: StandingsRow[];
  /**
   * 우리가 실제 순위대로 줄을 세웠는가(`orderStandings`).
   *
   * 개막 전이라 전부 0이면 세울 근거가 없다. 그때 화면이 순위 번호를 붙이면 **모르는 것을
   * 아는 척하는 것**이 된다 — 순서 없이 온 표를 그대로 그려서 에인절스를 2위로 적었던 것과
   * 같은 잘못이다.
   */
  ordered: boolean;
};

/** 팀 현재 상태 한 장. 팀 화면 맨 위 히어로가 이걸로 그려진다. */
export type TeamSnapshot = {
  record: string | null;
  /** "2nd in AFC West" 같은 ESPN 의 한 줄. */
  standingSummary: string | null;
  logo: string | null;
  venue: string | null;
  venueCity: string | null;
};
