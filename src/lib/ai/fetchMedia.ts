import { generateText, Output, isStepCount } from "ai";
import { z } from "zod";
import { MODEL, webSearchTool } from "./model";
import type { teams } from "@/db/schema";

const mediaSchema = z.object({
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
    .describe("Most recent real news articles about this team"),
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
    .describe("Most recent real highlight videos"),
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
    .describe("Most recent real podcast episodes discussing this team"),
});

export type TeamMedia = z.infer<typeof mediaSchema>;

export async function fetchTeamMedia(team: typeof teams.$inferSelect): Promise<TeamMedia> {
  const { output } = await generateText({
    model: MODEL,
    tools: { web_search: webSearchTool(10) },
    stopWhen: isStepCount(12),
    output: Output.object({ schema: mediaSchema }),
    prompt: `Use web search to find the most recent real content about the ${team.sport} team "${team.name}" (${team.league ?? ""}):

1. News: the latest 3-6 real news articles (title, 1-2 sentence summary, real URL, source, published date)
2. Highlights: the latest 2-4 real highlight/recap videos, preferring official YouTube channels (league or team)
3. Podcasts: the latest 2-4 real podcast episodes that discuss this team

Only include real URLs you found via search. Do not fabricate links.`,
  });

  return output;
}
