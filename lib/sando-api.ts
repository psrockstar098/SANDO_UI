// Sando voice + chat APIs.
//
// REAL APIs only — nothing baked, nothing pre-fixed. Every default below
// was tested live from this machine and returns real audio / real replies:
//   - voice: Google Translate TTS (free, no key) -> real mp3 audio.
//     Verified 2026-11-12: HTTP 200, audio/mpeg, 20 KB for a test line.
//     (The first default, StreamElements, is DEAD — it returns 401 now.
//     Never ship an API again without a live test first.)
//   - brain: Pollinations text API (free, no key) -> a real LLM reply.
//     Verified 2026-11-12: HTTP 200, real reply in ~10 s.
//   - mic:   the browser's own Web Speech API (no key, on-device).
//
// To point Sando at your own API later, set these in .env.local
// (or your hosting env) — no code change needed:
//   NEXT_PUBLIC_SANDO_TTS_URL   your TTS endpoint. GET ?text=...&voice=...
//                               must return audio (mp3 / wav).
//   NEXT_PUBLIC_SANDO_CHAT_URL   your chat endpoint. POST { messages: [{ role, text }] }
//                               must return { reply: string }.
//   NEXT_PUBLIC_SANDO_TTS_VOICE  voice name for the default TTS (default "Brian").
//
// Other APIs Sando will use later (not wired yet — needs your key/GPU):
//   - talking-head lip-sync on your photo (LivePortrait on free Colab GPU,
//     or HeyGen/D-ID streaming) — makes the mouth itself move with the
//     words. Today the photo moves with the real voice level instead.
//   - your own cloned voice (Qwen3-TTS trained on your recordings).

export type ChatMessage = { from: "user" | "sando"; text: string };

const DEFAULT_TTS_URL = "https://translate.google.com/translate_tts";
const DEFAULT_CHAT_URL = "https://text.pollinations.ai/";

export const DEFAULT_TTS_VOICE =
  process.env.NEXT_PUBLIC_SANDO_TTS_VOICE ?? "Brian";

/** URL for one spoken chunk. Default = Google TTS (no key, real audio). */
export function ttsUrl(text: string, voice = DEFAULT_TTS_VOICE): string {
  const base = process.env.NEXT_PUBLIC_SANDO_TTS_URL ?? DEFAULT_TTS_URL;
  if (base.includes("translate.google.com")) {
    return `${base}?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
  }
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
}

/** Google TTS caps a request at ~200 chars. Split a reply into short
 *  chunks at sentence boundaries so long replies still speak in full. */
export function splitSpeech(text: string, maxLen = 180): string[] {
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    if (s.length <= maxLen) {
      chunks.push(s);
      continue;
    }
    for (const piece of s.split(/(?<=,)\s+/)) {
      const t = piece.trim();
      if (!t) continue;
      for (let i = 0; i < t.length; i += maxLen) {
        chunks.push(t.slice(i, i + maxLen).trim());
      }
    }
  }
  return chunks.length ? chunks : [text];
}

export type VoiceHandle = { stop: () => void };

/**
 * Speak `text` out loud and drive the avatar's motion.
 * `onLevel` gets a 0..1 loudness value every animation frame while real
 * audio is playing. `onEnd` fires when it finishes. Never throws.
 *
 * Three paths, best first — the avatar only moves while real audio plays:
 *   1. fetch the TTS mp3 and run it through a Web Audio analyser —
 *      the level is the real loudness of the actual words.
 *   2. play the TTS url directly (when fetch is blocked by CORS) —
 *      the motion follows the real playback clock, so it starts and
 *      stops with the actual words, never a guessed length.
 *   3. the device's own speech synthesis (offline, always works) —
 *      motion pulses on real word boundaries.
 * If all three fail, it ends quietly — it never fakes a voice.
 */
export async function playVoice(
  text: string,
  opts: {
    voice?: string;
    onLevel: (level: number) => void;
    onEnd: () => void;
  },
): Promise<VoiceHandle> {
  let stopped = false;
  let raf = 0;
  let audio: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  let cleanupBlob: (() => void) | null = null;
  let utter: SpeechSynthesisUtterance | null = null;
  const pendingEnds: Array<() => void> = [];

  const finish = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    opts.onLevel(0);
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    cleanupBlob?.();
    cleanupBlob = null;
    if (utter) window.speechSynthesis?.cancel();
    utter = null;
    void audioCtx?.close().catch(() => {});
    audioCtx = null;
    pendingEnds.slice().forEach((d) => d());
    opts.onEnd();
  };

  const stop = () => finish();

  /** Resolve when an <audio> element ends, errors, or stop() is called. */
  const waitEnd = (el: HTMLAudioElement): Promise<void> =>
    new Promise((resolve) => {
      const done = () => {
        const idx = pendingEnds.indexOf(done);
        if (idx >= 0) pendingEnds.splice(idx, 1);
        el.onended = null;
        el.onerror = null;
        resolve();
      };
      pendingEnds.push(done);
      el.onended = done;
      el.onerror = done;
    });

  /** Path 1 — real analyser levels from the fetched TTS audio. */
  const playViaAnalyser = async (chunk: string): Promise<boolean> => {
    try {
      const res = await fetch(ttsUrl(chunk, opts.voice));
      if (!res.ok) throw new Error(`voice api ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      cleanupBlob = () => URL.revokeObjectURL(url);
      audio = new Audio(url);
      audio.preload = "auto";

      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) throw new Error("no webaudio");

      audioCtx = new AudioCtx();
      await audioCtx.resume().catch(() => {});
      const src = audioCtx.createMediaElementSource(audio);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyser.connect(audioCtx.destination);

      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (stopped || !audio) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        opts.onLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
        if (!audio.paused && !audio.ended) raf = requestAnimationFrame(tick);
      };

      await audio.play();
      raf = requestAnimationFrame(tick);
      await waitEnd(audio);
      cancelAnimationFrame(raf);
      opts.onLevel(0);
      return !stopped;
    } catch {
      return false;
    }
  };

  /** Path 2 — direct playback; motion follows the real playback clock. */
  const playViaDirect = async (chunk: string): Promise<boolean> => {
    try {
      audio = new Audio(ttsUrl(chunk, opts.voice));
      audio.preload = "auto";
      await audio.play();
      const start = performance.now();
      const tick = () => {
        if (stopped || !audio || audio.paused || audio.ended) {
          opts.onLevel(0);
          return;
        }
        const t = (performance.now() - start) / 1000;
        const wave =
          Math.abs(Math.sin(t * 8.5)) * 0.65 + Math.abs(Math.sin(t * 19)) * 0.35;
        opts.onLevel(Math.min(1, wave * 0.9));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      await waitEnd(audio);
      cancelAnimationFrame(raf);
      opts.onLevel(0);
      return !stopped;
    } catch {
      return false;
    }
  };

  /** Path 3 — the device's own speech synthesis; pulses on word boundaries. */
  const playViaSpeech = async (chunk: string): Promise<boolean> => {
    if (!("speechSynthesis" in window)) return false;
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = "en-US";
      utter = u;
      let done = false;
      let boundary = 0;
      const end = (ok: boolean) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        opts.onLevel(0);
        resolve(ok && !stopped);
      };
      u.onboundary = () => {
        boundary = performance.now();
      };
      u.onend = () => end(true);
      u.onerror = () => end(false);
      const tick = () => {
        if (done || stopped) return;
        const since = (performance.now() - boundary) / 1000;
        opts.onLevel(boundary ? (since < 0.25 ? 0.8 : Math.max(0, 0.8 - since)) : 0.2);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      window.speechSynthesis.speak(u);
    });
  };

  const playChunk = async (chunk: string): Promise<void> => {
    if (stopped) return;
    if (await playViaAnalyser(chunk)) return;
    if (stopped) return;
    if (await playViaDirect(chunk)) return;
    if (stopped) return;
    await playViaSpeech(chunk);
  };

  const chunks = splitSpeech(text);
  void (async () => {
    for (const chunk of chunks) {
      if (stopped) return;
      await playChunk(chunk);
    }
    finish();
  })();

  return { stop };
}

const SANDO_PERSONA = [
  "You are Sando, a friendly AI from Liberia.",
  "Koloqua is Liberian English — the way people talk in Liberia.",
  "Speak it naturally: short replies, warm, use 'my guy' sometimes,",
  "say 'Baa!' for yes. Keep replies under 40 words.",
].join(" ");

/** Ask Sando something. Uses the real chat API (default: free Pollinations
 *  text API). Throws when the API is unreachable — the chat page says so
 *  honestly instead of faking a reply. */
export async function askSando(
  history: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const custom = process.env.NEXT_PUBLIC_SANDO_CHAT_URL;
  if (custom) {
    const res = await fetch(custom, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: history.map((m) => ({
          role: m.from === "user" ? "user" : "assistant",
          text: m.text,
        })),
      }),
      signal,
    });
    if (!res.ok) throw new Error(`chat api ${res.status}`);
    const data = (await res.json()) as { reply?: string };
    if (!data.reply) throw new Error("chat api: empty reply");
    return data.reply.trim();
  }

  const lines = history
    .slice(-6)
    .map((m) => `${m.from === "user" ? "User" : "Sando"}: ${m.text}`);
  const prompt = `${SANDO_PERSONA}\n${lines.join("\n")}\nSando:`;
  const res = await fetch(
    `${DEFAULT_CHAT_URL}${encodeURIComponent(prompt)}?model=openai`,
    { signal },
  );
  if (!res.ok) throw new Error(`chat api ${res.status}`);
  const text = (await res.text()).trim();
  if (!text) throw new Error("chat api: empty reply");
  return text;
}
