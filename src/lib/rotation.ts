function daysSinceEpoch(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

// Deterministic day-of-rotation index, so which team gets refreshed today is stable
// regardless of exact cron fire time, and cycles through all teams over `length` days.
export function getRotationIndex(length: number, date: Date = new Date()): number {
  if (length <= 0) return 0;
  return daysSinceEpoch(date) % length;
}

export const CONTENT_GROUP_COUNT = 3;

// Splits teams into CONTENT_GROUP_COUNT groups (by id order) and returns which group's
// turn it is today, so every team refreshes once every CONTENT_GROUP_COUNT days.
export function getTodaysGroupIndex(date: Date = new Date()): number {
  return getRotationIndex(CONTENT_GROUP_COUNT, date);
}

export function getTeamGroup<T>(list: T[], groupIndex: number): T[] {
  return list.filter((_, i) => i % CONTENT_GROUP_COUNT === groupIndex);
}
