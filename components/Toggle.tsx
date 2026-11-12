"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50",
        checked
          ? "border-foreground bg-foreground"
          : "border-input bg-secondary",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-5 rounded-full transition-transform",
          checked
            ? "translate-x-5 bg-background"
            : "translate-x-0 bg-muted-foreground",
        )}
      />
    </button>
  );
}
