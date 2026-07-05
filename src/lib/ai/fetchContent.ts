import { generateText, Output, isStepCount } from "ai";
import { z } from "zod";
import { MODEL, webSearchTool } from "./model";
import type { teams } from "@/db/schema";

const contentSchema = z.object({
  news: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().describe("1-2 sentence summary"),
        url: z.string().url(),
        source: z.string().nullable(),
        publishedAt: z.string().nullable().describe("ISO 8601 date if known"),
      }),
    )
    .max(6)
    .describe("Real news articles from roughly the last 3 days about this team"),
  highlights: z
    .array(
      z.object({
        title: z.string(),
        videoUrl: z.string().url().describe("Prefer YouTube links"),
        thumbnailUrl: z.string().url().nullable(),
        publishedAt: z.string().nullable(),
      }),
    )
    .max(4)
    .describe("Real highlight videos from roughly the last 3 days"),
  podcasts: z
    .array(
      z.object({
        showName: z.string().nullable(),
        title: z.string(),
        episodeUrl: z.string().url(),
        publishedAt: z.string().nullable(),
      }),
    )
    .max(4)
    .describe("Real podcast episodes from roughly the last 3 days discussing this team"),
  games: z
    .array(
      z.object({
        opponent: z.string(),
        isHome: z.boolean().nullable(),
        competition: z.string().nullable(),
        venue: z.string().nullable(),
        gameTime: z.string().describe("ISO 8601 datetime"),
        status: z.enum(["upcoming", "completed"]),
        result: z.string().nullable().describe("Final score/result, only for completed games"),
        keyPoints: z
          .array(z.string())
          .describe("2-4 short bullet points: what to watch for (upcoming) or key takeaways (completed)"),
      }),
    )
    .max(8)
    .describe("The next 2-3 upcoming games and every completed game from roughly the last 3 days"),
});

export type TeamContent = z.infer<typeof contentSchema>;

// Each team refreshes every ~3 days (teams split into 3 groups, one group/day — see
// src/lib/rotation.ts), so each fetch only needs to catch up on a ~3-day gap.
export async function fetchTeamContent(team: typeof teams.$inferSelect): Promise<TeamContent> {
  const { output } = await generateText({
    model: MODEL,
    tools: { web_search: webSearchTool(6) },
    stopWhen: isStepCount(8),
    output: Output.object({ schema: contentSchema }),
    prompt: `This team hasn't been checked in about 3 days. Use web search to catch up on everything real from roughly the last 3 days for the ${team.sport} team "${team.name}" (${team.league ?? ""}):

1. News: all the notable real news articles from the last ~3 days (title, 1-2 sentence summary, real URL, source, published date)
2. Highlights: real highlight/recap videos from the last ~3 days, preferring official YouTube channels
3. Podcasts: real podcast episodes from the last ~3 days discussing this team
4. Schedule: the next 2-3 upcoming games, AND every completed game from the last ~3 days (opponent, home/away, competition, venue, exact date/time in ISO 8601, 2-4 key points each)

Be efficient with searches, but make sure you cover the full ~3-day gap rather than just the single most recent item. Only include real URLs/facts you found via search, never fabricate.`,
  });

  return output;
}
