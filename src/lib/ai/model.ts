import { anthropic } from "@ai-sdk/anthropic";

// Cheaper model for the recurring cron-driven data fetches (structured extraction,
// doesn't need frontier reasoning). The interactive chat assistant uses CHAT_MODEL instead,
// since that's on-demand/low-volume and benefits more from a stronger model.
export const MODEL = "anthropic/claude-haiku-4.5";
export const CHAT_MODEL = "anthropic/claude-sonnet-5";
// Routed through AI Gateway's speech.() / transcription.() helpers, not plain model id strings.
// tts-1 (not tts-1-hd) — noticeably faster generation, which matters more here than the
// slightly higher fidelity since replies are prefetched but still need to feel responsive.
export const SPEECH_MODEL_ID = "openai/tts-1";
// whisper-1, not gpt-4o-mini-transcribe: the gpt-4o-transcribe family has a known bug where
// language auto-detection is unreliable (especially on short clips) and ignores/soft-prefers
// any language hint, which showed up as Korean/English/Japanese voice input all coming back
// as Korean in the SLKeyboard app. whisper-1's auto-detect is far more dependable.
export const TRANSCRIPTION_MODEL_ID = "openai/whisper-1";

export function webSearchTool(maxUses = 4) {
  return anthropic.tools.webSearch_20250305({ maxUses });
}
