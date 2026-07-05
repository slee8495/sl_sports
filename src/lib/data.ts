import { db } from "@/db";
import { teams, players, newsItems, highlights, podcastEpisodes, games, updateLog } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function getTeamsGroupedBySport() {
  const allTeams = await db.select().from(teams).orderBy(teams.sport, teams.name);
  const grouped = new Map<string, (typeof allTeams)[number][]>();
  for (const team of allTeams) {
    const list = grouped.get(team.sport) ?? [];
    list.push(team);
    grouped.set(team.sport, list);
  }
  return grouped;
}

export async function getTeamBySlug(slug: string) {
  const [team] = await db.select().from(teams).where(eq(teams.slug, slug));
  return team ?? null;
}

export async function getTeamRoster(teamId: number) {
  const rows = await db.select().from(players).where(eq(players.teamId, teamId));
  return rows.sort((a, b) => Number(b.isStarPlayer) - Number(a.isStarPlayer));
}

export async function getTeamNews(teamId: number, limit = 6) {
  return db
    .select()
    .from(newsItems)
    .where(eq(newsItems.teamId, teamId))
    .orderBy(desc(newsItems.publishedAt))
    .limit(limit);
}

export async function getTeamHighlights(teamId: number, limit = 4) {
  return db
    .select()
    .from(highlights)
    .where(eq(highlights.teamId, teamId))
    .orderBy(desc(highlights.publishedAt))
    .limit(limit);
}

export async function getTeamPodcasts(teamId: number, limit = 4) {
  return db
    .select()
    .from(podcastEpisodes)
    .where(eq(podcastEpisodes.teamId, teamId))
    .orderBy(desc(podcastEpisodes.publishedAt))
    .limit(limit);
}

export async function getUpcomingGames(teamId: number, limit = 3) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.teamId, teamId), eq(games.status, "upcoming")))
    .orderBy(games.gameTime)
    .limit(limit);
}

export async function getRecentGames(teamId: number, limit = 2) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.teamId, teamId), eq(games.status, "completed")))
    .orderBy(desc(games.gameTime))
    .limit(limit);
}

export async function getNextGameForEachTeam() {
  const upcoming = await db
    .select()
    .from(games)
    .where(eq(games.status, "upcoming"))
    .orderBy(games.gameTime);

  const nextByTeam = new Map<number, (typeof upcoming)[number]>();
  for (const g of upcoming) {
    if (!nextByTeam.has(g.teamId)) nextByTeam.set(g.teamId, g);
  }
  return nextByTeam;
}

export async function getLatestNews(limit = 8) {
  return db
    .select({
      id: newsItems.id,
      title: newsItems.title,
      summary: newsItems.summary,
      url: newsItems.url,
      source: newsItems.source,
      publishedAt: newsItems.publishedAt,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(newsItems)
    .innerJoin(teams, eq(newsItems.teamId, teams.id))
    .orderBy(desc(newsItems.publishedAt))
    .limit(limit);
}

export async function getLatestHighlights(limit = 8) {
  return db
    .select({
      id: highlights.id,
      title: highlights.title,
      videoUrl: highlights.videoUrl,
      thumbnailUrl: highlights.thumbnailUrl,
      publishedAt: highlights.publishedAt,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(highlights)
    .innerJoin(teams, eq(highlights.teamId, teams.id))
    .orderBy(desc(highlights.publishedAt))
    .limit(limit);
}

export async function getLatestPodcasts(limit = 8) {
  return db
    .select({
      id: podcastEpisodes.id,
      title: podcastEpisodes.title,
      showName: podcastEpisodes.showName,
      episodeUrl: podcastEpisodes.episodeUrl,
      publishedAt: podcastEpisodes.publishedAt,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(podcastEpisodes)
    .innerJoin(teams, eq(podcastEpisodes.teamId, teams.id))
    .orderBy(desc(podcastEpisodes.publishedAt))
    .limit(limit);
}

export async function getLatestContentUpdate() {
  const [row] = await db
    .select({ teamName: teams.name, teamSlug: teams.slug, ranAt: updateLog.ranAt })
    .from(updateLog)
    .innerJoin(teams, eq(updateLog.teamId, teams.id))
    .where(and(eq(updateLog.kind, "content"), eq(updateLog.success, true)))
    .orderBy(desc(updateLog.ranAt))
    .limit(1);
  return row ?? null;
}

export const SPORT_LABELS: Record<string, string> = {
  soccer: "Soccer",
  baseball: "Baseball",
  football: "Football",
  hockey: "Hockey",
  basketball: "Basketball",
};
