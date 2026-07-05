import { generateText, Output, isStepCount } from "ai";
import { z } from "zod";
import { MODEL, webSearchTool } from "./model";
import type { teams } from "@/db/schema";

const scheduleSchema = z.object({
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
    .describe("The next 2-3 upcoming games and the last 1-2 completed games"),
});

export type TeamSchedule = z.infer<typeof scheduleSchema>;

export async function fetchTeamSchedule(team: typeof teams.$inferSelect): Promise<TeamSchedule> {
  const { output } = await generateText({
    model: MODEL,
    tools: { web_search: webSearchTool(10) },
    stopWhen: isStepCount(12),
    output: Output.object({ schema: scheduleSchema }),
    prompt: `Use web search to find the real current schedule for the ${team.sport} team "${team.name}" (${team.league ?? ""}):

- The next 2-3 upcoming games (opponent, home/away, competition, venue, exact date/time, 2-4 key points on what to watch for)
- The last 1-2 completed games (opponent, final result/score, 2-4 key takeaways/highlights)

Only include real, verified information you found via search. Use ISO 8601 for gameTime.`,
  });

  return output;
}
