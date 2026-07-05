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

async function checkOne(url: string): Promise<boolean> {
  return withLimit(async () => {
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
      return res.ok && contentType.startsWith("image/");
    } catch {
      return false;
    }
  });
}

export async function filterValidImageUrls(urls: string[]): Promise<string[]> {
  const checks = await Promise.all(urls.map(async (url) => ((await checkOne(url)) ? url : null)));
  return checks.filter((u): u is string => u !== null);
}

export async function validImageUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  return (await checkOne(url)) ? url : null;
}
