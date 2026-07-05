function daysSinceEpoch(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

// Deterministic day-of-rotation index, so which team gets refreshed today is stable
// regardless of exact cron fire time, and cycles through all teams over `length` days.
export function getRotationIndex(length: number, date: Date = new Date()): number {
  if (length <= 0) return 0;
  return daysSinceEpoch(date) % length;
}
