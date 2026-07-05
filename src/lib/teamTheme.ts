export const SPORT_EMOJI: Record<string, string> = {
  soccer: "⚽",
  baseball: "⚾",
  football: "🏈",
  hockey: "🏒",
  basketball: "🏀",
};

// Real team primary colors, used as small accents (stripes/badges) — not full backgrounds,
// so both light and dark mode stay readable.
const TEAM_COLORS: Record<string, string> = {
  "tottenham-hotspur": "#132257",
  lafc: "#C39E6D",
  "gamba-osaka": "#004098",
  "jeonbuk-hyundai-motors": "#00854A",
  "san-diego-padres": "#8D471C",
  "orix-buffaloes": "#001E62",
  "nc-dinos": "#1D2A5E",
  "las-vegas-raiders": "#A5ACAF",
  "anaheim-ducks": "#F47A38",
  "la-clippers": "#C8102E",
};

export function getTeamColor(slug: string): string {
  return TEAM_COLORS[slug] ?? "#71717a";
}
