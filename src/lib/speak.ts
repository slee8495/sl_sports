// Client-side helper for reading chat replies aloud. Prefers the neural /api/speak voice
// (AI Gateway TTS) and falls back to the browser's built-in Web Speech API if that request
// fails (offline, cold start, etc).
const audioUrlCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

function speakWithBrowserVoice(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export async function speak(text: string) {
  if (!text.trim()) return;
  stopSpeaking();

  try {
    let url = audioUrlCache.get(text);
    if (!url) {
      const res = await fetch(`/api/speak?text=${encodeURIComponent(text)}`);
      if (!res.ok) throw new Error("tts request failed");
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      audioUrlCache.set(text, url);
    }
    currentAudio = new Audio(url);
    await currentAudio.play();
  } catch {
    speakWithBrowserVoice(text);
  }
}
