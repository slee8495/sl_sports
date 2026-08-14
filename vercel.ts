import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Crons disabled 2026-08-14 to stop recurring AI Gateway spend while this app
  // is paused. Re-add the update-content (daily) and update-profiles (monthly)
  // cron entries to resume automatic data refreshes.
  crons: [],
};
