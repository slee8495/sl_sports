import { tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { teams } from "@/db/schema";
import {
  getTeamBySlug,
  getTeamRoster,
  getTeamNews,
  getTeamHighlights,
  getTeamPodcasts,
  getUpcomingGames,
  getRecentGames,
} from "@/lib/data";

export const listTeams = tool({
  description: "List all teams the user follows in this app, with their sport, league, and slug.",
  inputSchema: z.object({}),
  execute: async () => {
    const rows = await db
      .select({ name: teams.name, slug: teams.slug, sport: teams.sport, league: teams.league })
      .from(teams);
    return rows;
  },
});

export const getTeamDetails = tool({
  description:
    "Get full details for one team by its slug (from listTeams): profile summary, coach, upcoming/recent games with key points, and the latest news, highlights, and podcasts.",
  inputSchema: z.object({ slug: z.string().describe("The team's slug, e.g. 'lafc' or 'anaheim-ducks'") }),
  execute: async ({ slug }) => {
    const team = await getTeamBySlug(slug);
    if (!team) return { error: `No team found for slug "${slug}"` };

    const [roster, news, highlightsList, podcasts, upcoming, recent] = await Promise.all([
      getTeamRoster(team.id),
      getTeamNews(team.id, 5),
      getTeamHighlights(team.id, 3),
      getTeamPodcasts(team.id, 3),
      getUpcomingGames(team.id, 3),
      getRecentGames(team.id, 2),
    ]);

    return {
      name: team.name,
      sport: team.sport,
      league: team.league,
      history: team.history,
      stadium: team.stadiumName,
      coach: team.coachName,
      starPlayers: roster.filter((p) => p.isStarPlayer).map((p) => ({ name: p.name, position: p.position })),
      upcomingGames: upcoming.map((g) => ({
        opponent: g.opponent,
        isHome: g.isHome,
        gameTime: g.gameTime?.toISOString() ?? null,
        keyPoints: g.keyPoints,
      })),
      recentGames: recent.map((g) => ({
        opponent: g.opponent,
        result: g.result,
        keyPoints: g.keyPoints,
      })),
      latestNews: news.map((n) => ({
        title: n.title,
        summary: n.summary,
        url: n.url,
        publishedAt: n.publishedAt?.toISOString() ?? null,
      })),
      latestHighlights: highlightsList.map((h) => ({ title: h.title, url: h.videoUrl })),
      latestPodcasts: podcasts.map((p) => ({ title: p.title, url: p.episodeUrl })),
    };
  },
});
