const USER_AGENT = "MySportsApp/1.0 (personal hobby project; contact: sanlee8495@gmail.com)";

// Wikimedia (our preferred image source) aggressively rate-limits unidentified/bursty clients,
// so all image checks share one small concurrency limiter across the whole update run.
const MAX_CONCURRENT = 4;
let active = 0;
const queue: (() => void)[] = [];

async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = queue.shift();
    if (next) next();
  }
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...init.headers } });
  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 1200));
    return fetchWithRetry(url, init, retries - 1);
  }
  return res;
}

// The model is asked for direct Wikimedia Commons file links (.../wiki/Special:FilePath/<name>)
// but occasionally hands back the human-readable file *page* instead (.../wiki/File:<name>),
// which serves an HTML description page, not the image — normalize that back to the direct
// link rather than losing an otherwise-good find to a format slip.
function normalizeWikimediaUrl(url: string): string {
  const match = url.match(/^https?:\/\/commons\.wikimedia\.org\/wiki\/File:(.+)$/i);
  return match ? `https://commons.wikimedia.org/wiki/Special:FilePath/${match[1]}` : url;
}

async function checkOne(rawUrl: string): Promise<string | null> {
  return withLimit(async () => {
    const url = normalizeWikimediaUrl(rawUrl);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      let res = await fetchWithRetry(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
      if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
        res = await fetchWithRetry(
          url,
          { method: "GET", redirect: "follow", headers: { Range: "bytes=0-1024" }, signal: controller.signal },
          1,
        );
      }
      clearTimeout(timeout);
      const contentType = res.headers.get("content-type") ?? "";
      return res.ok && contentType.startsWith("image/") ? url : null;
    } catch {
      return null;
    }
  });
}

export async function filterValidImageUrls(urls: string[]): Promise<string[]> {
  const checks = await Promise.all(urls.map((url) => checkOne(url)));
  return checks.filter((u): u is string => u !== null);
}

export async function validImageUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  return checkOne(url);
}
