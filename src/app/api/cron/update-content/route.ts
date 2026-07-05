import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cronAuth";
import { runContentUpdate, runContentUpdateGroup } from "@/lib/updaters";

export const maxDuration = 300;

// Daily cron: refreshes one of 3 team groups (each team refreshes every ~3 days) to keep
// AI Gateway spend low. Pass ?all=true to force-refresh every team at once (manual/admin use).
export async function GET(req: NextRequest) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const all = req.nextUrl.searchParams.get("all") === "true";
  if (all) {
    const results = await runContentUpdate();
    return NextResponse.json({ mode: "all", results });
  }

  const { group, results } = await runContentUpdateGroup();
  return NextResponse.json({ mode: "group", group, results });
}
