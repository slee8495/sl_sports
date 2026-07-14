// Client-side helper for reading chat replies aloud. Prefers the neural /api/speak voice
// (AI Gateway TTS) and falls back to the browser's built-in Web Speech API if that request
// fails (offline, cold start, etc).
//
// Two things this file exists to solve:
// 1. TTS generation time scales with text length, so a long reply took several seconds
//    before any sound played. Text is split into sentence-sized chunks that are all fetched
//    in parallel but played back in order — the first chunk is usually ready in ~1-2s, and
//    later chunks keep generating in the background while earlier ones are still playing.
// 2. Overlapping playback ("multiple voices at once"): if a new speak() call comes in while
//    a previous one is still waiting on generation, the old call would eventually finish and
//    start playing right on top of the new one. A monotonic token invalidates any in-flight
//    call as soon as a newer one starts, so stale audio never gets played.
const audioUrlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();
let currentAudio: HTMLAudioElement | null = null;
let playToken = 0;

const MAX_CHUNK_LENGTH = 200;

function splitIntoChunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let buf = "";
  for (const sentence of sentences) {
    if (buf && buf.length + sentence.length > MAX_CHUNK_LENGTH) {
      chunks.push(buf.trim());
      buf = sentence;
    } else {
      buf += sentence;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

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

// Plays one clip and resolves once it's done — including if it gets paused out from under it
// by a newer speak() call, so a stale chunk sequence can notice and stop instead of hanging.
function playAudio(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;
    const done = () => resolve();
    audio.addEventListener("ended", done, { once: true });
    audio.addEventListener("pause", done, { once: true });
    audio.addEventListener("error", done, { once: true });
    audio.play().catch(done);
  });
}

// Fire-and-forget: warms the cache without playing anything.
export function prefetchSpeech(text: string) {
  if (!text.trim()) return;
  for (const chunk of splitIntoChunks(text)) {
    void fetchAudioUrl(chunk);
  }
}

export async function speak(text: string) {
  if (!text.trim()) return;
  const token = ++playToken;
  stopSpeaking();

  const chunks = splitIntoChunks(text);
  // Kick off every chunk's fetch immediately so later ones generate while earlier ones play.
  const urlPromises = chunks.map((chunk) => fetchAudioUrl(chunk));

  for (let i = 0; i < urlPromises.length; i++) {
    const url = await urlPromises[i];
    if (token !== playToken) return; // a newer speak() call superseded this one

    if (!url) {
      speakWithBrowserVoice(chunks.slice(i).join(" "));
      return;
    }
    await playAudio(url);
    if (token !== playToken) return;
  }
}
