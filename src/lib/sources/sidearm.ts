/**
 * 학교 공식 athletics 사이트의 캘린더 피드(.ics).
 *
 * **고등학교는 ESPN 에 없다** — 검색 API 로 찾아도 0건이고, `high-school` 경로는 404 다.
 * 그래서 오렌지 루터란은 학교가 스스로 내보내는 캘린더를 읽는다. SIDEARM 이 돌리는 사이트는
 * `/calendar.ashx/calendar.ics?sport_id=N` 을 열어 두고, 거기에 상대·홈/원정·결과·구장·
 * 중계/티켓 링크가 다 들어 있다. 스크래핑이 아니라 **내보내라고 만든 문**이라 잘 안 부러진다.
 *
 * sport_id 는 학교가 정한 번호다(풋볼 3, 야구 1 — 눈으로 확인). 번호가 바뀌면 그 종목 화면이
 * 빈다. 그때는 0 부터 훑으며 `X-WR-CALNAME` 을 읽으면 어느 번호가 무슨 종목인지 나온다.
 *
 * ## 읽을 때 조심한 것
 *
 * - **결과는 대괄호에 있다.** `[W] ... vs Basha` 의 `[W]`, 그리고 본문 첫 줄의 `W 23-17`.
 *   우리 점수가 앞이다.
 * - **`vs` 는 홈, `at` 은 원정.** 학교 이름에 `at` 이 들어가는 경우를 만들지 않으려고
 *   가운데 " vs " / " at " 만 본다.
 * - **플레이오프 자리는 상대가 TBD 로 온다.** 지우지 않는다 — "11월 21일에 CIF 준결승이
 *   있다" 는 것 자체가 팬이 알고 싶은 것이다.
 */

import type { SidearmSource } from "./teams";
import type { Article, Fetched, Game } from "./types";

const TTL_SCHEDULE = 1_800;
const TTL_NEWS = 3_600;

/** 접힌 줄을 편다(RFC 5545: 다음 줄이 공백으로 시작하면 이어진 줄이다). */
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += raw.slice(1);
    } else {
      out.push(raw);
    }
  }
  return out;
}

/** ICS 의 이스케이프를 푼다. `\n` 은 진짜 줄바꿈이고, `\,` 는 쉼표다. */
function unescape(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/&amp;/g, "&");
}

/** `20260822T020000Z` → ISO. 구역이 없는 값은 학교가 적어 준 그대로 읽는다. */
function parseStamp(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? "Z" : ""}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type VEvent = Record<string, string>;

function parseIcs(text: string): VEvent[] {
  const events: VEvent[] = [];
  let current: VEvent | null = null;

  for (const line of unfold(text)) {
    if (line.startsWith("BEGIN:VEVENT")) current = {};
    else if (line.startsWith("END:VEVENT")) {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      // `DTSTART;TZID=...` 처럼 이름 뒤에 딸린 것이 있다. 이름만 쓴다.
      const key = line.slice(0, idx).split(";")[0].toUpperCase();
      current[key] = line.slice(idx + 1);
    }
  }
  return events;
}

/** `[W] Orange Lutheran High School  Football vs Basha` 에서 상대와 홈/원정을 뽑는다. */
function splitOpponent(summary: string): { opponent: string; isHome: boolean | null; note: string | null } {
  const clean = summary.replace(/^\[[WLT]\]\s*/i, "").replace(/\s+/g, " ").trim();

  const vs = clean.indexOf(" vs ");
  const at = clean.indexOf(" at ");
  const isHome = vs >= 0 ? true : at >= 0 ? false : null;
  const cut = vs >= 0 ? vs + 4 : at >= 0 ? at + 4 : -1;
  if (cut < 0) return { opponent: clean, isHome: null, note: null };

  let opponent = clean.slice(cut).trim();

  /*
    플레이오프 자리는 "TBD - CIF Quarterfinals" 처럼 상대와 대회 이름이 한 칸에 붙어 온다.
    갈라 둬야 화면이 "TBD" 를 상대 이름으로 크게 그리지 않는다.
  */
  let note: string | null = null;
  const dash = opponent.split(/\s+[-–]\s+/);
  if (dash.length > 1) {
    opponent = dash[0].trim();
    note = dash.slice(1).join(" - ").trim();
  }

  return { opponent, isHome, note };
}

/** 본문 첫 줄의 `W 23-17`. 우리 점수가 앞이다. */
function parseScore(description: string): { ourScore: number | null; theirScore: number | null; result: Game["result"] } {
  const m = description.match(/\b([WLT])\s+(\d+)\s*-\s*(\d+)/);
  if (!m) return { ourScore: null, theirScore: null, result: null };
  return {
    result: m[1].toUpperCase() as Game["result"],
    ourScore: Number(m[2]),
    theirScore: Number(m[3]),
  };
}

function parseLinks(description: string): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const line of description.split("\n")) {
    const m = line.match(/^(Streaming Video|Tickets|Live Stats|Watch|Listen):\s*(https?:\/\/\S+)/i);
    if (m) out.push({ label: m[1], url: m[2] });
  }
  return out;
}

/**
 * 한 종목의 일정.
 *
 * **비시즌에는 빈 배열이 온다** — 야구는 가을에 0건이고 봄이 되면 채워진다. 못 가져온 것과
 * 구분하려고 그 경우에도 null 이 아니라 [] 다.
 */
export async function sidearmSchedule(src: SidearmSource, sportId: number): Promise<Fetched<Game[]>> {
  const url = `${src.host}/calendar.ashx/calendar.ics?sport_id=${sportId}`;
  let text: string;
  try {
    const res = await fetch(url, {
      next: { revalidate: TTL_SCHEDULE },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null;
  }

  const now = Date.now();
  const games: Game[] = [];

  for (const e of parseIcs(text)) {
    const startsAt = e.DTSTART ? parseStamp(e.DTSTART) : null;
    const summary = unescape(e.SUMMARY ?? "");
    if (!summary) continue;

    const description = unescape(e.DESCRIPTION ?? "");
    const { opponent, isHome, note } = splitOpponent(summary);
    const { ourScore, theirScore, result } = parseScore(description);
    const location = unescape(e.LOCATION ?? "").replace(/^,\s*/, "").trim();

    /*
      **끝났는지는 결과가 말해 준다.** 학교 피드에는 상태 칸이 없다. 점수가 적혀 있으면 끝난
      것이고, 시작 시각이 지났는데 점수가 없으면 아직 안 올라온 것이다 — 그 둘을 같게 그리면
      토요일 아침에 "어제 경기 예정" 이 뜬다.
    */
    const started = startsAt ? new Date(startsAt).getTime() < now : false;
    const status: Game["status"] = result ? "final" : started ? "in" : "scheduled";

    games.push({
      id: e.UID ?? `${summary}-${startsAt ?? ""}`,
      startsAt,
      timeTbd: false,
      opponent: { name: opponent || "TBD", shortName: null, logo: null },
      isHome,
      neutralSite: false,
      status,
      ourScore,
      theirScore,
      result,
      venue: location || null,
      broadcast: null,
      note,
      statusDetail: null,
      links: parseLinks(description),
    });
  }

  games.sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  return games;
}

/**
 * 학교가 직접 쓰는 기사.
 *
 * ESPN 이 고등학교를 안 다루니 이 팀의 뉴스는 여기밖에 없다. 같은 사이트가 RSS 를 열어 두고
 * 있어서, 일정과 같은 이유로 여기를 읽는다 — **스크래핑이 아니라 내보내라고 만든 문이다.**
 *
 * `path` 로 종목을 거를 수 있지만 걸지 않는다. 학교가 하나고 기사도 몇 개 안 된다 — 풋볼만
 * 걸러 두면 야구 기사가 통째로 안 보인다.
 */
export async function sidearmNews(src: SidearmSource, limit = 15): Promise<Fetched<Article[]>> {
  let xml: string;
  try {
    const res = await fetch(`${src.host}/rss.aspx`, {
      next: { revalidate: TTL_NEWS },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    xml = await res.text();
  } catch {
    return null;
  }

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
  const pick = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    if (!m) return null;
    return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() || null;
  };

  return items.map((m, i) => {
    const block = m[1];
    const raw = pick(block, "description") ?? "";
    // 본문에 이미지 태그가 섞여 온다. 사진은 따로 뽑고 글은 태그를 벗겨 문장만 남긴다.
    const image =
      raw.match(/<img[^>]+src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ??
      block.match(/<media:thumbnail url="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ??
      null;
    const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const link = pick(block, "link");
    const published = pick(block, "pubDate");

    return {
      id: pick(block, "guid") ?? link ?? `item-${i}`,
      headline: pick(block, "title") ?? "(untitled)",
      description: text || null,
      publishedAt: published ? (Number.isNaN(new Date(published).getTime()) ? null : new Date(published).toISOString()) : null,
      url: link,
      image,
      kind: pick(block, "category"),
      byline: null,
    } satisfies Article;
  });
}
