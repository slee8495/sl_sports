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
  /** 우리 팀 점수 / 상대 점수. 하는 중이면 지금 점수, 시작 전이면 null. 승패는 `result`. */
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
  /**
   * 리그(컨퍼런스) 안에서의 전적 — "0-0".
   *
   * 대학은 **전체 전적과 컨퍼런스 전적이 다른 이야기다.** 비컨퍼런스 경기를 몇 개 치르고
   * 나서야 리그 경기가 시작되고, 순위를 가르는 것은 뒤쪽이다. 없는 리그에서는 null 이라
   * 화면이 칸을 안 그린다.
   */
  conferenceRecord: string | null;
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

/* ────────────────────────────── 포스트시즌 ────────────────────────────── */

/**
 * 브래킷의 한 자리.
 *
 * **우리 팀이 없는 브래킷도 그린다.** 리그의 포스트시즌은 우리 팀이 떨어져도 계속되고,
 * 골수팬은 그것도 본다 — 누가 우리를 떨어뜨렸는지, 그 팀이 어디까지 가는지.
 */
export type BracketTeam = {
  /** 출처 안의 팀 id. 학교 브래킷에는 없다. */
  id: string | null;
  name: string;
  shortName: string | null;
  logo: string | null;
  /** 시드. 리그가 안 주면(MLB·NBA 의 ESPN 데이터) null — 짓지 않는다. */
  seed: number | null;
  isUs: boolean;
  /** 시리즈면 이긴 경기 수, 단판이면 점수. 아직 안 했으면 null. */
  score: number | null;
  /** 이 매치업을 이기고 올라갔다. 안 끝났으면 false. */
  won: boolean;
};

export type Matchup = {
  id: string;
  /** 이 매치업이 속한 쪽 — "AL", "East", "AFC", "West Region". 없으면 null. */
  group: string | null;
  /** 단판의 이름 — "Rose Bowl", "7th vs 8th". 없으면 null. */
  label: string | null;
  /** 두 자리. **아직 안 정해진 자리는 null 이다** — "Winner G3" 를 팀처럼 그리지 않는다. */
  teams: [BracketTeam | null, BracketTeam | null];
  /** 7전 4선승 같은 시리즈인가. 점수 칸이 이긴 경기 수인지 득점인지가 여기서 갈린다. */
  series: boolean;
  status: GameStatus;
  /** 진행 중이거나 다음에 열릴 경기의 시각. 끝났으면 마지막 경기 시각. */
  startsAt: string | null;
  /** 한 줄 — "LAD win series 3-1", "Game 3 · Top 7th". */
  detail: string | null;
  /**
   * **지금 하는 경기의 점수**, `teams` 와 같은 순서. 하는 중이 아니면 null.
   *
   * 시리즈에서는 `score` 가 이긴 경기 수라서, 지금 7회에 3-2 로 앞서고 있다는 건 거기 없다.
   * 그게 이 칸이다. 단판이면 `score` 와 같은 값이다.
   */
  live: [number | null, number | null] | null;
  /**
   * 브래킷 나무에서의 자리(그 라운드 안, 위에서부터). 모르면 null — 그때는 화면이 시드와
   * 다음 라운드와의 연결로 자리를 찾는다(`layoutBracket`).
   */
  slot: number | null;
};

export type BracketRound = {
  /** "Division Series", "Quarterfinal", "Elite 8". */
  name: string;
  /**
   * 브래킷 앞에 따로 치르는 판 — NBA 플레이인, NCAA First Four. 나무에 안 들어가고
   * 브래킷 위에 따로 그린다.
   */
  pre: boolean;
  /** 아직 안 열린 라운드는 빈 배열이다. 화면은 빈 칸(TBD)으로 자리를 그린다. */
  matchups: Matchup[];
};
