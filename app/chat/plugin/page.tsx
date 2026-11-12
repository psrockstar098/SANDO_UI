"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icon, type IconName } from "@/components/Icon";
import { PageShell } from "@/components/PageShell";
import { Pick } from "@/components/Pick";

const PERMS = ["Ask each time", "Always allow", "Never"];

type Plugin = {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  security: string;
  config?: {
    label: string;
    placeholder: string;
    type?: "text" | "password" | "file";
  };
};

const groups: { title: string; items: Plugin[] }[] = [
  {
    title: "Knowledge",
    items: [
      {
        id: "docs",
        name: "Document upload",
        desc: "Upload PDFs and documents to build your own searchable collection.",
        icon: "file",
        security: "Reads your files",
        config: { label: "Choose files", placeholder: "", type: "file" },
      },
      {
        id: "news",
        name: "Liberian news",
        desc: "Live headlines from FrontPage Africa, the Daily Observer and other sources.",
        icon: "search",
        security: "Network access",
      },
      {
        id: "legal",
        name: "County land & legal guides",
        desc: "Plain-language guides on land, county rules and legal basics.",
        icon: "book",
        security: "Sandboxed",
      },
    ],
  },
  {
    title: "Language & culture",
    items: [
      {
        id: "proverbs",
        name: "Proverb engine",
        desc: "Find and explain Liberian proverbs for any situation.",
        icon: "chat",
        security: "Sandboxed",
      },
      {
        id: "slang",
        name: "Local slang contributor",
        desc: "Suggest new words and spellings so Sando keeps learning.",
        icon: "language",
        security: "Sends data out",
      },
      {
        id: "currency",
        name: "Currency converter",
        desc: "Convert between LRD and USD with current rates.",
        icon: "bolt",
        security: "Network access",
      },
    ],
  },
  {
    title: "Live info",
    items: [
      {
        id: "weather",
        name: "Weather & county forecasts",
        desc: "Forecasts for every county, in plain words.",
        icon: "cloud",
        security: "Network access",
      },
    ],
  },
  {
    title: "Developer",
    items: [
      {
        id: "webhooks",
        name: "Webhooks",
        desc: "Get notified when Sando saves a new memory fact or finishes a chat turn.",
        icon: "code",
        security: "Sends data out",
        config: {
          label: "Webhook URL",
          placeholder: "https://your-app.com/hooks/sando",
        },
      },
      {
        id: "byom",
        name: "Bring your own model",
        desc: "Use your own API key or a local model instance.",
        icon: "puzzle",
        security: "Your keys",
        config: {
          label: "API key or local URL",
          placeholder: "sk-… or http://localhost:11434",
          type: "password",
        },
      },
    ],
  },
];

type Tool = {
  id: number;
  name: string;
  url: string;
  kind: string;
  on: boolean;
};

const glass = "rounded-3xl border-white/10 bg-white/[0.04] backdrop-blur-xl";

export default function PluginsPage() {
  const [on, setOn] = useState<Record<string, boolean>>({
    news: true,
    proverbs: true,
  });
  const [perm, setPerm] = useState<Record<string, string>>({});
  const [tools, setTools] = useState<Tool[]>([]);
  const [kind, setKind] = useState("MCP server");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const total = groups.flatMap((g) => g.items).length;
  const count = Object.values(on).filter(Boolean).length;

  const addTool = () => {
    if (!name.trim() || !url.trim()) return;
    setTools((t) => [
      ...t,
      { id: Date.now(), name: name.trim(), url: url.trim(), kind, on: true },
    ]);
    setName("");
    setUrl("");
  };

  return (
    <PageShell
      title="Plugins"
      subtitle={`${count} of ${total} plugins enabled. Choose what Sando can use, and what it must ask about first.`}
    >
      <div className="flex flex-col gap-8">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-2 px-2 text-xs text-muted-foreground">
              {g.title}
            </h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
              {g.items.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-center gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary ring-1 ring-white/15">
                      <Icon name={p.icon} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{p.name}</h3>
                        <Badge variant="outline" className="gap-1">
                          <Icon name="shield" size={11} />
                          {p.security}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{p.desc}</p>
                    </div>
                    <Switch
                      checked={!!on[p.id]}
                      onCheckedChange={(v) =>
                        setOn((s) => ({ ...s, [p.id]: v }))
                      }
                      aria-label={p.name}
                    />
                  </div>
                  {on[p.id] && (
                    <div className="flex animate-[rise_0.4s_cubic-bezier(0.32,0.72,0,1)_both] flex-col gap-3 pl-0 sm:flex-row sm:items-end sm:pl-15">
                      {p.config && (
                        <div className="flex flex-1 flex-col gap-1.5">
                          <label className="text-xs text-muted-foreground">
                            {p.config.label}
                          </label>
                          <Input
                            type={p.config.type ?? "text"}
                            placeholder={p.config.placeholder}
                            multiple={p.config.type === "file"}
                          />
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5 sm:w-48">
                        <label className="text-xs text-muted-foreground">
                          Permission
                        </label>
                        <Pick
                          value={perm[p.id] ?? PERMS[0]}
                          onChange={(v) =>
                            setPerm((s) => ({ ...s, [p.id]: v }))
                          }
                          options={PERMS}
                        />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Custom tools */}
        <section>
          <h2 className="mb-2 px-2 text-xs text-muted-foreground">
            Custom tools
          </h2>
          <Card className={`${glass} py-6`}>
            <CardHeader>
              <CardTitle>Upload custom tool</CardTitle>
              <CardDescription>
                Connect an MCP server or your own endpoint (for example a Python
                or Zig service). Only add tools you trust.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Tabs value={kind} onValueChange={setKind}>
                <TabsList>
                  <TabsTrigger value="MCP server">MCP server</TabsTrigger>
                  <TabsTrigger value="HTTP endpoint">HTTP endpoint</TabsTrigger>
                </TabsList>
                <TabsContent
                  value={kind}
                  className="mt-3 flex flex-col gap-3 sm:flex-row"
                >
                  <Input
                    placeholder="Tool name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="sm:w-56"
                  />
                  <Input
                    placeholder={
                      kind === "MCP server"
                        ? "https://mcp.example.com"
                        : "https://api.example.com/tool"
                    }
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTool()}
                  />
                  <Button
                    onClick={addTool}
                    disabled={!name.trim() || !url.trim()}
                  >
                    <Icon name="plus" size={16} />
                    Add
                  </Button>
                </TabsContent>
              </Tabs>

              {tools.length > 0 && (
                <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
                  {tools.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {t.name}{" "}
                          <Badge variant="secondary" className="ml-1">
                            {t.kind}
                          </Badge>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.url}
                        </p>
                      </div>
                      <Switch
                        checked={t.on}
                        onCheckedChange={(v) =>
                          setTools((l) =>
                            l.map((x) => (x.id === t.id ? { ...x, on: v } : x)),
                          )
                        }
                        aria-label={t.name}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${t.name}`}
                        onClick={() =>
                          setTools((l) => l.filter((x) => x.id !== t.id))
                        }
                      >
                        <Icon name="trash" size={16} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </PageShell>
  );
}
