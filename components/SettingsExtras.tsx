"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* Big page heading for one settings section. */
export function SectionHeader({
  icon: I,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-8 flex items-start gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <I className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </header>
  );
}

/* Pill-shaped single choice, good for 2 to 4 short options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-full border border-border bg-muted p-0.5"
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            o === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* A labelled progress bar that turns warm when nearly full. */
export function Meter({
  label,
  used,
  limit,
  unit = "",
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  hint?: string;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const hot = pct >= 85;
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {used.toLocaleString()} / {limit.toLocaleString()}
          {unit}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            hot ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* Simple CSS bar chart. Each bar is focusable so the value is readable by keyboard. */
export function Bars({
  data,
  labels,
  unit = "",
}: {
  data: number[];
  labels: string[];
  unit?: string;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="px-4 py-5 sm:px-5">
      <div className="flex h-40 items-end gap-1.5 sm:gap-2">
        {data.map((v, i) => (
          <div
            key={i}
            tabIndex={0}
            title={`${labels[i]}: ${v}${unit}`}
            aria-label={`${labels[i]}: ${v}${unit}`}
            className="group relative flex h-full flex-1 items-end rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <div
              className={cn(
                "w-full rounded-md transition-colors",
                i === data.length - 1
                  ? "bg-primary"
                  : "bg-primary/30 group-hover:bg-primary/60 group-focus-visible:bg-primary/60",
              )}
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] tabular-nums text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {v}
              {unit}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

/* Inline callout with an optional action. */
export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warn";
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
        tone === "warn"
          ? "border-white/20 bg-white/[0.06]"
          : "border-primary/20 bg-primary/5",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {children && (
          <p className="mt-0.5 text-xs text-muted-foreground">{children}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* Floating bar that appears only when there are unsaved changes. */
export function DirtyBar({
  dirty,
  saved,
  busy,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saved: boolean;
  /** A save is in flight: keep the bar up and disable the buttons. */
  busy?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const show = dirty || saved || busy;
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 transition-all duration-300 motion-reduce:transition-none",
        show ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-full border border-border bg-card py-2 pl-5 pr-2 shadow-lg",
          show && "pointer-events-auto",
        )}
      >
        <p className="text-sm">
          {busy
            ? "Saving…"
            : saved && !dirty
              ? "Changes saved"
              : "You have unsaved changes"}
        </p>
        {dirty && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              disabled={busy}
              onClick={onDiscard}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              disabled={busy}
              onClick={onSave}
            >
              Save changes
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* Small status dot + text. */
export function Status({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "off";
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-2 rounded-full",
          tone === "ok" && "bg-white",
          tone === "warn" && "bg-neutral-400",
          tone === "off" && "bg-muted-foreground/40",
        )}
      />
      {children}
    </span>
  );
}
