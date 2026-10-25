/**
 * 하이라이트 찾는 말 만들기.
 *
 * **바깥을 안 부른다.** 그래서 브라우저 쪽 코드도 이 파일만 들여올 수 있다 — 실제로 찾아
 * 오는 쪽(`sources/youtube.ts`)은 서버 전용이라 화면이 들여오면 묶음이 깨진다.
 */

import type { Game } from "./sources/types";
import { monthDay, slashDate } from "./format";

/** 유튜브 제목이 대개 "Giants vs. Dodgers Game Highlights (9/17/26)" 라서 그 모양에 맞춘다. */
export function highlightQuery(us: string, game: Game): string {
  const them = game.opponent.shortName ?? game.opponent.name;
  const when = slashDate(game.startsAt);
  return [us, them, "highlights", when].filter(Boolean).join(" ");
}

export function searchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/**
 * 제목이 이 경기의 하이라이트가 맞는지.
 *
 * 두 가지 중 하나면 받아들인다.
 *
 * - "highlight" 라는 낱말이 있고 두 팀 중 한쪽 이름이 있다 — 리그 공식 채널의 모양이다.
 * - **두 팀 이름이 다 있다** — 고등학교 영상은 제목에 "highlights" 를 안 쓰기도 한다
 *   ("ORANGE LUTHERAN SHUTS DOWN SERRA"). 두 이름이 다 들어 있으면 그 경기가 맞다.
 *
 * 둘 다 아니면 **모른다고 한다.** 엉뚱한 경기를 이 경기라고 내놓는 것이 제일 나쁘다.
 *
 * **제목에 날짜가 있으면 그 날짜도 맞아야 한다.** 같은 두 팀은 한 시즌에 여러 번 붙는다 —
 * 10월 20일 LG-KIA 경기에 "Twins vs Tigers｜10.12" 영상이 걸렸다. 이름만 보면 맞는 영상이다.
 * 날짜는 하루 앞뒤까지 받는다 — 한국 경기는 태평양 날짜로 하루 전이다.
 *
 * **쿼터·하프 조각은 안 받는다.** 막 끝난 경기는 "Full 1st Qtr Highlights" 가 먼저 올라와 있고,
 * 한 번 걸리면 반나절 캐시에 묶인다. 차라리 검색으로 보내면 경기 전체 영상이 올라온 뒤에 찾는다.
 */
export function titleFits(title: string, us: string[], them: string[], startsAt?: string | null): boolean {
  const lower = title.toLowerCase();
  const has = (list: string[]) => list.some((t) => t.length > 2 && lower.includes(t.toLowerCase()));
  if (!(lower.includes("highlight") && (has(us) || has(them))) && !(has(us) && has(them))) return false;
  if (/\b(1st|2nd|3rd|4th|first|second|third|fourth)\s+(qtr|quarter|half|period)\b/i.test(title)) return false;

  const said = titleDates(title);
  const at = startsAt ? Date.parse(startsAt) : NaN;
  if (said.length === 0 || Number.isNaN(at)) return true;
  const day = 86_400_000;
  const near = [at - day, at, at + day].map((t) => monthDay(new Date(t)));
  return said.some((d) => near.includes(d));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** 제목 안의 날짜들을 "10/20" 모양으로 — "10/20/26", "10.12", "October 21, 2026", "10월 12일". */
function titleDates(title: string): string[] {
  const out: string[] = [];
  const md = (m: string, d: string) => out.push(`${Number(m)}/${Number(d)}`);
  for (const m of title.matchAll(/(?<!\d)(1[0-2]|0?[1-9])[/.](3[01]|[12]\d|0?[1-9])(?!\d)/g)) md(m[1], m[2]);
  for (const m of title.matchAll(/(1[0-2]|[1-9])월\s*(3[01]|[12]\d|[1-9])일/g)) md(m[1], m[2]);
  for (const m of title.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(3[01]|[12]\d|0?[1-9])(?!\d)/gi)) {
    md(String(MONTHS.indexOf(m[1].toLowerCase()) + 1), m[2]);
  }
  return out;
}

/**
 * 이름에서 찾을 만한 조각들.
 *
 * 영상 제목이 팀을 부르는 방식이 제각각이다 — "Los Angeles Dodgers" 는 "Dodgers" 로,
 * "Orange Lutheran Lancers" 는 **"Orange Lutheran"** 으로 뜬다(마스코트를 안 쓴다).
 * 한 가지만 들고 찾으면 맞는 영상을 놓친다 — 실제로 랜서스 하이라이트를 그렇게 놓쳤다.
 */
export function nameTokens(...names: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    if (!n) continue;
    out.add(n);
    const words = n.split(/\s+/);
    // 마지막 낱말(대개 마스코트)과 그걸 뗀 나머지(대개 지역·학교 이름).
    if (words.length > 1) {
      out.add(words[words.length - 1]);
      out.add(words.slice(0, -1).join(" "));
    }
  }
  return [...out].filter((t) => t.length > 2);
}
