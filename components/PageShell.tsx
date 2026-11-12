import React from "react";
import { cn } from "@/lib/utils";

export function PageShell({
  title,
  subtitle,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-background [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
      <div
        className={cn(
          "mx-auto w-full animate-rise px-4 py-8 sm:px-8 sm:py-12",
          wide ? "max-w-6xl" : "max-w-4xl",
        )}
      >
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-xl text-muted-foreground">{subtitle}</p>
          )}
        </header>
        {children}
      </div>
    </section>
  );
}
