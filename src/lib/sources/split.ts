/**
 * 일정을 쓸모별로 가르는 셈.
 *
 * **바깥을 안 부른다.** 그래서 브라우저 쪽 코드도 이 파일만 들여올 수 있다 — 창구(`index.ts`)
 * 를 통째로 들여오면 fetch 하는 어댑터가 브라우저 묶음에 딸려 들어간다.
 */

import type { Game } from "./types";

/* ────────────────────────────── 일정 가르기 ────────────────────────────── */

export type ScheduleSplit = {
  /** 지금 하는 중인 경기. */
  live: Game | null;
  /** 바로 다음 경기. 팀 화면 맨 위에 크게 뜬다. */
  next: Game | null;
  /** 다음 홈경기. 직접 보러 갈 수 있는 유일한 경기라 따로 뽑는다. */
  nextHome: Game | null;
  /** 가장 최근에 끝난 경기. */
  last: Game | null;
  upcoming: Game[];
  finished: Game[];
};

/**
 * 한 줄로 온 일정을 쓸모별로 가른다.
 *
 * **다음 홈경기를 따로 뽑는 이유**: 원정 여섯 경기가 줄줄이 있으면 "다음 경기" 만 봐서는
 * 언제 경기장에 갈 수 있는지 알 수 없다. 티켓을 사는 사람에게는 그게 제일 중요한 한 줄이다.
 */
export function splitSchedule(games: Game[]): ScheduleSplit {
  const sorted = [...games].sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  const live = sorted.find((g) => g.status === "in") ?? null;
  const finished = sorted.filter((g) => g.status === "final");
  const upcoming = sorted.filter((g) => g.status === "scheduled" || g.status === "postponed");

  return {
    live,
    next: upcoming[0] ?? null,
    nextHome: upcoming.find((g) => g.isHome === true) ?? null,
    last: finished[finished.length - 1] ?? null,
    upcoming,
    finished,
  };
}

/**
 * 여러 종목을 한 줄로 합쳐서 가른다 — 오렌지 루터란의 "다음 경기" 는 풋볼일 수도 야구일 수도 있다.
 *
 * `Program` 을 통째로 받지 않고 경기 목록만 본다. 종목의 이름표까지 알 필요가 없고,
 * 모르면 창구 쪽 타입에 얽히지 않는다.
 */
export function splitPrograms(programs: { games: Game[] }[]): ScheduleSplit {
  return splitSchedule(programs.flatMap((p) => p.games));
}


/**
 * 끝난 경기에서 전적을 센다.
 *
 * ESPN 팀은 전적을 그냥 주지만 **학교 캘린더는 안 준다.** 그렇다고 배너에서 전적 칸만 비워
 * 두면, 3승 1패로 잘 가고 있는 시즌이 화면에는 아무 일도 없는 것처럼 보인다. 결과가 이미
 * 손에 있으니 세면 된다.
 */
export function recordOf(games: Game[]): string | null {
  const w = games.filter((g) => g.result === "W").length;
  const l = games.filter((g) => g.result === "L").length;
  const t = games.filter((g) => g.result === "T").length;
  if (w + l + t === 0) return null;
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

/**
 * 순위표를 실제 순위대로 세운다.
 *
 * **ESPN 은 순서를 안 지키고 보낸다.** 2026-09-18 의 AL West 는 애슬레틱스 → 에인절스 →
 * 애스트로스 순으로 왔는데, 실제로는 애스트로스가 1위고 에인절스가 꼴찌(59-94, 18게임 차)다.
 * 받은 순서를 그대로 그렸더니 화면이 **에인절스를 지구 2위로 적고 있었다**(소유자가 잡았다).
 *
 * 리그마다 순위를 정하는 것이 다르므로 있는 신호를 순서대로 쓴다.
 *
 * 1. **플레이오프 시드** — 전부 채워져 있으면 이게 가장 정확하다. 리그가 직접 매긴 순서고,
 *    같은 승률이라도 타이브레이커까지 반영돼 있다.
 * 2. **승점** — 하키처럼 승수가 아니라 점수로 줄을 세우는 리그.
 * 3. **승률, 그다음 승수** — 나머지 전부.
 * 4. 아무 신호도 없으면(개막 전이라 전부 0) **줄을 세우지 않는다.** 그때는 화면도 번호를
 *    안 붙인다 — 모르는 순서에 1, 2, 3 을 적는 것이 지금 고친 바로 그 잘못이다.
 */
export function orderStandings<T extends {
  playoffSeed: number | null;
  points: number | null;
  winPercent: string | null;
  wins: number | null;
  losses: number | null;
}>(rows: T[]): { rows: T[]; ordered: boolean } {
  if (rows.length === 0) return { rows, ordered: false };

  if (rows.every((r) => (r.playoffSeed ?? 0) > 0)) {
    return { rows: [...rows].sort((a, b) => (a.playoffSeed ?? 0) - (b.playoffSeed ?? 0)), ordered: true };
  }

  if (rows.some((r) => (r.points ?? 0) > 0)) {
    return { rows: [...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)), ordered: true };
  }

  // ".386" 처럼 앞의 0 이 빠진 채로 온다. Number(".386") 은 0.386 이라 그대로 읽힌다.
  const pct = (r: T) => (r.winPercent == null ? null : Number(r.winPercent));
  const played = rows.some((r) => (r.wins ?? 0) + (r.losses ?? 0) > 0);
  if (played && rows.some((r) => pct(r) != null && Number.isFinite(pct(r) as number))) {
    return {
      rows: [...rows].sort((a, b) => {
        const d = (pct(b) ?? 0) - (pct(a) ?? 0);
        return d !== 0 ? d : (b.wins ?? 0) - (a.wins ?? 0);
      }),
      ordered: true,
    };
  }

  return { rows, ordered: false };
}
