import { db } from "@/db";
import { teams, players, newsItems, highlights, podcastEpisodes, games, updateLog } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { fetchTeamProfile } from "./ai/fetchProfile";
import { fetchTeamMedia, type TeamMedia } from "./ai/fetchMedia";
import { fetchTeamSchedule, type TeamSchedule } from "./ai/fetchSchedule";
import { fetchTeamContent } from "./ai/fetchContent";
import { fetchTeamStandings } from "./ai/fetchStandings";
import { filterValidImageUrls, validImageUrl } from "./validateImage";
import { getTodaysGroupIndex, getTeamGroup } from "./rotation";

type Team = typeof teams.$inferSelect;
export type UpdateResult = { team: string; ok: boolean; error?: string };

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// The model occasionally echoes stray JSON-array punctuation into a URL string (e.g.
// `https://example.com/ep/','`). new URL() is lenient about trailing junk in the path, so
// zod's .url() check lets it through — strip it here before it hits the (unique) DB column.
function cleanUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/["'),.\]}]+$/, "");
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

async function logResult(teamId: number, kind: string, ok: boolean, error?: string) {
  await db.insert(updateLog).values({ teamId, kind, success: ok, errorMessage: error });
}

export async function updateOneProfile(team: Team): Promise<UpdateResult> {
  try {
    const profile = await fetchTeamProfile(team);

    const [newLogoUrl, newStadiumPhotos] = await Promise.all([
      validImageUrl(profile.logoUrl),
      filterValidImageUrls(profile.stadiumPhotoUrls),
    ]);

    // Image search/validation is inherently a bit noisy run to run — never let a worse
    // result (fewer/no images found this time) overwrite images already saved.
    const logoUrl = newLogoUrl ?? team.logoUrl;
    const stadiumPhotos = newStadiumPhotos.length > 0 ? newStadiumPhotos : team.stadiumPhotos;

    await db
      .update(teams)
      .set({
        logoUrl,
        history: profile.history,
        stadiumName: profile.stadiumName,
        stadiumDescription: profile.stadiumDescription,
        stadiumPhotos,
        stadiumVideoUrl: profile.stadiumVideoUrl ?? team.stadiumVideoUrl,
        coachName: profile.coachName,
        coachBio: profile.coachBio,
        profileUpdatedAt: new Date(),
      })
      .where(eq(teams.id, team.id));

    const existingPlayers = await db.select().from(players).where(eq(players.teamId, team.id));
    const existingPhotoByName = new Map(existingPlayers.filter((p) => p.photoUrl).map((p) => [p.name, p.photoUrl]));

    await db.delete(players).where(eq(players.teamId, team.id));
    if (profile.players.length > 0) {
      const playersWithPhotos = await Promise.all(
        profile.players.map(async (p) => ({
          teamId: team.id,
          name: p.name,
          position: p.position,
          number: p.number,
          isStarPlayer: p.isStarPlayer,
          bio: p.bio,
          photoUrl: p.isStarPlayer
            ? (await validImageUrl(p.photoUrl)) ?? existingPhotoByName.get(p.name) ?? null
            : null,
        })),
      );
      await db.insert(players).values(playersWithPhotos);
    }

    await logResult(team.id, "profile", true);
    return { team: team.name, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logResult(team.id, "profile", false, message);
    return { team: team.name, ok: false, error: message };
  }
}

async function insertNews(teamId: number, news: TeamMedia["news"]) {
  const rows = news
    .map((n) => {
      const url = cleanUrl(n.url);
      if (!url) return null;
      return {
        teamId,
        title: n.title,
        summary: n.summary,
        url,
        source: n.source,
        publishedAt: toDate(n.publishedAt),
      };
    })
    .filter((r) => r !== null);
  if (rows.length === 0) return;
  await db.insert(newsItems).values(rows).onConflictDoNothing({ target: newsItems.url });
}

async function insertHighlights(teamId: number, list: TeamMedia["highlights"]) {
  const rows = list
    .map((h) => {
      const videoUrl = cleanUrl(h.videoUrl);
      if (!videoUrl) return null;
      return {
        teamId,
        title: h.title,
        videoUrl,
        thumbnailUrl: h.thumbnailUrl,
        publishedAt: toDate(h.publishedAt),
      };
    })
    .filter((r) => r !== null);
  if (rows.length === 0) return;
  await db.insert(highlights).values(rows).onConflictDoNothing({ target: highlights.videoUrl });
}

async function insertPodcasts(teamId: number, list: TeamMedia["podcasts"]) {
  const rows = list
    .map((p) => {
      const episodeUrl = cleanUrl(p.episodeUrl);
      if (!episodeUrl) return null;
      return {
        teamId,
        showName: p.showName,
        title: p.title,
        episodeUrl,
        publishedAt: toDate(p.publishedAt),
      };
    })
    .filter((r) => r !== null);
  if (rows.length === 0) return;
  await db.insert(podcastEpisodes).values(rows).onConflictDoNothing({ target: podcastEpisodes.episodeUrl });
}

async function insertGames(teamId: number, list: TeamSchedule["games"]) {
  for (const g of list) {
    const gameTime = new Date(g.gameTime);
    if (Number.isNaN(gameTime.getTime())) continue;

    await db
      .insert(games)
      .values({
        teamId,
        opponent: g.opponent,
        isHome: g.isHome,
        competition: g.competition,
        venue: g.venue,
        gameTime,
        status: g.status,
        result: g.result,
        keyPoints: g.keyPoints,
      })
      .onConflictDoUpdate({
        target: [games.teamId, games.opponent, games.gameTime],
        set: {
          competition: g.competition,
          venue: g.venue,
          status: g.status,
          result: g.result,
          keyPoints: g.keyPoints,
          fetchedAt: sql`now()`,
        },
      });
  }
}

// Kept for manual/admin re-triggering of just one aspect (not on any cron).
export async function updateOneMedia(team: Team): Promise<UpdateResult> {
  try {
    const media = await fetchTeamMedia(team);
    await insertNews(team.id, media.news);
    await insertHighlights(team.id, media.highlights);
    await insertPodcasts(team.id, media.podcasts);
    await logResult(team.id, "media", true);
    return { team: team.name, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logResult(team.id, "media", false, message);
    return { team: team.name, ok: false, error: message };
  }
}

// Kept for manual/admin re-triggering of just one aspect (not on any cron).
export async function updateOneSchedule(team: Team): Promise<UpdateResult> {
  try {
    const schedule = await fetchTeamSchedule(team);
    await insertGames(team.id, schedule.games);
    await logResult(team.id, "schedule", true);
    return { team: team.name, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logResult(team.id, "schedule", false, message);
    return { team: team.name, ok: false, error: message };
  }
}

// The daily cron path: one combined web-search call per team covering news, highlights,
// podcasts, and schedule together (see fetchTeamContent) instead of separate calls.
export async function updateOneContent(team: Team): Promise<UpdateResult> {
  try {
    const content = await fetchTeamContent(team);
    await insertNews(team.id, content.news);
    await insertHighlights(team.id, content.highlights);
    await insertPodcasts(team.id, content.podcasts);
    await insertGames(team.id, content.games);
    await logResult(team.id, "content", true);
    return { team: team.name, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logResult(team.id, "content", false, message);
    return { team: team.name, ok: false, error: message };
  }
}

// Kept as a separate call from updateOneContent — folding standings/bracket into that
// already-large combined schema made the model's structured output unreliable (partial/
// invalid objects, whole update failing). Runs on the same cadence, just as its own call.
export async function updateOneStandings(team: Team): Promise<UpdateResult> {
  try {
    const data = await fetchTeamStandings(team);
    await db
      .update(teams)
      .set({
        standings: data.standings,
        isPlayoffs: data.isPlayoffs,
        playoffBracket: data.isPlayoffs ? data.playoffBracket : [],
        standingsUpdatedAt: new Date(),
      })
      .where(eq(teams.id, team.id));
    await logResult(team.id, "standings", true);
    return { team: team.name, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logResult(team.id, "standings", false, message);
    return { team: team.name, ok: false, error: message };
  }
}

async function allTeams(): Promise<Team[]> {
  return db.select().from(teams).orderBy(teams.id);
}

export async function runProfileUpdate(): Promise<UpdateResult[]> {
  const list = await allTeams();
  return Promise.all(list.map(updateOneProfile));
}

export async function runMediaUpdate(): Promise<UpdateResult[]> {
  const list = await allTeams();
  return Promise.all(list.map(updateOneMedia));
}

export async function runScheduleUpdate(): Promise<UpdateResult[]> {
  const list = await allTeams();
  return Promise.all(list.map(updateOneSchedule));
}

// Manual/admin "refresh everything now" path (?all=true) — also fetches standings so a
// full backfill covers the same fields as the regular group rotation.
export async function runContentUpdate(): Promise<(UpdateResult & { teamSlug: string })[]> {
  const list = await allTeams();
  return Promise.all(list.map(updateOneTeamGroup));
}

async function updateOneTeamGroup(team: Team): Promise<UpdateResult & { teamSlug: string }> {
  const [content, standings] = await Promise.all([updateOneContent(team), updateOneStandings(team)]);
  return {
    team: team.name,
    teamSlug: team.slug,
    ok: content.ok && standings.ok,
    error: [content.error, standings.error].filter(Boolean).join("; ") || undefined,
  };
}

// The daily cron path: teams are split into 3 groups (see src/lib/rotation.ts), and each
// day refreshes only that day's group — so every team refreshes once every 3 days,
// instead of refreshing all teams daily. fetchTeamContent/fetchTeamStandings' prompts are
// written to catch up on the ~3-day gap.
export async function runContentUpdateGroup(): Promise<{
  group: number;
  results: (UpdateResult & { teamSlug: string })[];
}> {
  const list = await allTeams();
  const groupIndex = getTodaysGroupIndex();
  const group = getTeamGroup(list, groupIndex);
  const results = await Promise.all(group.map(updateOneTeamGroup));
  return { group: groupIndex, results };
}
