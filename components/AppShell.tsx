import React from "react";
import { SiderBar } from "@/components/SiderBar";

// Shared frame: sidebar + content. Used by /chat, /help and /plan layouts.
// Mobile: stacked (top bar + content). Tablet/laptop: sidebar + content.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full flex-col gap-2 bg-black p-2 text-white md:flex-row md:gap-3 md:p-3">
      <SiderBar />
      <main className="flex min-h-0 min-w-0 flex-1">{children}</main>
    </div>
  );
}
