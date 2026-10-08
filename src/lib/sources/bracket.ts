/**
 * 브래킷을 세우는 셈.
 *
 * **바깥을 안 부른다** — `split.ts` 와 같은 이유로, 화면 쪽 코드도 이 파일을 들여올 수 있다.
 */

import type { BracketRound, BracketTeam, Matchup } from "./types";

const names = (m: Matchup) => m.teams.filter((t): t is BracketTeam => t !== null).map((t) => t.name);

/**
 * 라운드를 시간 순으로, 매치업을 나무 순으로 세운다.
 *
 * ESPN 은 브래킷을 안 준다. 날짜별 경기만 준다. 그래서 라운드는 **첫 경기가 열린 날**로
 * 줄을 세우고, 한 라운드 안의 매치업은 묶음(AL/NL, East/West) 안에서 **다음 라운드에서
 * 만나는 것끼리 붙여 둔다.** 다음 라운드가 아직 없으면 날짜 순이다.
 *
 * 나무 그림의 자리는 이것으로 정하지 않는다(`layoutBracket`). 이 순서는 목록으로 그릴 때 쓴다.
 */
export function orderBracket(rounds: BracketRound[]): BracketRound[] {
  const first = (r: BracketRound) =>
    r.matchups.reduce<string | null>((min, m) => (m.startsAt && (!min || m.startsAt < min) ? m.startsAt : min), null);

  const sorted = [...rounds].sort((a, b) => (first(a) ?? "9").localeCompare(first(b) ?? "9"));

  const groupOrder = new Map<string, number>();
  for (const r of sorted) for (const m of r.matchups) if (m.group && !groupOrder.has(m.group)) groupOrder.set(m.group, groupOrder.size);

  const out: BracketRound[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const next = out[0];
    const slot = (m: Matchup) => {
      if (!next) return Infinity;
      const ns = names(m);
      const at = next.matchups.findIndex((n) => n.teams.some((t) => t && ns.includes(t.name)));
      return at === -1 ? Infinity : at;
    };
    // 묶음이 먼저다 — 플레이인처럼 다음 라운드와 이어지지 않는 칸도 East 는 East 끼리 모인다.
    const matchups = [...sorted[i].matchups].sort(
      (a, b) =>
        (groupOrder.get(a.group ?? "") ?? 99) - (groupOrder.get(b.group ?? "") ?? 99) ||
        slot(a) - slot(b) ||
        (a.startsAt ?? "").localeCompare(b.startsAt ?? ""),
    );
    out.unshift({ ...sorted[i], matchups });
  }
  return out;
}

/**
 * 화면을 열었을 때 먼저 보여 줄 라운드(목록으로 그릴 때).
 *
 * **지금 하는 라운드다** — 아직 안 끝난 매치업이 있는 첫 라운드. 다 끝났으면 경기가 있는
 * 마지막 라운드. 아직 안 열린 빈 라운드는 고르지 않는다.
 */
export function currentRound(rounds: BracketRound[]): number {
  const open = rounds.findIndex((r) => r.matchups.some((m) => m.status !== "final"));
  if (open !== -1) return open;
  for (let i = rounds.length - 1; i >= 0; i--) if (rounds[i].matchups.length > 0) return i;
  return 0;
}

/** 우승 팀. 마지막 라운드가 매치업 하나이고 끝났을 때만 — 그 전에는 모르는 것이다. */
export function championOf(rounds: BracketRound[]): BracketTeam | null {
  const main = rounds.filter((r) => !r.pre);
  const last = main[main.length - 1];
  if (!last || last.matchups.length !== 1) return null;
  const m = last.matchups[0];
  if (m.status !== "final") return null;
  return m.teams.find((t) => t?.won) ?? null;
}

/* ────────────────────────────── 나무 ────────────────────────────── */

/**
 * 시드가 브래킷에 놓이는 순서 — 1·8·4·5·2·7·3·6.
 *
 * 1번과 2번 시드가 결승 전에는 안 만나도록 반씩 갈라 놓는 표준 배치다. NBA·MLB·NFL·CFP·
 * NCAA 가 다 이걸 쓴다. 이걸로 **첫 라운드 매치업의 자리**가 나온다 — 다음 라운드가
 * 아직 없어도 누가 누구 승자와 만나는지 그릴 수 있다.
 */
export function seedOrder(n: number): number[] {
  let order = [1];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((s) => [s, size + 1 - s]);
  }
  return order;
}

export type Cell = {
  matchup: Matchup | null;
  /**
   * 부전승 자리. 상위 시드가 첫 라운드를 건너뛰는 리그(MLB·NFL·CFP)에서 첫 줄의 빈 자리는
   * 경기가 없는 자리다 — **"TBD" 상자로 그리면 안 열릴 경기를 기다리게 만든다.** 그래서 안 그린다.
   */
  bye: boolean;
};

export type BracketLayout = {
  /** 브래킷 앞의 판(플레이인, First Four). 나무 밖에 따로 그린다. */
  pre: BracketRound[];
  /**
   * 결승을 뺀 라운드들, 바깥(첫 라운드)에서 안쪽 순서. 칸은 브래킷 전체 폭이다 —
   * 앞의 반이 왼쪽, 뒤의 반이 오른쪽.
   */
  columns: { name: string; cells: Cell[] }[];
  final: { name: string; matchup: Matchup | null };
  /** 왼쪽·오른쪽 이름 — "WEST", "EAST". 묶음이 없으면 null. */
  sides: [string | null, string | null];
};

/**
 * 라운드 목록을 양쪽으로 펼친 나무로.
 *
 * 1. **첫 라운드**는 시드로 자리를 잡는다(`seedOrder`). 어댑터가 자리를 알려 주면(`slot`)
 *    그걸 쓴다 — NHL 은 디비전으로 짝을 짓고, MaxPreps 는 페이지 순서가 곧 자리다.
 * 2. **그다음 라운드**는 앞 라운드의 어느 두 칸에서 올라온 팀이 있는지로 자리를 찾는다.
 *    아직 안 열린 자리는 빈 상자(TBD)다.
 *
 * 나무 모양이 안 나오는 브래킷(라운드가 하나뿐이거나, 칸 수가 안 맞으면)은 null — 화면이
 * 목록으로 그린다. 어긋난 나무는 틀린 대진을 그린다.
 */
export function layoutBracket(rounds: BracketRound[]): BracketLayout | null {
  const pre = rounds.filter((r) => r.pre && r.matchups.length > 0);
  const main = rounds.filter((r) => !r.pre);
  const depth = main.length;
  if (depth < 2) return null;

  const leaves = 2 ** (depth - 1);
  if (main[0].matchups.length > leaves) return null;

  // 묶음(컨퍼런스·리그·지역)마다 첫 라운드의 연속된 구간을 맡는다. 서쪽을 왼쪽에 — 리그 그림이 그렇게 그린다.
  const groups: string[] = [];
  for (const m of main[0].matchups) if (m.group && !groups.includes(m.group)) groups.push(m.group);
  if (groups.includes("West") && groups.includes("East")) groups.sort((a, b) => (a === "West" ? -1 : b === "West" ? 1 : 0));
  /*
    **지역이 넷이면(NCAA) 어느 둘이 같은 쪽인지는 데이터가 알려 준다** — 위원회가 해마다 정하는
    짝이라 셈으로는 안 나온다(2026: West–Midwest, East–South). 묶음 없는 라운드(Final Four)에서
    서로 다른 지역 팀이 만난 경기가 있으면 그 둘을 붙여 놓는다. 그 전에는 나온 순서대로다.
  */
  if (groups.length === 4) {
    const groupOf = new Map<string, string>();
    for (const m of main[0].matchups) for (const n of names(m)) if (m.group) groupOf.set(n, m.group);
    const semi = main
      .slice(1)
      .flatMap((r) => r.matchups)
      .find((m) => !m.group && new Set(names(m).map((n) => groupOf.get(n))).size === 2);
    const pair = semi ? names(semi).map((n) => groupOf.get(n) as string) : null;
    if (pair && pair.every(Boolean)) {
      const rest = groups.filter((g) => !pair.includes(g));
      groups.splice(0, 4, ...pair, ...rest);
    }
  }
  const grouped = groups.length > 1 && leaves % groups.length === 0;
  const per = grouped ? leaves / groups.length : leaves;
  const base = (m: Matchup) => (grouped ? Math.max(groups.indexOf(m.group ?? ""), 0) * per : 0);

  // 1. 첫 라운드.
  const first: Cell[] = Array.from({ length: leaves }, () => ({ matchup: null, bye: true }));
  const order = seedOrder(per * 2);
  const unplaced: Matchup[] = [];
  for (const m of main[0].matchups) {
    // 어댑터가 준 자리는 묶음 안에서의 자리다(묶음이 없으면 base 가 0 이다).
    let at: number | null = m.slot != null ? base(m) + m.slot : null;
    if (at == null) {
      const seeds = m.teams.map((t) => t?.seed).filter((s): s is number => s != null);
      const idx = seeds.length > 0 ? order.indexOf(Math.min(...seeds)) : -1;
      at = idx === -1 ? null : base(m) + Math.floor(idx / 2);
    }
    if (at == null || at >= leaves || first[at].matchup) unplaced.push(m);
    else first[at] = { matchup: m, bye: false };
  }
  // 시드도 자리도 없으면 그 묶음 구간의 빈칸을 위에서부터 채운다.
  for (const m of unplaced) {
    const start = base(m);
    let at = first.findIndex((c, i) => i >= start && i < start + per && !c.matchup);
    if (at === -1) at = first.findIndex((c) => !c.matchup);
    if (at === -1) return null;
    first[at] = { matchup: m, bye: false };
  }

  // 2. 그다음 라운드들 — 앞 라운드에서 누가 올라왔는지로.
  const columns: { name: string; cells: Cell[] }[] = [{ name: main[0].name, cells: first }];
  for (let r = 1; r < depth - 1; r++) {
    const prev = columns[r - 1].cells;
    const cells: Cell[] = Array.from({ length: prev.length / 2 }, () => ({ matchup: null, bye: false }));
    const rest: Matchup[] = [];
    for (const m of main[r].matchups) {
      const ns = names(m);
      const from = (c: Cell) => !!c.matchup && c.matchup.teams.some((t) => t && ns.includes(t.name));
      let at = m.slot != null && m.slot < cells.length ? m.slot : prev.findIndex(from);
      if (at !== -1 && m.slot == null) at = Math.floor(at / 2);
      if (at === -1 || cells[at].matchup) rest.push(m);
      else cells[at] = { matchup: m, bye: false };
    }
    for (const m of rest) {
      const at = cells.findIndex((c) => !c.matchup);
      if (at === -1) return null;
      cells[at] = { matchup: m, bye: false };
    }
    columns.push({ name: main[r].name, cells });
  }

  const last = main[depth - 1];
  if (last.matchups.length > 1) return null;

  // 양쪽 이름. 묶음이 둘이면 그 둘, 넷(NCAA 지역)이면 반씩 묶은 것이라 이름을 안 단다.
  const sides: [string | null, string | null] = grouped && groups.length === 2 ? [groups[0], groups[1]] : [null, null];

  return { pre, columns, final: { name: last.name, matchup: last.matchups[0] ?? null }, sides };
}
