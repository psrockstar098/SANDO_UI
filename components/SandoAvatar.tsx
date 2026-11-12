"use client";

import React, { useEffect, useRef } from "react";

/**
 * Sando — live avatar for the chat page.
 *
 * Dominic's own photo, moved in real time by the live voice level.
 * Nothing is pre-baked: the photo breathes and drifts on its own, and
 * while Sando speaks it nods and sways with the real audio — the motion
 * comes from the voice that is actually playing, frame by frame.
 *
 *   idle      — slow breathing, gentle drift
 *   listening — leans in while you talk
 *   thinking  — tilts, like it is considering
 *   talking   — nods and sways with the real voice level (see levelRef)
 *
 * `levelRef` is a shared 0..1 loudness value written by the voice player
 * (real analyser data from the TTS audio). The thin bar at the bottom of
 * the photo shows that same live level. The ring brightens while talking.
 *
 * Honest limit: a still photo's mouth cannot morph in a browser. True
 * lip-sync on this face needs a talking-head model (LivePortrait on a
 * free Colab GPU, or HeyGen / D-ID streaming) — that is the next step,
 * and it plugs into lib/sando-api.ts the same way the voice does.
 */
export type AvatarState = "idle" | "listening" | "thinking" | "talking";

export function SandoAvatar({
  state,
  levelRef,
  className,
}: {
  state: AvatarState;
  levelRef: { current: number };
  className?: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<AvatarState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let smooth = 0; // smoothed voice level

    const tick = (now: number) => {
      const t = now / 1000;
      const s = stateRef.current;

      // --- voice level (real audio only) ---------------------------------
      const target = s === "talking" ? levelRef.current : 0;
      smooth += (target - smooth) * 0.25;

      // --- pose -----------------------------------------------------------
      const breathe = reduced ? 0 : Math.sin(t * 1.4);
      const sway = reduced ? 0 : Math.sin(t * 0.5);
      let scale = 1 + breathe * 0.006;
      let rotate = sway * 0.6;
      let ty = breathe * 2;

      if (s === "listening") {
        scale += 0.02;
        rotate = 0.5 + sway * 0.3;
      } else if (s === "thinking") {
        rotate = -2.5 + sway * 0.3;
      } else if (s === "talking") {
        // nod + sway with the voice: stronger when the voice is loud
        scale += smooth * 0.02;
        rotate += Math.sin(t * 6) * 1.2 * smooth;
        ty += Math.sin(t * 6) * 1.5 * smooth;
      }

      // --- write transforms (direct DOM, no React state) ------------------
      imgRef.current?.style.setProperty(
        "transform",
        `translateY(${ty.toFixed(2)}px) scale(${scale.toFixed(4)}) rotate(${rotate.toFixed(2)}deg)`,
      );
      ringRef.current?.style.setProperty(
        "opacity",
        `${s === "talking" ? 0.15 + smooth * 0.6 : s === "listening" ? 0.35 : 0.12}`,
      );
      ringRef.current?.style.setProperty(
        "transform",
        `scale(${(1 + smooth * 0.03).toFixed(4)})`,
      );
      meterRef.current?.style.setProperty(
        "width",
        `${(smooth * 100).toFixed(1)}%`,
      );

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div
      role="img"
      aria-label="Sando — Dominic's photo, live avatar"
      className={`relative h-full w-full overflow-hidden ${className ?? ""}`}
    >
      <img
        ref={imgRef}
        src="/sando-photo.jpg"
        alt="Dominic, the face of Sando"
        draggable={false}
        className="h-full w-full object-cover object-top will-change-transform"
      />
      <div
        ref={ringRef}
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/40 opacity-[0.12]"
      />
      <div className="absolute inset-x-4 bottom-3 h-1 overflow-hidden rounded-full bg-white/15">
        <div
          ref={meterRef}
          className="h-full rounded-full bg-white"
          style={{ width: "0%" }}
        />
      </div>
    </div>
  );
}
