import { db } from "@/db";
import { teams, players, newsItems, highlights, podcastEpisodes, games, updateLog } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

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

// Teams refresh in groups of ~3-4 (see src/lib/rotation.ts), so "today's update" is a
// handful of teams, not one. Returns every team refreshed on the most recent update day
// (in California/Pacific time), newest first.
export async function getTodaysContentUpdates() {
  const [latest] = await db
    .select({
      latestDate: sql<string>`(${updateLog.ranAt} at time zone 'America/Los_Angeles')::date`,
    })
    .from(updateLog)
    .where(and(eq(updateLog.kind, "content"), eq(updateLog.success, true)))
    .orderBy(desc(updateLog.ranAt))
    .limit(1);
  if (!latest) return [];

  const rows = await db
    .select({
      teamName: teams.name,
      teamSlug: teams.slug,
      ranAt: sql<Date>`max(${updateLog.ranAt})`,
    })
    .from(updateLog)
    .innerJoin(teams, eq(updateLog.teamId, teams.id))
    .where(
      and(
        eq(updateLog.kind, "content"),
        eq(updateLog.success, true),
        sql`(${updateLog.ranAt} at time zone 'America/Los_Angeles')::date = ${latest.latestDate}::date`,
      ),
    )
    .groupBy(teams.id, teams.name, teams.slug)
    .orderBy(desc(sql`max(${updateLog.ranAt})`));
  // Raw sql aggregate expressions aren't type-mapped by the driver like schema columns
  // are, so `max(ran_at)` comes back as a string — convert it to a real Date.
  return rows.map((r) => ({ ...r, ranAt: new Date(r.ranAt) }));
}

export type ActivityItem = {
  id: string;
  type: "news" | "highlight" | "podcast";
  title: string;
  url: string;
  meta: string | null;
  teamName: string;
  teamSlug: string;
  publishedAt: Date | null;
  fetchedAt: Date;
};

// Merges news/highlights/podcasts across all teams into one feed sorted purely by
// recency (publishedAt, falling back to fetchedAt when the source didn't give a date),
// instead of three separate lists each sorted only within their own type.
export async function getLatestActivity(limit = 16): Promise<ActivityItem[]> {
  const perTypeLimit = Math.max(limit, 20);

  const [newsRows, highlightRows, podcastRows] = await Promise.all([
    db
      .select({
        id: newsItems.id,
        title: newsItems.title,
        url: newsItems.url,
        source: newsItems.source,
        publishedAt: newsItems.publishedAt,
        fetchedAt: newsItems.fetchedAt,
        teamName: teams.name,
        teamSlug: teams.slug,
      })
      .from(newsItems)
      .innerJoin(teams, eq(newsItems.teamId, teams.id))
      .orderBy(desc(newsItems.fetchedAt))
      .limit(perTypeLimit),
    db
      .select({
        id: highlights.id,
        title: highlights.title,
        url: highlights.videoUrl,
        publishedAt: highlights.publishedAt,
        fetchedAt: highlights.fetchedAt,
        teamName: teams.name,
        teamSlug: teams.slug,
      })
      .from(highlights)
      .innerJoin(teams, eq(highlights.teamId, teams.id))
      .orderBy(desc(highlights.fetchedAt))
      .limit(perTypeLimit),
    db
      .select({
        id: podcastEpisodes.id,
        title: podcastEpisodes.title,
        url: podcastEpisodes.episodeUrl,
        showName: podcastEpisodes.showName,
        publishedAt: podcastEpisodes.publishedAt,
        fetchedAt: podcastEpisodes.fetchedAt,
        teamName: teams.name,
        teamSlug: teams.slug,
      })
      .from(podcastEpisodes)
      .innerJoin(teams, eq(podcastEpisodes.teamId, teams.id))
      .orderBy(desc(podcastEpisodes.fetchedAt))
      .limit(perTypeLimit),
  ]);

  const merged: ActivityItem[] = [
    ...newsRows.map((n) => ({
      id: `news-${n.id}`,
      type: "news" as const,
      title: n.title,
      url: n.url,
      meta: n.source,
      teamName: n.teamName,
      teamSlug: n.teamSlug,
      publishedAt: n.publishedAt,
      fetchedAt: n.fetchedAt,
    })),
    ...highlightRows.map((h) => ({
      id: `highlight-${h.id}`,
      type: "highlight" as const,
      title: h.title,
      url: h.url,
      meta: null,
      teamName: h.teamName,
      teamSlug: h.teamSlug,
      publishedAt: h.publishedAt,
      fetchedAt: h.fetchedAt,
    })),
    ...podcastRows.map((p) => ({
      id: `podcast-${p.id}`,
      type: "podcast" as const,
      title: p.title,
      url: p.url,
      meta: p.showName,
      teamName: p.teamName,
      teamSlug: p.teamSlug,
      publishedAt: p.publishedAt,
      fetchedAt: p.fetchedAt,
    })),
  ];

  merged.sort((a, b) => (b.publishedAt ?? b.fetchedAt).getTime() - (a.publishedAt ?? a.fetchedAt).getTime());

  return merged.slice(0, limit);
}

export const SPORT_LABELS: Record<string, string> = {
  soccer: "Soccer",
  baseball: "Baseball",
  football: "Football",
  hockey: "Hockey",
  basketball: "Basketball",
};
