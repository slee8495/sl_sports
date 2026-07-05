import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cronAuth";
import { runProfileUpdate } from "@/lib/updaters";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const results = await runProfileUpdate();
  return NextResponse.json({ results });
}
