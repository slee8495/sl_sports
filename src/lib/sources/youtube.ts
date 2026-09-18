/**
 * 끝난 경기의 하이라이트.
 *
 * 리그들이 자기 유튜브 채널에 경기 하이라이트를 올린다. 우리가 할 일은 **그 영상을 찾아
 * 주는 것**뿐이라 API 키도, 모델도 필요 없다.
 *
 * ## 두 가지 방법을 쓰는 이유
 *
 * 일정 표에는 시즌 전체가 들어 있다 — 야구는 162경기다. 경기마다 유튜브를 한 번씩 부르면
 * 화면 한 장에 백오십 번 나간다. 그래서 **표에서는 검색 주소만 만든다**(부르는 것이 없다).
 * 한 번 더 누르는 대신 절대 안 부러진다.
 *
 * 반면 "최근 경기" 는 화면에 딱 한 장이고, 실제로 눌러서 볼 만한 자리다. 거기만 **영상을
 * 직접 찾아 준다** — 한 번 부르고 반나절 캐시한다. 못 찾거나 유튜브가 막으면 조용히
 * 검색 주소로 돌아간다. 이 앱에서 하이라이트가 안 열리는 경우는 없다.
 */

import { unstable_cache } from "next/cache";
import { searchUrl, titleFits } from "../highlight";
import type { Fetched } from "./types";

const TTL = 43_200; // 반나절. 한 번 올라온 하이라이트는 안 바뀐다.

type Found = { videoId: string; title: string };

/**
 * 검색 결과 첫 영상.
 *
 * 유튜브는 페이지 안에 자기가 그리는 데 쓰는 JSON 을 심어 둔다. 첫 `videoRenderer` 가
 * 첫 결과다.
 *
 * **아무 영상이나 돌려주지 않는다.** 제목에 "highlight" 가 있고 상대 팀 이름이 들어 있어야
 * 한다 — 안 그러면 엉뚱한 경기의 하이라이트나 하이라이트도 아닌 영상을 "이 경기" 라고
 * 내놓게 된다. 확신이 없으면 null 이고, 화면은 검색 주소로 돌아간다.
 */
async function search(query: string, us: string[], them: string[]): Promise<Fetched<Found>> {
  let html: string;
  try {
    const res = await fetch(searchUrl(query), {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const m = html.match(/"videoRenderer":\{"videoId":"([\w-]{11})"[\s\S]{0,4000}?"title":\{"runs":\[\{"text":"(.*?)"\}/);
  if (!m) return null;

  const [, videoId, rawTitle] = m;
  const title = rawTitle.replace(/\\u0026/g, "&").replace(/\\"/g, '"');

  if (!titleFits(title, us, them)) return null;
  return { videoId, title };
}

const cached = unstable_cache(search, ["youtube-highlight"], { revalidate: TTL });

export type Highlight = { url: string; title: string | null; exact: boolean };

/**
 * 하이라이트로 가는 링크.
 *
 * 영상을 찾았으면 그 영상으로, 못 찾았으면 검색 결과로. **어느 쪽이든 링크는 나온다** —
 * 버튼이 있는데 아무 데도 안 가는 경우를 만들지 않는다.
 */
export async function findHighlight(query: string, us: string[], them: string[]): Promise<Highlight> {
  const found = await cached(query, us, them);
  if (!found) return { url: searchUrl(query), title: null, exact: false };
  return { url: `https://www.youtube.com/watch?v=${found.videoId}`, title: found.title, exact: true };
}
