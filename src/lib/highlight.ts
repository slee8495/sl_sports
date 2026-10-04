/**
 * 하이라이트 찾는 말 만들기.
 *
 * **바깥을 안 부른다.** 그래서 브라우저 쪽 코드도 이 파일만 들여올 수 있다 — 실제로 찾아
 * 오는 쪽(`sources/youtube.ts`)은 서버 전용이라 화면이 들여오면 묶음이 깨진다.
 */

import type { Game } from "./sources/types";
import { slashDate } from "./format";

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
 */
export function titleFits(title: string, us: string[], them: string[]): boolean {
  const lower = title.toLowerCase();
  const has = (list: string[]) => list.some((t) => t.length > 2 && lower.includes(t.toLowerCase()));
  if (lower.includes("highlight") && (has(us) || has(them))) return true;
  return has(us) && has(them);
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
