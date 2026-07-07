import { generateText, Output, isStepCount } from "ai";
import { z } from "zod";
import { MODEL, webSearchTool } from "./model";
import { retry } from "./retry";
import type { teams } from "@/db/schema";

const profileSchema = z.object({
  logoUrl: z
    .string()
    .url()
    .nullable()
    .describe("Direct URL to the team's official logo/crest image (prefer Wikipedia/Wikimedia Commons)"),
  history: z.string().describe("2-4 short paragraphs on the team's history and identity"),
  stadiumName: z.string(),
  stadiumDescription: z.string().describe("1-2 paragraphs describing the home stadium/arena"),
  stadiumPhotoUrls: z
    .array(z.string().url())
    .max(4)
    .describe(
      "Direct image URLs of the stadium, ideally including at least one exterior and one interior shot. Prefer Wikipedia/Wikimedia Commons file URLs, which are stable and reliable.",
    ),
  stadiumVideoUrl: z.string().url().nullable().describe("A YouTube (or similar) stadium tour / intro video URL, if found"),
  coachName: z.string().describe("Current head coach/manager name"),
  coachBio: z.string().describe("1 short paragraph on the coach"),
  players: z
    .array(
      z.object({
        name: z.string(),
        position: z.string(),
        number: z.string().nullable(),
        isStarPlayer: z.boolean(),
        bio: z.string().nullable(),
        photoUrl: z
          .string()
          .url()
          .nullable()
          .describe("Only fill this in for star players; a direct photo URL, preferably from Wikipedia/Wikimedia Commons"),
      }),
    )
    .describe("Current roster; flag isStarPlayer true for the 3-5 most notable players"),
});

export type TeamProfile = z.infer<typeof profileSchema>;

export async function fetchTeamProfile(team: typeof teams.$inferSelect): Promise<TeamProfile> {
  return retry(async () => {
    const { output } = await generateText({
      model: MODEL,
      tools: { web_search: webSearchTool(10) },
      stopWhen: isStepCount(14),
      output: Output.object({ schema: profileSchema }),
      prompt: `Research the current, up-to-date profile for the ${team.sport} team "${team.name}" (${team.league ?? ""}, ${team.country ?? ""}).

Use web search to find real, current information:
- Official team logo/crest: a direct image URL (search Wikipedia/Wikimedia Commons for the team, e.g. "site:commons.wikimedia.org ${team.name} logo")
- Team history and identity
- Home stadium/arena: name, description, and real photo URLs — actively look for BOTH an exterior/outside shot and an interior/inside-the-stands shot. Search Wikipedia/Wikimedia Commons for the stadium's own page (e.g. "site:commons.wikimedia.org <stadium name>"), since those file URLs are stable and rarely broken. Also find a real intro/tour video URL if one exists.
- Current head coach/manager, with a short bio
- Current roster (as many players as you can confirm), with position and jersey number, marking the 3-5 biggest star players. For those star players only, also find a direct photo URL (prefer Wikipedia/Wikimedia Commons).

For any Wikimedia Commons image, the URL you output MUST be the direct file link in the exact form https://commons.wikimedia.org/wiki/Special:FilePath/<file name>.<ext> (this serves the raw image). Do NOT output the file's description page (https://commons.wikimedia.org/wiki/File:<file name>.<ext>) — that is an HTML page, not an image, and will not display.

Only include facts and URLs you actually found via search — never guess or construct a plausible-looking URL. It is fine to leave logoUrl, stadiumVideoUrl, or a player's photoUrl as null if you can't find a real one.`,
    });

    return output;
  });
}
