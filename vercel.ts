import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // Runs daily, but only refreshes ONE team per day (rotating through all 10 teams
    // over ~10 days — see runContentUpdateRotating). ~10x cheaper than refreshing every
    // team daily, since realistically nobody reads 10 teams' worth of news in one day anyway.
    { path: "/api/cron/update-content", schedule: "0 13 * * *" },
    // History/stadium/coach/roster change slowly, so this only needs to run monthly,
    // not daily — cuts the biggest chunk of recurring AI Gateway spend.
    { path: "/api/cron/update-profiles", schedule: "0 14 1 * *" },
  ],
};
