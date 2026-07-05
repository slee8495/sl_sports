import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cronAuth";
import { runMediaUpdate } from "@/lib/updaters";

export const maxDuration = 300;

// Not wired to a Vercel Cron (Hobby plan only allows daily crons; see /api/cron/update-content).
// Kept for manual/admin re-triggering.
export async function GET(req: NextRequest) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const results = await runMediaUpdate();
  return NextResponse.json({ results });
}
