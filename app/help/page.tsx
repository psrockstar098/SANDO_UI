"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Icon, type IconName } from "@/components/Icon";
import { PageShell } from "@/components/PageShell";
import { cn } from "@/lib/utils";

/* ---------------------------------- data ---------------------------------- */

const MEMORY_HREF = "/settings#memory";
const ASK_SANDO_HREF =
  "/chat?prompt=" +
  encodeURIComponent("I need help using Sando. Can you walk me through it?");

type CategoryId = "start" | "dialects" | "memory" | "voice" | "plans";

const categories: {
  id: CategoryId;
  title: string;
  desc: string;
  icon: IconName;
}[] = [
  {
    id: "start",
    title: "Getting started",
    desc: "Account setup, chats and your first prompt.",
    icon: "user",
  },
  {
    id: "dialects",
    title: "Dialects & languages",
    desc: "Talk to Sando in Koloqua, Gio/Dan, Bassa, Kpelle and more.",
    icon: "language",
  },
  {
    id: "memory",
    title: "Memory & privacy",
    desc: "How Sando remembers your facts, and how to edit or wipe them.",
    icon: "shield",
  },
  {
    id: "voice",
    title: "Voice & audio",
    desc: "Mic permissions and latency tips.",
    icon: "mic",
  },
  {
    id: "plans",
    title: "Plans",
    desc: "What each plan includes and how to upgrade.",
    icon: "bolt",
  },
];

const faqs: { cat: CategoryId; q: string; a: string }[] = [
  {
    cat: "start",
    q: "How do I create an account?",
    a: "Sign up from the login screen. Your account is handled through Keycloak, so you can use the same login across Sando apps. After signing in, open Settings to set your name and language.",
  },
  {
    cat: "start",
    q: "What should my first prompt be?",
    a: "Just talk the way you normally do. Sando understands everyday Liberian English, so you don’t need formal wording.",
  },
  {
    cat: "start",
    q: "How do I start a new chat or find an old one?",
    a: "Tap New chat at the top of the sidebar. Your earlier chats are listed below it, grouped by Today, Yesterday and Previous 7 days.",
  },
  {
    cat: "start",
    q: "How do I change the app language?",
    a: "Open the profile menu at the bottom of the sidebar, choose Language, then pick English, Español, Français or العربية.",
  },
  {
    cat: "dialects",
    q: "How do I switch to Gio or Bassa?",
    a: "Tell Sando in your message, for example: “Answer me in Bassa.” You can also set a default language in Settings. Indigenous dialects are included with the Big Man plan.",
  },
  {
    cat: "dialects",
    q: "Which dialects does Sando support?",
    a: "Koloqua is available on every plan. Big Man and above unlock Gio/Dan, Bassa, Kpelle, Kru, Vai and more.",
  },
  {
    cat: "dialects",
    q: "Sando got a word or phrase wrong. What now?",
    a: "Tell Sando what’s wrong in your next message, for example: “That’s not how elders greet in the morning.” It will correct itself. You can also email support@sando.ai so we can improve it.",
  },
  {
    cat: "dialects",
    q: "How do I get better answers in a dialect?",
    a: "Ask the way you’d ask a person. Say who you’re talking to and why, like “How would an elder greet someone in the morning in Gio?” Natural questions get better answers than short commands.",
  },
  {
    cat: "memory",
    q: "How does Sando remember me?",
    a: "Sando keeps a short memory of facts you share, such as your hometown, work or preferences, and uses it to answer you better. Free accounts keep basic session memory; paid plans keep it permanently across devices.",
  },
  {
    cat: "memory",
    q: "How do I change or delete what Sando remembers?",
    a: "Open your memory from Settings to see and edit saved facts. You can also tell Sando directly, for example: “Forget my old address.”",
  },
  {
    cat: "voice",
    q: "Why can’t Sando hear me?",
    a: "Check that your browser has microphone permission for this site and that no other app is using the mic. Then press Test microphone at the top of this page.",
  },
  {
    cat: "voice",
    q: "Voice feels slow. What can I do?",
    a: "Use a stable connection, close heavy tabs, and speak in short sentences. Wired or good Wi-Fi gives the lowest delay.",
  },
  {
    cat: "plans",
    q: "What does the free plan include?",
    a: "Koloqua and basic session memory. Upgrade to unlock indigenous dialects and memory that stays across devices.",
  },
  {
    cat: "plans",
    q: "How do I upgrade my plan?",
    a: "Choose Upgrade plan in the profile menu at the bottom of the sidebar, or open the Plans page.",
  },
];

const articleCount = (id: CategoryId) =>
  faqs.filter((f) => f.cat === id).length;

const tags = [
  { label: "How Sando remembers me", query: "remember" },
  { label: "Switching to Gio or Bassa", query: "gio or bassa" },
  { label: "Voice chat setup", query: "mic" },
  { label: "Upgrading", query: "upgrade" },
];

// Set NEXT_PUBLIC_WHATSAPP_URL / NEXT_PUBLIC_DISCORD_URL; channels without a URL are hidden.
const channels = [
  { label: "WhatsApp community", href: process.env.NEXT_PUBLIC_WHATSAPP_URL },
  { label: "Discord", href: process.env.NEXT_PUBLIC_DISCORD_URL },
].flatMap((c) => (c.href ? [{ label: c.label, href: c.href }] : []));

type Mic = "idle" | "checking" | "ok" | "denied" | "unsupported";

const micText: Record<Mic, string> = {
  idle: "Check if your browser can use voice mode.",
  checking: "Waiting for microphone permission…",
  ok: "Your microphone works. Voice mode is ready.",
  denied: "Microphone blocked. Allow it in your browser’s site settings.",
  unsupported: "This browser doesn’t support live audio input.",
};

/* -------------------------------- components ------------------------------- */

const actionCard =
  "flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70";

function ActionIcon({ name }: { name: IconName }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-secondary">
      <Icon name={name} size={18} />
    </span>
  );
}

function TopicButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon name={icon} size={16} />
        {label}
      </span>
      <span className="text-xs tabular-nums">{count}</span>
    </button>
  );
}

/* ---------------------------------- page ----------------------------------- */

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [mic, setMic] = useState<Mic>("idle");

  const activeCategory = categories.find((c) => c.id === cat);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter(
      (f) =>
        (!cat || f.cat === cat) &&
        (!q || `${f.q} ${f.a}`.toLowerCase().includes(q)),
    );
  }, [query, cat]);

  const clearFilters = () => {
    setCat(null);
    setQuery("");
  };

  const testMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setMic("unsupported");
    setMic("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMic("ok");
    } catch {
      setMic("denied");
    }
  };

  return (
    <PageShell
      wide
      title="How can we help you today, my people?"
      subtitle="Search guides, learn how Sando remembers you, or talk to Sando directly."
    >
      {/* Search */}
      <div className="max-w-2xl">
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search help articles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles"
            className="h-12 rounded-full pl-11 text-base"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((t) => (
            <Button
              key={t.label}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setQuery(t.query);
                setCat(null);
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-10 grid gap-3 md:grid-cols-3">
        <Link href={ASK_SANDO_HREF} className={actionCard}>
          <ActionIcon name="chat" />
          <span className="min-w-0">
            <span className="block font-medium">Ask Sando</span>
            <span className="block text-sm text-muted-foreground">
              Start a chat that already knows you need help.
            </span>
          </span>
        </Link>

        <Link href={MEMORY_HREF} className={actionCard}>
          <ActionIcon name="shield" />
          <span className="min-w-0">
            <span className="block font-medium">Your memory</span>
            <span className="block text-sm text-muted-foreground">
              See, edit or delete what Sando remembers.
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={testMic}
          disabled={mic === "checking"}
          className={actionCard}
        >
          <ActionIcon name={mic === "ok" ? "check" : "mic"} />
          <span className="min-w-0">
            <span className="block font-medium">
              {mic === "ok" ? "Test microphone again" : "Test microphone"}
            </span>
            <span role="status" className="block text-sm text-muted-foreground">
              {micText[mic]}
            </span>
          </span>
        </button>
      </div>

      {/* Topics + articles */}
      <div className="mt-14 grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-12">
        <nav
          aria-label="Help topics"
          className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:flex-col lg:self-start lg:overflow-visible lg:pb-0"
        >
          <TopicButton
            active={cat === null}
            icon="book"
            label="All articles"
            count={faqs.length}
            onClick={() => setCat(null)}
          />
          {categories.map((c) => (
            <TopicButton
              key={c.id}
              active={cat === c.id}
              icon={c.icon}
              label={c.title}
              count={articleCount(c.id)}
              onClick={() => setCat(cat === c.id ? null : c.id)}
            />
          ))}
        </nav>

        <section aria-labelledby="articles-title" className="min-w-0">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="articles-title" className="text-xl font-medium">
                {activeCategory?.title ?? "All articles"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeCategory?.desc ??
                  "Answers to the questions we hear most."}
              </p>
            </div>
            {(cat || query) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-full"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}
          </div>

          <p className="sr-only" aria-live="polite">
            {results.length} {results.length === 1 ? "article" : "articles"}{" "}
            found
          </p>

          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <p>No articles match your search.</p>
              <Link
                href={ASK_SANDO_HREF}
                className="mt-2 inline-block text-foreground underline underline-offset-4"
              >
                Ask Sando directly
              </Link>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              className="rounded-xl border border-border bg-card px-5"
            >
              {results.map((f) => (
                <AccordionItem key={f.q} value={f.q}>
                  <AccordionTrigger className="text-left">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </section>
      </div>

      {/* Memory explainer */}
      <section className="mt-16">
        <Card className="rounded-2xl py-6 shadow-none">
          <CardHeader>
            <CardTitle>How Sando’s memory works</CardTitle>
            <CardDescription>
              Tell Sando when something changes. It updates what it knows and
              retires the old fact on its own.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex max-w-md flex-col gap-2 text-sm">
              <p className="self-end rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-primary-foreground">
                I’m living in Gbarnga now.
              </p>
              <p className="self-start rounded-2xl rounded-bl-sm bg-secondary px-4 py-2">
                Got it. I’ve updated your location to Gbarnga.
              </p>
            </div>
            <Link
              href={MEMORY_HREF}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "rounded-full",
              )}
            >
              Inspect my memory
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Support */}
      <section className="mt-4">
        <Card className="rounded-2xl py-6 shadow-none">
          <CardHeader>
            <CardTitle>Still need help?</CardTitle>
            <CardDescription>
              Chat with Sando, or reach our team directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href={ASK_SANDO_HREF}
              className={cn(buttonVariants(), "rounded-full")}
            >
              <Icon name="chat" size={16} />
              Start help chat
            </Link>
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "rounded-full",
                )}
              >
                {c.label}
              </a>
            ))}
            <a
              href="mailto:support@sando.ai"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "rounded-full",
              )}
            >
              <Icon name="mail" size={16} />
              support@sando.ai
            </a>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
