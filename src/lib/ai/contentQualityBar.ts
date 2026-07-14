// Shared quality bar injected into media-fetching prompts (fetchMedia.ts, fetchContent.ts).
// Exists because raw web-search hits often included broken/region-locked videos, podcast
// links that redirected to unrelated articles, or team podcasts that hadn't posted since 2020.
export const QUALITY_BAR = `Content quality bar — apply this to highlights and podcasts:

- Highlights: only include a video if it is genuinely playable in a normal browser without a login or region restriction. Skip videos on platforms known to geo-block outside their home country (e.g. Coupang Play, DAZN in some regions) unless you're confident it plays worldwide. When in doubt, prefer YouTube.
- Podcasts: verify the URL actually opens a podcast/audio-video episode page — not a text news article, a show's homepage, or a dead/redirected link. If the most recent real episode discussing this specific team is stale (e.g. from more than ~6-12 months ago, or the show has gone inactive), don't force it in. Instead substitute one of:
  (a) a recent episode of a well-known podcast/YouTube show that covers this team's league or sport more broadly (e.g. a general J.League, KBO, or NPB insight show), clearly reflecting that scope in the title/showName, or
  (b) recent commentary from a reputable individual sports analyst or commentator covering this sport (e.g., for KBO baseball, a show like 김형준의 야구야구) — YouTube-native shows are fine, they don't need to be on traditional podcast platforms.
- It's fine to return fewer items than the max, or an empty list, rather than include something broken, off-topic, or years stale.`;
