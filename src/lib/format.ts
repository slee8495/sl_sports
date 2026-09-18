/**
 * 시각은 **늘 태평양 시간으로 그린다.**
 *
 * 응원하는 팀이 전부 남부 캘리포니아에 있고, 보는 사람도 거기 있다. 브라우저 시간대에
 * 맡기면 서버에서 그린 글자와 브라우저가 다시 그린 글자가 어긋나고(하이드레이션), 여행
 * 중에는 "오늘 밤 경기" 가 내일로 보인다. **구역을 못 박아 두면 둘 다 안 생긴다.**
 */

const ZONE = "America/Los_Angeles";

function parse(value: string | Date | null): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmt(value: string | Date | null, options: Intl.DateTimeFormatOptions): string {
  const d = parse(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: ZONE, ...options }).format(d);
}

/** "Sat Sep 20" */
export function dayLabel(value: string | Date | null): string {
  return fmt(value, { weekday: "short", month: "short", day: "numeric" });
}

/** "1:05 PM" */
export function timeLabel(value: string | Date | null): string {
  return fmt(value, { hour: "numeric", minute: "2-digit" });
}

/** "Sat Sep 20 · 1:05 PM" — 시각이 아직 안 정해진 경기는 시간을 안 적는다. */
export function gameLabel(value: string | Date | null, timeTbd = false): string {
  const day = dayLabel(value);
  if (!day) return "TBD";
  return timeTbd ? `${day} · time TBD` : `${day} · ${timeLabel(value)}`;
}

/** "Sep 20" */
export function shortDate(value: string | Date | null): string {
  return fmt(value, { month: "short", day: "numeric" });
}

export function yearOf(value: string | Date | null): string {
  return fmt(value, { year: "numeric" });
}

/** 오늘(태평양 기준)인가. 헤드라인이 "Tonight" 이라고 말할 수 있는지를 여기서 정한다. */
export function isToday(value: string | Date | null): boolean {
  const d = parse(value);
  if (!d) return false;
  const key = (x: Date) => fmt(x, { year: "numeric", month: "2-digit", day: "2-digit" });
  return key(d) === key(new Date());
}

/**
 * 얼마나 남았나 / 지났나 — "in 2h", "3d ago".
 *
 * 분 단위까지 적지 않는다. 다음 경기가 나흘 뒤인데 "in 5,834분" 이라고 적어 봐야 아무도
 * 그걸 날짜로 환산하지 않는다.
 */
export function relative(value: string | Date | null): string {
  const d = parse(value);
  if (!d) return "";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const hour = 3_600_000;
  const day = 24 * hour;

  if (abs < hour) {
    const m = Math.max(1, Math.round(abs / 60_000));
    return diff > 0 ? `in ${m}m` : `${m}m ago`;
  }
  if (abs < day) {
    const h = Math.round(abs / hour);
    return diff > 0 ? `in ${h}h` : `${h}h ago`;
  }
  const dd = Math.round(abs / day);
  return diff > 0 ? `in ${dd}d` : `${dd}d ago`;
}

/** 오늘 날짜 한 줄 — "Thursday, September 18". */
export function todayLabel(): string {
  return fmt(new Date(), { weekday: "long", month: "long", day: "numeric" });
}
