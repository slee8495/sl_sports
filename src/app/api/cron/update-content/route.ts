import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cronAuth";
import { runContentUpdate, runContentUpdateRotating } from "@/lib/updaters";

export const maxDuration = 300;

// Daily cron: refreshes just one team (rotating through all teams over ~10 days) to keep
// AI Gateway spend low. Pass ?all=true to force-refresh every team at once (manual/admin use).
export async function GET(req: NextRequest) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const all = req.nextUrl.searchParams.get("all") === "true";
  if (all) {
    const results = await runContentUpdate();
    return NextResponse.json({ mode: "all", results });
  }

  const result = await runContentUpdateRotating();
  return NextResponse.json({ mode: "rotating", result });
}
