import { generateText, Output, isStepCount } from "ai";
import { z } from "zod";
import { MODEL, webSearchTool } from "./model";
import type { teams } from "@/db/schema";

const standingsSchema = z.object({
  standings: z
    .array(
      z.object({
        rank: z.number().describe("Rank within `group` (e.g. 1st in the Western Conference), not an overall league rank"),
        group: z
          .string()
          .nullable()
          .describe(
            "The conference/division name this row belongs to (e.g. 'Western Conference', 'AL West'), or null if the league is a single flat table (most soccer leagues)",
          ),
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
    .max(40)
    .describe(
      "EVERY team in this team's league — all conferences/divisions, not just the one this team belongs to. Never truncate a group partway through.",
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
//
// This call still occasionally produces malformed output on the first try (the model
// second-guessing itself mid-generation on a ~30-40 row table) but reliably succeeds on
// a retry, so retry a couple times before giving up rather than failing the whole update.
export async function fetchTeamStandings(team: typeof teams.$inferSelect): Promise<TeamStandings> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { output } = await generateText({
        model: MODEL,
        tools: { web_search: webSearchTool(10) },
        stopWhen: isStepCount(14),
        output: Output.object({ schema: standingsSchema }),
        prompt: `Use web search to find the current standings for the ${team.sport} team "${team.name}" (${team.league ?? ""}):

1. Standings: the FULL current league table for "${team.league}" — every team in every conference/division, not only the one "${team.name}" plays in. If the league is a single flat table (most soccer leagues), include every team in it (e.g. all 20 teams for a 20-team league) — do not stop partway through. If the league is split into conferences/divisions (most US sports), include every team from every conference/division, and set each row's "group" field to which conference/division it belongs to (e.g. "Western Conference", "AL West"); rank is then the position within that group. For each row give played, wins, losses, draws if applicable, points, games behind, and streak. Mark isThisTeam true on this team's row. If the season just ended, use the final standings; if it hasn't started yet, use last season's final standings.
2. Playoffs: if this team's league is currently in a playoff/postseason bracket stage, set isPlayoffs true and fill in playoffBracket with every round and matchup so far (including this team's). Otherwise set isPlayoffs false and leave playoffBracket empty.

Prioritize completeness of the full table over anything else — a partial table missing teams is not acceptable. Only include real facts you found via search, never fabricate.`,
      });

      // A real league table always has well over a handful of teams — anything smaller
      // means the model gave up early rather than genuinely found a tiny league.
      if (output.standings.length < 6) throw new Error(`Too few standings rows (${output.standings.length}), retrying`);
      return output;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
