"use client";

import React, { useEffect, useRef } from "react";

/**
 * Sando — live avatar for the chat page.
 *
 * A black & white illustration (same theme as the rest of Sando: neutrals
 * only), animated every frame in plain JS — no React re-render per frame.
 * It breathes, blinks, looks around, and reacts to what is happening:
 *
 *   idle      — breathing, slow sway, blinking, looking around
 *   listening — leans in, brows up, small nods while you talk
 *   thinking  — head tilts, eyes look up, brows raised
 *   talking   — mouth opens with the real voice level (see levelRef)
 *
 * `levelRef` is a shared 0..1 loudness value written by the voice player
 * (real analyser data from the TTS audio). The avatar reads it and moves
 * the mouth to match — that is what makes it look like it is speaking.
 */
export type AvatarState = "idle" | "listening" | "thinking" | "talking";

const SKIN = "#b8b8b8";
const SKIN_SHADE = "#9a9a9a";
const HAIR = "#161616";
const SHIRT = "#ededed";
const SHIRT_SHADE = "#d2d2d2";
const LINE = "#6f6f6f";

function scaleAt(cx: number, cy: number, sx: number, sy: number) {
  return `translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;
}

export function SandoAvatar({
  state,
  levelRef,
  className,
}: {
  state: AvatarState;
  levelRef: { current: number };
  className?: string;
}) {
  const headRef = useRef<SVGGElement>(null);
  const shouldersRef = useRef<SVGGElement>(null);
  const eyeLRef = useRef<SVGGElement>(null);
  const eyeRRef = useRef<SVGGElement>(null);
  const pupilLRef = useRef<SVGCircleElement>(null);
  const pupilRRef = useRef<SVGCircleElement>(null);
  const browLRef = useRef<SVGPathElement>(null);
  const browRRef = useRef<SVGPathElement>(null);
  const mouthOpenRef = useRef<SVGEllipseElement>(null);
  const mouthSmileRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const stateRef = useRef<AvatarState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let smooth = 0; // smoothed mouth level
    let nextBlink = performance.now() + 1800;
    let blinkStart = 0;
    let nextGaze = performance.now() + 3000;
    const gaze = { x: 0, y: 0 };
    let gazeTarget = { x: 0, y: 0 };
    let lastNod = performance.now();

    const tick = (now: number) => {
      const t = now / 1000;
      const s = stateRef.current;

      // --- blink ---------------------------------------------------------
      if (now >= nextBlink) {
        blinkStart = now;
        nextBlink = now + 2200 + Math.random() * 2800;
      }
      const blinkP = (now - blinkStart) / 140;
      const blink =
        blinkP >= 0 && blinkP <= 1 ? Math.sin(blinkP * Math.PI) : 0;
      const eyeSy = 1 - blink * 0.92;

      // --- gaze (look around when idle) ----------------------------------
      if (now >= nextGaze) {
        nextGaze = now + 3500 + Math.random() * 3500;
        gazeTarget =
          s === "thinking"
            ? { x: (Math.random() - 0.5) * 4, y: -4 }
            : { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 6 };
      }
      gaze.x += (gazeTarget.x - gaze.x) * 0.04;
      gaze.y += (gazeTarget.y - gaze.y) * 0.04;

      // --- mouth (real voice level when talking) -------------------------
      const target = s === "talking" ? levelRef.current : 0;
      smooth += (target - smooth) * 0.3;

      // --- head pose ------------------------------------------------------
      const breathe = reduced ? 0 : Math.sin(t * 1.4);
      const sway = reduced ? 0 : Math.sin(t * 0.5) * 1.4;
      let tilt = sway;
      let headY = breathe * 1.2;
      let browLift = 0;
      let nod = 0;

      if (s === "thinking") {
        tilt = -5 + sway * 0.5;
        browLift = -3.5;
      } else if (s === "listening") {
        tilt = 1.5 + sway * 0.5;
        headY += 2;
        browLift = -1.5;
        // small nod every couple of seconds while you talk
        if (now - lastNod > 2400) {
          lastNod = now;
        }
        const nodP = (now - lastNod) / 500;
        if (nodP >= 0 && nodP <= 1) nod = Math.sin(nodP * Math.PI) * 3;
      } else if (s === "talking") {
        // nod with the voice: stronger when the mouth is open
        nod = Math.sin(t * 6) * 1.6 * smooth + Math.sin(t * 2.2) * 0.8;
      }

      // --- write transforms (direct DOM, no React state) ------------------
      headRef.current?.setAttribute(
        "transform",
        `translate(160 ${150 + headY}) rotate(${tilt + nod * 0.4}) translate(-160 -150)`,
      );
      shouldersRef.current?.setAttribute(
        "transform",
        `translate(0 ${breathe * 1.6})`,
      );
      eyeLRef.current?.setAttribute("transform", scaleAt(132, 148, 1, eyeSy));
      eyeRRef.current?.setAttribute("transform", scaleAt(188, 148, 1, eyeSy));
      pupilLRef.current?.setAttribute(
        "transform",
        `translate(${gaze.x} ${gaze.y})`,
      );
      pupilRRef.current?.setAttribute(
        "transform",
        `translate(${gaze.x} ${gaze.y})`,
      );
      browLRef.current?.setAttribute(
        "transform",
        `translate(0 ${browLift})`,
      );
      browRRef.current?.setAttribute(
        "transform",
        `translate(0 ${browLift})`,
      );
      mouthOpenRef.current?.setAttribute("ry", `${2 + smooth * 13}`);
      mouthOpenRef.current?.setAttribute(
        "opacity",
        `${smooth < 0.04 ? 0 : Math.min(1, smooth * 3)}`,
      );
      mouthSmileRef.current?.setAttribute(
        "opacity",
        `${1 - Math.min(1, smooth * 2.4)}`,
      );
      ringRef.current?.setAttribute(
        "opacity",
        `${s === "talking" ? 0.1 + smooth * 0.35 : s === "listening" ? 0.14 : 0.06}`,
      );

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <svg
      viewBox="0 0 320 340"
      role="img"
      aria-label="Sando, your Liberian AI — live avatar"
      className={className}
    >
      <defs>
        <radialGradient id="sandoGlow" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="160" cy="165" r="150" fill="url(#sandoGlow)" />
      <circle
        ref={ringRef}
        cx="160"
        cy="165"
        r="148"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity="0.06"
      />

      {/* shoulders / white tee */}
      <g ref={shouldersRef}>
        <path
          d="M40 340 C48 292 96 272 160 272 C224 272 272 292 280 340 Z"
          fill={SHIRT}
        />
        <path
          d="M138 276 Q160 292 182 276 L182 288 Q160 300 138 288 Z"
          fill={SHIRT_SHADE}
        />
      </g>

      {/* head */}
      <g ref={headRef}>
        {/* neck */}
        <rect x="146" y="226" width="28" height="46" rx="9" fill={SKIN_SHADE} />
        {/* ears */}
        <ellipse cx="86" cy="152" rx="9" ry="14" fill={SKIN} />
        <ellipse cx="234" cy="152" rx="9" ry="14" fill={SKIN} />
        {/* face */}
        <ellipse cx="160" cy="150" rx="74" ry="86" fill={SKIN} />
        <ellipse
          cx="160"
          cy="196"
          rx="46"
          ry="30"
          fill={SKIN_SHADE}
          opacity="0.35"
        />
        {/* short curly hair */}
        <g fill={HAIR}>
          <circle cx="100" cy="96" r="17" />
          <circle cx="122" cy="78" r="19" />
          <circle cx="148" cy="68" r="20" />
          <circle cx="176" cy="66" r="20" />
          <circle cx="202" cy="76" r="19" />
          <circle cx="222" cy="94" r="17" />
          <circle cx="92" cy="118" r="13" />
          <circle cx="228" cy="118" r="13" />
          <circle cx="160" cy="82" r="16" />
        </g>
        {/* brows */}
        <path
          ref={browLRef}
          d="M116 128 Q132 121 148 128"
          stroke={HAIR}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          ref={browRRef}
          d="M172 128 Q188 121 204 128"
          stroke={HAIR}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        {/* eyes */}
        <g ref={eyeLRef}>
          <ellipse cx="132" cy="148" rx="14" ry="8.5" fill="#ffffff" />
          <circle ref={pupilLRef} cx="132" cy="148" r="5.5" fill="#111111" />
        </g>
        <g ref={eyeRRef}>
          <ellipse cx="188" cy="148" rx="14" ry="8.5" fill="#ffffff" />
          <circle ref={pupilRRef} cx="188" cy="148" r="5.5" fill="#111111" />
        </g>
        {/* nose */}
        <path
          d="M160 158 Q166 172 158 178 Q152 181 148 176"
          stroke={LINE}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* mouth: smile when closed, open shape when speaking */}
        <path
          ref={mouthSmileRef}
          d="M138 222 Q160 236 182 222"
          stroke="#4a4a4a"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse
          ref={mouthOpenRef}
          cx="160"
          cy="226"
          rx="16"
          ry="2"
          fill="#141414"
          opacity="0"
        />
      </g>
    </svg>
  );
}
