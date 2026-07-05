import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // Runs daily at 13:00 UTC = 6:00am Pacific (PDT, roughly Mar-Nov) / 5:00am Pacific
    // (PST, roughly Nov-Mar) — Vercel Cron only runs on fixed UTC times, so this drifts by
    // 1hr across the DST switch, but always lands in the early-morning PT window before
    // the US west coast wakes up. Refreshes one of 3 team groups per day (see
    // runContentUpdateGroup) — each team refreshes every ~3 days, not all 10 teams daily.
    { path: "/api/cron/update-content", schedule: "0 13 * * *" },
    // Runs monthly on the 1st at 14:00 UTC = 6-7am Pacific (same DST caveat as above).
    // History/stadium/coach/roster change slowly, so this only needs to run monthly,
    // not daily — cuts the biggest chunk of recurring AI Gateway spend.
    { path: "/api/cron/update-profiles", schedule: "0 14 1 * *" },
  ],
};
