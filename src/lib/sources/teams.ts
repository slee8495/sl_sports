/**
 * 내가 응원하는 팀들. **여기가 유일한 표다.**
 *
 * 팀을 더하거나 빼는 일이 여기 한 줄을 고치는 일이어야 한다 — 주소를 여러 곳에 흩어 놓으면
 * 언젠가 한쪽만 고쳐지고, 화면에는 있는데 안 가져와지는 팀이 생긴다.
 *
 * ## 출처가 둘인 이유
 *
 * 프로·대학은 **ESPN 공개 JSON** 이 전부 준다 — 키가 없고, 모델을 안 태우니 비용이 0 이고,
 * 지어낼 자리가 없다. 고등학교는 ESPN 에 아예 없다(검색해도 0건). 그래서 오렌지 루터란은
 * **학교 공식 athletics 사이트의 캘린더 피드(.ics)** 를 읽는다. 상대·홈/원정·결과·구장·
 * 중계 링크까지 거기 다 있고, 역시 공짜다.
 */

import type { TeamSnapshot } from "./types";

export type Level = "pro" | "college" | "hs";

/** ESPN 에서 오는 팀. `path` 는 주소의 가운데 — "football/nfl". */
export type EspnSource = {
  kind: "espn";
  path: string;
  teamId: string;
  /**
   * 스탠딩을 어느 깊이로 받나. 1=리그, 2=컨퍼런스, 3=디비전.
   * NFL 은 디비전(3)이 뜻이 있고, 대학은 컨퍼런스(2)가 그 자리다.
   */
  standingsLevel: number;
};

/**
 * 학교 팀. **문이 두 개다.**
 *
 * 학교 공식 사이트(SIDEARM)는 일정과 학교 기사를 내보내고, 전적·리그 순위표·로스터는
 * MaxPreps 가 들고 있다. 둘 다 읽어야 이 팀 화면이 다른 여섯 팀만큼 채워진다.
 */
export type SchoolSource = {
  kind: "school";
  /** 학교 공식 athletics 사이트 — 캘린더(.ics)와 RSS. */
  host: string;
  /** MaxPreps 의 이 팀 주소 앞부분. 뒤에 종목과 /roster/ 가 붙는다. */
  maxpreps: string;
  /** MaxPreps 순위표에서 우리를 찾을 때 쓰는 이름. 학교 사이트의 이름과 다를 수 있다. */
  maxprepsName: string;
  programs: {
    key: string;
    label: string;
    /** 학교 캘린더의 종목 번호. */
    sportId: number;
    /** MaxPreps 주소의 종목 조각. */
    maxprepsSport: string;
  }[];
};

export type Source = EspnSource | SchoolSource;

export type Team = {
  /** 주소에 쓰는 키. */
  slug: string;
  /** 화면에 크게 뜨는 이름. */
  name: string;
  /** 좁은 자리에서 쓰는 짧은 이름. */
  shortName: string;
  /** 마스코트만 — "Rams", "Lancers". */
  nickname: string;
  league: string;
  level: Level;
  sport: string;
  /** 홈 화면 서가를 나누는 기준. */
  shelf: string;
  colors: {
    /** 서가의 책등 색. 이 팀을 '읽지 않고 아는' 색이다. */
    primary: string;
    secondary: string;
    /** primary 위에 글씨를 올릴 때 쓰는 색. 밝은 팀색 위의 흰 글씨를 막는다. */
    onPrimary: string;
  };
  /** 로고. ESPN CDN 이거나 우리가 받아 둔 파일. */
  logo: string;
  homeVenue: string | null;
  /**
   * 표를 파는 곳. **홈경기에만 뜬다** — 원정 경기 티켓은 상대 구단이 판다.
   *
   * 경기별 링크를 쓰지 않는 이유: ESPN 은 오늘 경기에만 티켓 링크를 주고, 그 링크는
   * 재판매 사이트다. 구단 공식 페이지 한 줄이 늘 살아 있고, 날짜는 거기서 고르면 된다.
   * 확인한 값이고(2026-09-18 전부 200), 리다이렉트도 제대로 따라간다.
   */
  ticketsUrl: string | null;
  source: Source;
  /** 이 팀에 대해 화면 맨 위에 늘 뜨는 한 줄. 골수팬이면 아는 것. */
  tagline: string;
};

export const TEAMS: Team[] = [
  {
    slug: "rams",
    name: "Los Angeles Rams",
    shortName: "Rams",
    nickname: "Rams",
    league: "NFL",
    level: "pro",
    sport: "Football",
    shelf: "Pro",
    colors: { primary: "#003594", secondary: "#FFD100", onPrimary: "#FFFFFF" },
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png",
    homeVenue: "SoFi Stadium",
    ticketsUrl: "https://www.therams.com/tickets/",
    source: { kind: "espn", path: "football/nfl", teamId: "14", standingsLevel: 3 },
    tagline: "Whose House? Rams House",
  },
  {
    slug: "dodgers",
    name: "Los Angeles Dodgers",
    shortName: "Dodgers",
    nickname: "Blue Crew",
    league: "MLB",
    level: "pro",
    sport: "Baseball",
    shelf: "Pro",
    colors: { primary: "#005A9C", secondary: "#EF3E42", onPrimary: "#FFFFFF" },
    logo: "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png",
    homeVenue: "Dodger Stadium",
    ticketsUrl: "https://www.mlb.com/dodgers/tickets",
    source: { kind: "espn", path: "baseball/mlb", teamId: "19", standingsLevel: 3 },
    tagline: "Bleed Dodger Blue",
  },
  {
    slug: "clippers",
    name: "LA Clippers",
    shortName: "Clippers",
    nickname: "Clips",
    league: "NBA",
    level: "pro",
    sport: "Basketball",
    shelf: "Pro",
    colors: { primary: "#1D428A", secondary: "#C8102E", onPrimary: "#FFFFFF" },
    logo: "https://a.espncdn.com/i/teamlogos/nba/500/lac.png",
    homeVenue: "Intuit Dome",
    ticketsUrl: "https://www.nba.com/clippers/tickets",
    source: { kind: "espn", path: "basketball/nba", teamId: "12", standingsLevel: 3 },
    tagline: "It Takes Everything",
  },
  {
    slug: "ducks",
    name: "Anaheim Ducks",
    shortName: "Ducks",
    nickname: "Ducks",
    league: "NHL",
    level: "pro",
    sport: "Hockey",
    shelf: "Pro",
    colors: { primary: "#FC4C02", secondary: "#B9975B", onPrimary: "#FFFFFF" },
    logo: "https://a.espncdn.com/i/teamlogos/nhl/500/ana.png",
    homeVenue: "Honda Center",
    ticketsUrl: "https://www.nhl.com/ducks/tickets",
    source: { kind: "espn", path: "hockey/nhl", teamId: "25", standingsLevel: 3 },
    tagline: "Fear the Wings",
  },
  {
    slug: "aztecs",
    name: "San Diego State Aztecs",
    shortName: "SDSU",
    nickname: "Aztecs",
    league: "Pac-12 · NCAA Football",
    level: "college",
    sport: "Football",
    shelf: "College",
    colors: { primary: "#A6192E", secondary: "#000000", onPrimary: "#FFFFFF" },
    logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/21.png",
    homeVenue: "Snapdragon Stadium",
    ticketsUrl: "https://goaztecs.com/tickets",
    source: { kind: "espn", path: "football/college-football", teamId: "21", standingsLevel: 2 },
    tagline: "I Believe That We Will Win",
  },
  {
    slug: "tritons",
    name: "UC San Diego Tritons",
    shortName: "UCSD",
    nickname: "Tritons",
    league: "Big West · NCAA Basketball",
    level: "college",
    sport: "Basketball",
    shelf: "College",
    colors: { primary: "#182B49", secondary: "#FFCD00", onPrimary: "#FFFFFF" },
    logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/28.png",
    homeVenue: "LionTree Arena",
    ticketsUrl: "https://ucsdtritons.com/tickets",
    source: {
      kind: "espn",
      path: "basketball/mens-college-basketball",
      teamId: "28",
      standingsLevel: 2,
    },
    tagline: "Go Tritons",
  },
  {
    slug: "lancers",
    name: "Orange Lutheran Lancers",
    shortName: "Orange Lutheran",
    nickname: "Lancers",
    league: "Trinity League · CIF-SS",
    level: "hs",
    sport: "Football · Baseball",
    shelf: "High School",
    colors: { primary: "#CC0022", secondary: "#1B1B1B", onPrimary: "#FFFFFF" },
    logo: "/logos/orange-lutheran.webp",
    homeVenue: null,
    ticketsUrl: "https://gofan.co/app/school/CA18913",
    source: {
      kind: "school",
      host: "https://oluathletics.org",
      maxpreps: "https://www.maxpreps.com/ca/orange/orange-lutheran-lancers",
      maxprepsName: "Orange Lutheran",
      /*
        sport_id 는 학교 사이트가 정한 번호다. 눈으로 확인한 값이고(피드의 CALNAME 이
        종목 이름을 그대로 준다), 바뀌면 화면이 빈다 — 그때는 `?sport_id=` 를 0 부터
        훑어 CALNAME 을 읽으면 된다.
      */
      programs: [
        { key: "football", label: "Football", sportId: 3, maxprepsSport: "football" },
        { key: "baseball", label: "Baseball", sportId: 1, maxprepsSport: "baseball" },
      ],
    },
    tagline: "Lancer Nation",
  },
];

export function findTeam(slug: string): Team | null {
  return TEAMS.find((t) => t.slug === slug) ?? null;
}

/** 홈 화면의 서가 순서. 표에 없는 선반은 안 그린다. */
export const SHELVES = ["Pro", "College", "High School"] as const;

export function teamsByShelf(): { shelf: string; teams: Team[] }[] {
  return SHELVES.map((shelf) => ({
    shelf,
    teams: TEAMS.filter((t) => t.shelf === shelf),
  })).filter((s) => s.teams.length > 0);
}

/** 출처가 스냅샷을 못 줄 때 표에 있는 것만이라도 채운다. */
export function fallbackSnapshot(team: Team): TeamSnapshot {
  return {
    record: null,
    standingSummary: null,
    logo: team.logo,
    venue: team.homeVenue,
    venueCity: null,
  };
}
