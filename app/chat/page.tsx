"use client";

import React, { useEffect, useRef, useState } from "react";
import { SandoAvatar, type AvatarState } from "@/components/SandoAvatar";
import { Icon } from "@/components/Icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  askSando,
  cannedReply,
  playVoice,
  type ChatMessage,
  type VoiceHandle,
} from "@/lib/sando-api";

// Voice input (Chrome / Edge). Typed narrowly on purpose — the
// SpeechRecognition API is not in the default TS DOM lib.
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((e: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SUGGESTIONS = [
  "How the body today?",
  "I dey reach my hou’ now",
  "Talk Koloqua with me",
] as const;

const STATE_LABEL: Record<AvatarState, string> = {
  idle: "Idle",
  listening: "Listening…",
  thinking: "Thinking…",
  talking: "Speaking…",
};

export default function ChatHome() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("sando-voice") !== "off";
  });

  const levelRef = useRef(0);
  const voiceRef = useRef<VoiceHandle | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lastSando = [...messages].reverse().find((m) => m.from === "sando");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const toggleVoice = () => {
    const next = !voiceOn;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sando-voice", next ? "on" : "off");
    }
    if (!next) {
      voiceRef.current?.stop();
      voiceRef.current = null;
      levelRef.current = 0;
      setAvatarState((s) => (s === "talking" ? "idle" : s));
    }
    setVoiceOn(next);
  };

  const speak = async (text: string) => {
    if (!voiceOn) return;
    voiceRef.current?.stop();
    setAvatarState("talking");
    voiceRef.current = await playVoice(text, {
      onLevel: (v) => {
        levelRef.current = v;
      },
      onEnd: () => {
        levelRef.current = 0;
        voiceRef.current = null;
        setAvatarState("idle");
      },
    });
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    voiceRef.current?.stop();
    voiceRef.current = null;
    const next: ChatMessage[] = [...messages, { from: "user", text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    setAvatarState("thinking");

    let reply: string;
    try {
      reply = await askSando(next);
    } catch {
      reply = cannedReply(text);
    }

    setMessages([...next, { from: "sando", text: reply }]);
    setThinking(false);
    await speak(reply);
    inputRef.current?.focus();
  };

  const startListening = () => {
    const SR = getSpeechRecognition();
    if (!SR || listening) return;
    const rec = new SR();
    rec.lang = "en-LR";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? "";
      if (said.trim()) void send(said);
    };
    rec.onend = () => {
      setListening(false);
      setAvatarState("idle");
    };
    rec.onerror = () => {
      setListening(false);
      setAvatarState("idle");
    };
    setListening(true);
    setAvatarState("listening");
    rec.start();
  };

  const stopSpeaking = () => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    levelRef.current = 0;
    setAvatarState("idle");
  };

  return (
    <section className="relative p-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-black">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-3">
          <p className="font-zentry text-xl tracking-wide">Sando</p>
          <span
            className={cn(
              "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground",
              avatarState === "talking" && "border-white/40 text-foreground",
              avatarState === "listening" && "border-white/40 text-foreground",
            )}
            aria-live="polite"
          >
            {STATE_LABEL[avatarState]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {avatarState === "talking" && (
            <button
              type="button"
              onClick={stopSpeaking}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "rounded-full",
              )}
            >
              <Icon name="stop" size={14} />
              Stop
            </button>
          )}
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={voiceOn}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "rounded-full",
            )}
          >
            <Icon name="mic" size={15} />
            Voice {voiceOn ? "on" : "off"}
          </button>
        </div>
      </header>

      {/* Body: live avatar + conversation */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
        {/* Live avatar stage */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 md:w-[360px]">
          <button
            type="button"
            onClick={() => {
              if (lastSando) void speak(lastSando.text);
            }}
            disabled={!lastSando}
            title="Tap to hear the last reply again"
            className="w-full max-w-[300px] cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
          >
            <SandoAvatar
              state={avatarState}
              levelRef={levelRef}
              className="h-auto w-full"
            />
          </button>
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {avatarState === "listening" &&
              "Sando is listening — talk now, my guy."}
            {avatarState === "thinking" && "Sando is thinking…"}
            {avatarState === "talking" && "Sando is speaking…"}
            {avatarState === "idle" &&
              (lastSando
                ? "Tap Sando to hear the last reply again."
                : "Say hello — Sando talks back in Koloqua.")}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Demo voice is English for now — swap in your own voice API later
            (see lib/sando-api.ts).
          </p>
        </div>

        {/* Conversation */}
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-black">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && !thinking && (
              <div className="animate-rise m-auto max-w-md text-center">
                <p className="text-lg font-medium">
                  How the body today, my guy?
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Talk to Sando in Koloqua or English. Sando listens,
                  thinks, and answers back — out loud.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "rounded-full",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <p
                key={`${i}-${m.text.slice(0, 12)}`}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  m.from === "user"
                    ? "self-end rounded-br-sm bg-primary text-primary-foreground"
                    : "self-start rounded-bl-sm bg-secondary",
                )}
              >
                {m.text}
              </p>
            ))}

            {thinking && (
              <p className="flex gap-1.5 self-start rounded-2xl rounded-bl-sm bg-secondary px-4 py-3">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="size-2 animate-bounce rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-border p-3">
            <button
              type="button"
              onClick={startListening}
              disabled={listening || thinking || !getSpeechRecognition()}
              title={
                getSpeechRecognition()
                  ? "Talk to Sando"
                  : "Voice input is not supported in this browser"
              }
              className={cn(
                buttonVariants({
                  variant: listening ? "default" : "outline",
                  size: "icon",
                }),
                "shrink-0 rounded-full",
              )}
            >
              <Icon name="mic" size={17} />
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send(input);
              }}
              placeholder="Talk to Sando…"
              aria-label="Message Sando"
              className="h-11 min-w-0 flex-1 rounded-full border border-input bg-secondary/60 px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={!input.trim() || thinking}
              className={cn(
                buttonVariants({ size: "lg" }),
                "shrink-0 rounded-full px-5",
              )}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
