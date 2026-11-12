"use client";

import React, { useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

// Put your demo clips in public/audio/
const tracks = [
  { id: "koloqua", label: "Monrovia Koloqua", src: "/audio/koloqua.mp3" },
  { id: "gio", label: "Nimba Gio / Dan", src: "/audio/gio.mp3" },
  { id: "bassa", label: "Grand Bassa", src: "/audio/bassa.mp3" },
  { id: "kpelle", label: "Bong Kpelle", src: "/audio/kpelle.mp3" },
];

const BARS = Array.from(
  { length: 40 },
  (_, i) => 20 + Math.abs(Math.sin(i * 1.3) * 60) + (i % 3) * 6,
);

export function HearSando() {
  const [id, setId] = useState(tracks[0].id);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const track = tracks.find((t) => t.id === id) ?? tracks[0];

  const change = (v: string) => {
    audio.current?.pause();
    setId(v);
    setPlaying(false);
    setProgress(0);
    setError(false);
  };

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setError(true));
    else a.pause();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <Tabs value={id} onValueChange={change}>
        <TabsList className="h-auto w-full flex-wrap justify-start">
          {tracks.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/85"
        >
          <Icon name={playing ? "pause" : "play"} size={22} />
        </button>
        <div className="flex h-14 flex-1 items-center gap-[3px]" aria-hidden>
          {BARS.map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={cn(
                "flex-1 rounded-full",
                i / BARS.length < progress ? "bg-foreground" : "bg-border",
              )}
            />
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        {error
          ? "Demo audio isn’t available yet. Check back soon."
          : `Hear Sando speak ${track.label}. No account needed.`}
      </p>

      <audio
        key={track.id}
        ref={audio}
        src={track.src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) =>
          setProgress(
            e.currentTarget.duration
              ? e.currentTarget.currentTime / e.currentTarget.duration
              : 0,
          )
        }
        onError={() => {
          setError(true);
          setPlaying(false);
        }}
      />
    </div>
  );
}
