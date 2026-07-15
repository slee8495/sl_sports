import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { MODEL } from "@/lib/ai/model";
import { isAuthorizedRequest } from "@/lib/apiAuth";

export const maxDuration = 30;

// Typo/spacing cleanup pass for the SLKeyboard iOS app's voice-dictated (or typed) text.
// Uses the cheap MODEL (not CHAT_MODEL) since this is a small, low-stakes text-in/text-out
// task that needs to be fast, not clever.
export async function POST(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { text } = await req.json();
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const { text: corrected } = await generateText({
      model: MODEL,
      system:
        "You correct typos and spacing/punctuation in short pieces of text (Korean or English). " +
        "Fix only spelling, spacing, and obvious punctuation mistakes. Do not change word choice, tone, " +
        "grammatical structure, or meaning beyond that, and do not add or remove content. " +
        "Reply with ONLY the corrected text — no quotes, no explanation, no preamble.",
      prompt: text,
    });
    return NextResponse.json({ text: corrected.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "correction failed", detail: message }, { status: 500 });
  }
}
