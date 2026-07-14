// Client-side helper for reading chat replies aloud. Prefers the neural /api/speak voice
// (AI Gateway TTS) and falls back to the browser's built-in Web Speech API if that request
// fails (offline, cold start, etc).
//
// Generation takes a few seconds, which feels slow if it only starts once the user clicks
// play. prefetchSpeech() lets the caller kick off generation as soon as a reply is ready,
// so by the time the user actually clicks, speak() usually just plays an already-fetched
// blob url instead of waiting on the network call.
const audioUrlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();
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

function fetchAudioUrl(text: string): Promise<string | null> {
  const cached = audioUrlCache.get(text);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(text);
  if (pending) return pending;

  const promise = fetch(`/api/speak?text=${encodeURIComponent(text)}`)
    .then((res) => {
      if (!res.ok) throw new Error("tts request failed");
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      audioUrlCache.set(text, url);
      return url;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(text));

  inFlight.set(text, promise);
  return promise;
}

// Fire-and-forget: warms the cache without playing anything.
export function prefetchSpeech(text: string) {
  if (!text.trim()) return;
  void fetchAudioUrl(text);
}

export async function speak(text: string) {
  if (!text.trim()) return;
  stopSpeaking();

  const url = await fetchAudioUrl(text);
  if (!url) {
    speakWithBrowserVoice(text);
    return;
  }
  currentAudio = new Audio(url);
  await currentAudio.play();
}
