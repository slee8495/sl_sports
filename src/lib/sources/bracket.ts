/**
 * 브래킷을 세우는 셈.
 *
 * **바깥을 안 부른다** — `split.ts` 와 같은 이유로, 화면 쪽 코드도 이 파일을 들여올 수 있다.
 */

import type { BracketRound, BracketTeam, Matchup } from "./types";

/**
 * 라운드를 시간 순으로, 매치업을 나무 순으로 세운다.
 *
 * ESPN 은 브래킷을 안 준다. 날짜별 경기만 준다. 그래서 라운드는 **첫 경기가 열린 날**로
 * 줄을 세우고, 한 라운드 안의 매치업은 **다음 라운드에서 만나는 것끼리 붙여 둔다** — 위쪽 두
 * 매치업의 승자가 다음 라운드 첫 칸에서 만나도록. 다음 라운드가 아직 없으면(진행 중)
 * 묶음(AL/NL, East/West) 순서, 그다음 날짜 순이다.
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
      const names = m.teams.filter((t): t is BracketTeam => t !== null).map((t) => t.name);
      const at = next.matchups.findIndex((n) => n.teams.some((t) => t && names.includes(t.name)));
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
 * 화면을 열었을 때 먼저 보여 줄 라운드.
 *
 * **지금 하는 라운드다** — 아직 안 끝난 매치업이 있는 첫 라운드. 다 끝났으면 마지막(결승).
 * 와일드카드가 끝난 뒤에도 첫 화면이 와일드카드면, 열 때마다 한 번씩 넘겨야 한다.
 */
export function currentRound(rounds: BracketRound[]): number {
  const open = rounds.findIndex((r) => r.matchups.some((m) => m.status !== "final"));
  return open === -1 ? Math.max(rounds.length - 1, 0) : open;
}

/** 우승 팀. 마지막 라운드가 매치업 하나이고 끝났을 때만 — 그 전에는 모르는 것이다. */
export function championOf(rounds: BracketRound[]): BracketTeam | null {
  const last = rounds[rounds.length - 1];
  if (!last || last.matchups.length !== 1) return null;
  const m = last.matchups[0];
  if (m.status !== "final") return null;
  return m.teams.find((t) => t?.won) ?? null;
}
