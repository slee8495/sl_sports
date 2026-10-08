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

/** "9/17/26" — 유튜브 하이라이트 제목이 쓰는 모양. */
export function slashDate(value: string | Date | null): string {
  return fmt(value, { month: "numeric", day: "numeric", year: "2-digit" });
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

/**
 * 시간대 없이 온 태평양 벽시계("2026-05-12T15:15:00")를 진짜 시각으로.
 *
 * MaxPreps 브래킷은 시각을 구역 표시 없이 준다. 서버(UTC)가 그대로 읽으면 일곱 시간쯤
 * 이르게 그려진다. 여름(-7)과 겨울(-8) 둘 다 대 보고, 태평양 시계로 되돌렸을 때 같은
 * 글자가 나오는 쪽을 고른다.
 */
export function fromPacific(local: string | null): string | null {
  const m = local?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const clock: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  // 벽시계 글자 그대로(UTC 로 읽은 것)와, 후보 시각을 태평양으로 되돌린 글자를 맞대 본다.
  const want = fmt(new Date(wall), { ...clock, timeZone: "UTC" });
  const key = (t: number) => fmt(new Date(t), clock);
  for (const off of [7, 8]) {
    const t = wall + off * 3_600_000;
    if (key(t) === want) return new Date(t).toISOString();
  }
  return new Date(wall + 8 * 3_600_000).toISOString();
}
