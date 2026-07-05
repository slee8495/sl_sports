import { generateText, Output, isStepCount } from "ai";
import { z } from "zod";
import { MODEL, webSearchTool } from "./model";
import type { teams } from "@/db/schema";

const standingsSchema = z.object({
  standings: z
    .array(
      z.object({
        rank: z.number(),
        teamName: z.string(),
        played: z.number().nullable(),
        wins: z.number().nullable(),
        losses: z.number().nullable(),
        draws: z.number().nullable().describe("Ties/draws, only applicable for some sports"),
        points: z.number().nullable().describe("League points, or null for sports that use win%/GB instead"),
        gamesBehind: z.string().nullable(),
        streak: z.string().nullable().describe("e.g. 'W3' or 'L1'"),
        isThisTeam: z.boolean(),
      }),
    )
    .max(20)
    .describe(
      "The current full standings/table for this team's league or division/conference. Only include this team's group, not unrelated divisions.",
    ),
  isPlayoffs: z.boolean().describe("True if the league/team is currently in a playoff or postseason bracket stage"),
  playoffBracket: z
    .array(
      z.object({
        roundName: z.string().describe("e.g. 'Quarterfinals', 'Conference Finals'"),
        matchups: z
          .array(
            z.object({
              teamA: z.string(),
              teamB: z.string(),
              scoreA: z.string().nullable().describe("Games/sets won so far in the series, or score"),
              scoreB: z.string().nullable(),
              seriesStatus: z.string().nullable().describe("e.g. 'Team A leads 3-1'"),
              winner: z.string().nullable().describe("Set once the matchup is decided"),
            }),
          )
          .describe("All matchups in this round"),
      }),
    )
    .max(6)
    .describe("Only populate if isPlayoffs is true. Leave empty otherwise."),
});

export type TeamStandings = z.infer<typeof standingsSchema>;

// Kept as its own focused web-search call (separate from fetchTeamContent) — folding
// standings/bracket into that already-large combined schema made the model's structured
// output unreliable (it would emit a partial/invalid object and the whole update would
// fail with nothing saved). A dedicated smaller-schema call is more reliable.
export async function fetchTeamStandings(team: typeof teams.$inferSelect): Promise<TeamStandings> {
  const { output } = await generateText({
    model: MODEL,
    tools: { web_search: webSearchTool(8) },
    stopWhen: isStepCount(10),
    output: Output.object({ schema: standingsSchema }),
    prompt: `Use web search to find the current standings for the ${team.sport} team "${team.name}" (${team.league ?? ""}):

1. Standings: the current full league table / division or conference standings that this team is part of (rank, team name, played, wins, losses, draws if applicable, points, games behind, streak). Mark isThisTeam true on this team's row. If the season just ended, use the final standings; if it hasn't started yet, use last season's final standings.
2. Playoffs: if this team's league is currently in a playoff/postseason bracket stage, set isPlayoffs true and fill in playoffBracket with every round and matchup so far (including this team's). Otherwise set isPlayoffs false and leave playoffBracket empty.

Only include real facts you found via search, never fabricate.`,
  });

  return output;
}
