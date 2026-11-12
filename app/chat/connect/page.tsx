"use client";

import React, { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { PageShell } from "@/components/PageShell";

const connectors = [
  {
    id: "drive",
    name: "Google Drive",
    desc: "Search and read your files and folders.",
  },
  { id: "gmail", name: "Gmail", desc: "Draft replies and find messages." },
  {
    id: "calendar",
    name: "Calendar",
    desc: "Check your schedule and book time.",
  },
  { id: "slack", name: "Slack", desc: "Summarize channels and post updates." },
  {
    id: "github",
    name: "GitHub",
    desc: "Review pull requests and browse issues.",
  },
  {
    id: "notion",
    name: "Notion",
    desc: "Read and update pages and databases.",
  },
  { id: "linear", name: "Linear", desc: "Track tickets and plan sprints." },
  {
    id: "dropbox",
    name: "Dropbox",
    desc: "Access shared documents and folders.",
  },
  { id: "figma", name: "Figma", desc: "Pull designs and comments into chat." },
];

const filters = ["All", "Connected", "Available"] as const;

export default function ConnectPage() {
  const [connected, setConnected] = useState<Set<string>>(
    new Set(["drive", "github"]),
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const toggle = (id: string) =>
    setConnected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const list = useMemo(
    () =>
      connectors.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) &&
          (filter === "All" ||
            (filter === "Connected") === connected.has(c.id)),
      ),
    [query, filter, connected],
  );

  return (
    <PageShell
      title="Connect"
      subtitle="Link your apps so answers can use your own files, messages and tasks."
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-3 transition focus-within:border-white/40 sm:max-w-sm">
          <Icon name="search" className="text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search connectors"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-500"
          />
        </label>
        <div className="flex rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-xl px-4 py-1.5 text-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:flex-none ${filter === f ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-neutral-500">
          No connectors match “{query}”.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const on = connected.has(c.id);
            return (
              <article
                key={c.id}
                className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-b from-neutral-700 to-neutral-900 text-lg font-semibold ring-1 ring-white/15">
                    {c.name[0]}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{c.name}</h3>
                    <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <span
                        className={`size-1.5 rounded-full ${on ? "bg-white" : "bg-neutral-600"}`}
                      />
                      {on ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                <p className="flex-1 text-sm text-neutral-400">{c.desc}</p>
                <button
                  onClick={() => toggle(c.id)}
                  className={`h-10 rounded-xl text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 ${on ? "border border-white/20 text-neutral-300 hover:bg-white/10" : "bg-white text-black hover:bg-neutral-200"}`}
                >
                  {on ? "Disconnect" : "Connect"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
