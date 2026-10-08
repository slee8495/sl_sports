// SLKeyboard 앱이 부르는 두 엔드포인트(/api/correct, /api/transcribe)만 모델을 쓴다.
// 팀 데이터는 모델을 안 쓴다 — README 참고.
export const MODEL = "anthropic/claude-haiku-4.5";
// whisper-1, not gpt-4o-mini-transcribe: the gpt-4o-transcribe family has a known bug where
// language auto-detection is unreliable (especially on short clips) and ignores/soft-prefers
// any language hint, which showed up as Korean/English/Japanese voice input all coming back
// as Korean in the SLKeyboard app. whisper-1's auto-detect is far more dependable.
export const TRANSCRIPTION_MODEL_ID = "openai/whisper-1";
