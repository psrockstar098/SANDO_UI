// Sando voice + chat APIs.
//
// Real APIs today, swappable tomorrow. The defaults below need no key:
//   - voice: StreamElements TTS (free, no key) -> mp3 audio
//   - chat:  Pollinations text API (free, no key) -> a Koloqua-flavoured reply
//
// To point Sando at your own API later, set these in .env.local
// (or your hosting env) — no code change needed:
//   NEXT_PUBLIC_SANDO_TTS_URL   your TTS endpoint. GET ?text=...&voice=...
//                               must return audio (mp3 / wav).
//   NEXT_PUBLIC_SANDO_CHAT_URL   your chat endpoint. POST { messages: [{ role, text }] }
//                               must return { reply: string }.
//   NEXT_PUBLIC_SANDO_TTS_VOICE  voice name for the default TTS (default "Brian").

export type ChatMessage = { from: "user" | "sando"; text: string };

const DEFAULT_TTS_URL =
  "https://api.streamelements.com/kappa/v2/speech";
const DEFAULT_CHAT_URL = "https://text.pollinations.ai/";

export const DEFAULT_TTS_VOICE =
  process.env.NEXT_PUBLIC_SANDO_TTS_VOICE ?? "Brian";

/** URL for one spoken line. Works for the default TTS and for a custom
 *  endpoint that takes ?text= and &voice=. */
export function ttsUrl(text: string, voice = DEFAULT_TTS_VOICE): string {
  const base =
    process.env.NEXT_PUBLIC_SANDO_TTS_URL ?? DEFAULT_TTS_URL;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
}

/** Fetch one spoken line as a same-origin blob URL, so the audio can be
 *  routed through an analyser for real lip-sync. Returns the blob URL
 *  plus a cleanup function. Throws when the API is unreachable. */
export async function fetchVoiceAudio(
  text: string,
  voice = DEFAULT_TTS_VOICE,
): Promise<{ url: string; cleanup: () => void }> {
  const res = await fetch(ttsUrl(text, voice));
  if (!res.ok) throw new Error(`voice api ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { url, cleanup: () => URL.revokeObjectURL(url) };
}

export type VoiceHandle = { stop: () => void };

/**
 * Speak `text` out loud and drive the avatar's mouth.
 * `onLevel` gets a 0..1 loudness value every animation frame while the
 * audio plays (real analyser data). `onEnd` fires when it finishes.
 * Falls back to a timed mouth envelope when the analyser path is blocked
 * (e.g. autoplay rules), and resolves quietly — never throws — so the
 * chat keeps working even if the voice API is down.
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
  let audio: HTMLAudioElement | null = null;
  let raf = 0;
  let cleanupBlob: (() => void) | null = null;
  let audioCtx: AudioContext | null = null;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    opts.onLevel(0);
    audio?.pause();
    cleanupBlob?.();
    void audioCtx?.close().catch(() => {});
    opts.onEnd();
  };

  const stop = () => finish();

  const fallbackEnvelope = (ms: number) => {
    // No analyser (autoplay / CORS block): open the mouth on a
    // syllable-like rhythm for the estimated length of the line.
    const start = performance.now();
    const tick = () => {
      if (stopped) return;
      const t = (performance.now() - start) / 1000;
      if (t * 1000 >= ms) return finish();
      const wave =
        Math.abs(Math.sin(t * 9)) * 0.7 + Math.abs(Math.sin(t * 23)) * 0.3;
      opts.onLevel(Math.min(1, wave));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  try {
    const { url, cleanup } = await fetchVoiceAudio(text, opts.voice);
    cleanupBlob = cleanup;
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

    audio.onended = () => finish();
    audio.onerror = () => finish();
    await audio.play();
    raf = requestAnimationFrame(tick);
  } catch {
    // Voice API unreachable: still animate the mouth for the line's
    // estimated length so the avatar keeps acting while it "speaks".
    const words = text.trim().split(/\s+/).length;
    fallbackEnvelope(Math.max(1200, (words / 2.6) * 1000));
  }

  return { stop };
}

const SANDO_PERSONA = [
  "You are Sando, a friendly AI from Liberia.",
  "You speak Liberian English (Koloqua) naturally: short replies, warm,",
  "use 'my guy' sometimes, say 'Baa!' for yes.",
  "Answer in Koloqua-flavoured English. Keep replies under 40 words.",
].join(" ");

/** Ask Sando something. Uses the chat API (default: free Pollinations text
 *  API). Throws when the API is unreachable — the chat page falls back
 *  to built-in Koloqua replies so the conversation never dies. */
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

/** Built-in Koloqua replies, used only when the chat API is down. */
export function cannedReply(text: string): string {
  const t = text.toLowerCase();
  if (/(hello|hi\b|hey|how the body|how you do|morning|afternoon)/.test(t))
    return "Baa! Body fine, my guy. And you, how you do?";
  if (/(hou|home|reach|going|leaving)/.test(t))
    return "Ah, you’re setting off for home. Safe road, my guy!";
  if (/(thank|tenki)/.test(t))
    return "You welcome, my guy. Anything else?";
  if (/(koloqua|dialect|liberia|speak)/.test(t))
    return "I can talk Koloqua with you, my guy. Ask me anything, I go answer you in Koloqua.";
  if (/(who are you|your name|sando)/.test(t))
    return "I be Sando — the first AI that speaks pure Liberian English and native dialects.";
  return "I hear you, my guy. Tell me more, I dey listen.";
}
