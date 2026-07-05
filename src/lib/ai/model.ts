import { anthropic } from "@ai-sdk/anthropic";

// Cheaper model for the recurring cron-driven data fetches (structured extraction,
// doesn't need frontier reasoning). The interactive chat assistant uses CHAT_MODEL instead,
// since that's on-demand/low-volume and benefits more from a stronger model.
export const MODEL = "anthropic/claude-haiku-4.5";
export const CHAT_MODEL = "anthropic/claude-sonnet-5";

export function webSearchTool(maxUses = 4) {
  return anthropic.tools.webSearch_20250305({ maxUses });
}
