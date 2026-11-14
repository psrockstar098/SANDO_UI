"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CreditCard,
  Crown,
  Database,
  Download,
  Gauge,
  KeyRound,
  Laptop,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/PageShell";
import { Pick } from "@/components/Pick";
import {
  ActionButton,
  ConfirmButton,
  EditRow,
  Group,
  LinkRow,
  Row,
  SwitchRow,
  Textarea,
} from "@/components/SettingsKit";
import {
  Bars,
  DirtyBar,
  Meter,
  Notice,
  SectionHeader,
  Segmented,
  Status,
} from "@/components/SettingsExtras";
import { cn } from "@/lib/utils";
import { getDisplayName } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import type { UserProfile } from "@/components/AuthProvider";
import { deleteAccount, errorMessage, updateDialect } from "@/lib/api/api";
import { clearConversations } from "@/lib/chat/store";
import { getKeycloakInstance } from "@/lib/keycloak";

/* Keycloak account console (set NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL in .env) */
const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL ?? "#";

/* ------------------------------- navigation ------------------------------- */

type SectionId =
  | "general"
  | "profile"
  | "security"
  | "account"
  | "personalization"
  | "data-controls"
  | "usage"
  | "billing";

const NAV: {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  keywords: string;
}[] = [
  {
    id: "general",
    label: "General",
    icon: SettingsIcon,
    title: "General",
    description: "Language, theme, region and how Sando reaches you.",
    keywords: "language theme appearance notifications shortcut county region",
  },
  {
    id: "profile",
    label: "Profile",
    icon: UserRound,
    title: "Profile",
    description: "How you appear to Sando and to people you share with.",
    keywords: "name photo avatar bio public keycloak sync",
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    title: "Security and login",
    description: "Protect your account and review where you are signed in.",
    keywords: "password 2fa two-factor sessions devices lockdown keycloak",
  },
  {
    id: "account",
    label: "Account",
    icon: KeyRound,
    title: "Account",
    description: "Your sign-in identity, plan and account deletion.",
    keywords: "email username plan delete age",
  },
  {
    id: "personalization",
    label: "Personalization",
    icon: Sparkles,
    title: "Personalization",
    description: "Teach Sando how you talk and what to remember.",
    keywords: "memory dialect koloqua tone instructions code-switching facts",
  },
  {
    id: "data-controls",
    label: "Data controls",
    icon: Database,
    title: "Data controls",
    description: "Decide what happens to your chats and your data.",
    keywords: "export delete archive training location shared links cookies",
  },
  {
    id: "usage",
    label: "Usage",
    icon: Gauge,
    title: "Usage",
    description: "See how much of your plan you have used.",
    keywords: "tokens messages limits models quota",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    title: "Billing",
    description: "Your plan, payment methods and invoices.",
    keywords: "plan upgrade big man payment invoice mobile money",
  },
];

/* --------------------------------- options -------------------------------- */

const languages = ["Auto detect", "English", "Koloqua"];
const shortcuts = ["Enter", "Ctrl + Enter"];
const themes = ["System", "Light", "Dark"] as const;
const counties = [
  "Bomi",
  "Bong",
  "Gbarpolu",
  "Grand Bassa",
  "Grand Cape Mount",
  "Grand Gedeh",
  "Grand Kru",
  "Lofa",
  "Margibi",
  "Maryland",
  "Montserrado",
  "Nimba",
  "River Cess",
  "River Gee",
  "Sinoe",
];
const dialects = [
  "Koloqua",
  "Gio / Dan",
  "Bassa",
  "Kpelle",
  "Kru",
  "Vai",
  "Other",
];
const switching = [
  "Match my dialect",
  "Always Koloqua",
  "Mix dialect and English",
  "Standard English",
];
const tones = ["Default", "Friendly", "Professional", "Direct", "Teacher"];
const levels = ["Less", "Default", "More"];

type Settings = {
  language: string;
  shortcut: string;
  theme: (typeof themes)[number];
  county: string;
  notifyDone: boolean;
  notifyNews: boolean;
  notifyEmail: boolean;
  name: string;
  bio: string;
  publicProfile: boolean;
  username: string;
  email: string;
  lockdown: boolean;
  memoryOn: boolean;
  dialect: string;
  switching: string;
  explain: boolean;
  tone: string;
  warmth: string;
  emoji: string;
  lists: string;
  instructions: string;
  improve: boolean;
  location: boolean;
};

const initial: Settings = {
  language: "Auto detect",
  shortcut: "Enter",
  theme: "System",
  county: "Montserrado",
  notifyDone: true,
  notifyNews: false,
  notifyEmail: true,
  name: "",
  bio: "",
  publicProfile: false,
  username: "",
  email: "",
  lockdown: false,
  memoryOn: true,
  dialect: "Koloqua",
  switching: "Match my dialect",
  explain: true,
  tone: "Default",
  warmth: "Default",
  emoji: "Default",
  lists: "Default",
  instructions: "",
  improve: true,
  location: false,
};

/** Seed the form from the signed-in profile (backend values when available). */
function initialFor(user: UserProfile | null): Settings {
  return {
    ...initial,
    name: getDisplayName(user, ""),
    username: user?.username ?? "",
    email: user?.email ?? "",
    dialect: dialectLabel(user?.dialect),
    county: user?.region?.trim() || initial.county,
  };
}

/**
 * The backend stores the dialect as a collection name (`koloqua`, `gio`, …) and
 * uses it for every answer, so the labels here map to those values.
 */
const DIALECT_VALUES: Record<string, string> = {
  Koloqua: "koloqua",
  "Gio / Dan": "gio",
  Bassa: "bassa",
  Kpelle: "kpelle",
  Kru: "kru",
  Vai: "vai",
  Other: "other",
};

function dialectValue(label: string): string {
  return DIALECT_VALUES[label] ?? label.trim().toLowerCase();
}

function dialectLabel(value?: string): string {
  const text = value?.trim();
  if (!text) return initial.dialect;
  const key = text.toLowerCase();
  if (key === "koloqua") return "Koloqua";
  if (key === "gio" || key === "dan" || key === "gio / dan") return "Gio / Dan";
  const match = dialects.find((d) => d.toLowerCase() === key);
  if (match) return match;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Keep an unknown value selectable instead of silently showing a fallback. */
function withValue(options: string[], value: string): string[] {
  return options.includes(value) ? options : [value, ...options];
}

/* Sample data: replace with the human memory block from Letta */
type Fact = {
  id: number;
  label: string;
  value: string;
  when: string;
  active: boolean;
};
const seedFacts: Fact[] = [
  {
    id: 1,
    label: "Home town",
    value: "Gbarnga",
    when: "Updated 2 days ago",
    active: true,
  },
  {
    id: 2,
    label: "Previous home",
    value: "Monrovia",
    when: "Retired 2 days ago",
    active: false,
  },
  {
    id: 3,
    label: "Work",
    value: "Teacher",
    when: "Added last week",
    active: true,
  },
  {
    id: 4,
    label: "Family",
    value: "Two younger sisters",
    when: "Added last week",
    active: true,
  },
  {
    id: 5,
    label: "Preference",
    value: "Short answers in Koloqua",
    when: "Added 3 weeks ago",
    active: true,
  },
];

/* Sample data: replace with your sessions endpoint */
type Device = {
  id: number;
  name: string;
  place: string;
  when: string;
  kind: "laptop" | "phone";
  current?: boolean;
};
const seedDevices: Device[] = [
  {
    id: 1,
    name: "Chrome on Windows",
    place: "Monrovia, LR",
    when: "This device",
    kind: "laptop",
    current: true,
  },
  {
    id: 2,
    name: "Sando app on Android",
    place: "Monrovia, LR",
    when: "Active 3 hours ago",
    kind: "phone",
  },
  {
    id: 3,
    name: "Firefox on Linux",
    place: "Gbarnga, LR",
    when: "Active 6 days ago",
    kind: "laptop",
  },
];

/* Sample data: replace with your usage endpoint */
const dayLabels = Array.from({ length: 14 }, (_, i) => `Day ${i + 1}`);
const dayMessages = [12, 30, 8, 44, 27, 19, 3, 38, 41, 22, 15, 36, 29, 38];
const modelUse = [
  { name: "Balanced (Llama 3.3 70B)", share: 62 },
  { name: "Fast (30B)", share: 31 },
  { name: "Ultra (Nemotron-3 550B)", share: 7 },
];

/* ---------------------------------- page ---------------------------------- */

export default function SettingsPage() {
  const { user, getToken, refreshProfile } = useAuth();
  const [section, setSection] = useState<SectionId>("general");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<Settings>(() => initialFor(user));
  const [draft, setDraft] = useState<Settings>(() => initialFor(user));
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The token paints first; the backend profile (dialect/region) arrives just
  // after. Re-seed then, unless the user already started editing.
  const seed = useRef<Settings>(initialFor(user));
  useEffect(() => {
    if (!user) return;
    if (JSON.stringify(draft) !== JSON.stringify(seed.current)) return;
    const next = initialFor(user);
    seed.current = next;
    setSaved(next);
    setDraft(next);
  }, [user, draft]);

  const dirty = useMemo(
    () => JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft],
  );
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  /* Deep links: /chat/settings#security. The old #memory link opens Personalization. */
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const id = (hash === "memory" ? "personalization" : hash) as SectionId;
    if (!NAV.some((n) => n.id === id)) return;
    // Deferred so the first paint (General) isn't blocked by a cascading render.
    const frame = requestAnimationFrame(() => setSection(id));
    return () => cancelAnimationFrame(frame);
  }, []);
  const go = (id: SectionId) => {
    setSection(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  /**
   * Dialect and region are the only preferences the backend stores today; the
   * rest stay on this device until there is an endpoint for them.
   */
  const save = async () => {
    const nextDialect = dialectValue(draft.dialect);
    const nextRegion = draft.county.trim() || initial.county;
    const preferencesChanged =
      nextDialect !== dialectValue(saved.dialect) ||
      nextRegion !== saved.county.trim();

    setSaving(true);
    setSaveError(null);
    try {
      if (preferencesChanged) {
        const token = await getToken();
        if (!token) throw new Error("Please sign in again to save.");
        await updateDialect({ dialect: nextDialect, region: nextRegion, token });
        // The token still carries the old claims; pull the backend's copy.
        void refreshProfile();
      }
      setSaved(draft);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const nav = NAV.filter(
    (n) => !q || `${n.label} ${n.keywords}`.toLowerCase().includes(q),
  );
  const current = NAV.find((n) => n.id === section)!;
  const props = { s: draft, set };

  return (
    <PageShell
      title="Settings"
      subtitle="Everything about your account and how Sando works for you."
    >
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Navigation */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="relative mb-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
              className="rounded-full pl-9"
            />
          </div>
          <nav
            aria-label="Settings sections"
            className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {nav.map((n) => {
              const I = n.icon;
              const on = n.id === section;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => go(n.id)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-3 rounded-full px-3.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:rounded-xl",
                    on
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <I className="size-4" aria-hidden />
                  {n.label}
                </button>
              );
            })}
            {nav.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </p>
            )}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 pb-24">
          <SectionHeader
            icon={current.icon}
            title={current.title}
            description={current.description}
          />
          {saveError && (
            <div className="mb-6">
              <Notice tone="warn" title="Couldn’t save your chat preferences">
                {saveError}
              </Notice>
            </div>
          )}
          <div className="flex flex-col gap-8">
            {section === "general" && <General {...props} />}
            {section === "profile" && <Profile {...props} />}
            {section === "security" && <Security {...props} />}
            {section === "account" && <Account {...props} plan={user?.plan} />}
            {section === "personalization" && <Personalization {...props} />}
            {section === "data-controls" && <DataControls {...props} />}
            {section === "usage" && <Usage />}
            {section === "billing" && <Billing plan={user?.plan} />}
          </div>
        </main>
      </div>

      <DirtyBar
        dirty={dirty}
        saved={justSaved}
        busy={saving}
        onSave={save}
        onDiscard={() => {
          setSaveError(null);
          setDraft(saved);
        }}
      />
    </PageShell>
  );
}

type P = {
  s: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
};

/* --------------------------------- General -------------------------------- */

function General({ s, set }: P) {
  return (
    <>
      <Group title="Interface">
        <Row label="Language" hint="Language for the app interface.">
          <Pick
            value={s.language}
            onChange={(v) => set("language", v)}
            options={languages}
            label="Language"
          />
        </Row>
        <Row label="Appearance" hint="Choose how Sando looks on this device.">
          <Segmented
            label="Appearance"
            value={s.theme}
            onChange={(v) => set("theme", v)}
            options={themes}
          />
        </Row>
        <Row
          label="Send shortcut"
          hint="Choose when Enter sends a message or adds a new line."
        >
          <Pick
            value={s.shortcut}
            onChange={(v) => set("shortcut", v)}
            options={shortcuts}
            label="Send shortcut"
          />
        </Row>
      </Group>

      <Group title="Region">
        <Row
          label="Home county"
          hint="Used for local news, weather and guides."
        >
          <Pick
            value={s.county}
            onChange={(v) => set("county", v)}
            options={withValue(counties, s.county)}
            label="Home county"
          />
        </Row>
      </Group>

      <Group title="Notifications">
        <SwitchRow
          label="Reply ready"
          hint="Tell me when a long answer has finished."
          checked={s.notifyDone}
          onChange={(v) => set("notifyDone", v)}
        />
        <SwitchRow
          label="Product updates"
          hint="New features and improvements to Sando."
          checked={s.notifyNews}
          onChange={(v) => set("notifyNews", v)}
        />
        <SwitchRow
          label="Email notifications"
          hint="Security alerts and receipts are always sent."
          checked={s.notifyEmail}
          onChange={(v) => set("notifyEmail", v)}
        />
      </Group>
    </>
  );
}

/* --------------------------------- Profile -------------------------------- */

function Profile({ s, set }: P) {
  const [synced, setSynced] = useState(false);
  return (
    <>
      <Group>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                {s.name[0] || "S"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-lg font-medium">
                {s.name || "Your name"}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                @{s.username}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-full">
              Change photo
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              disabled={synced}
              onClick={() => {
                setSynced(true);
                setTimeout(() => setSynced(false), 1800);
              }}
            >
              {synced ? "Synced" : "Sync with Keycloak"}
            </Button>
          </div>
        </div>
        <EditRow
          label="Display name"
          value={s.name}
          onSave={(v) => set("name", v)}
        />
        <EditRow
          label="Bio"
          value={s.bio}
          multiline
          placeholder="A line about you, for example what you teach or build."
          onSave={(v) => set("bio", v)}
        />
      </Group>

      <Group title="Visibility">
        <SwitchRow
          label="Public profile"
          hint="Anyone with your link can see your name, photo and bio."
          checked={s.publicProfile}
          onChange={(v) => set("publicProfile", v)}
        />
      </Group>
    </>
  );
}

/* -------------------------------- Security -------------------------------- */

function Security({ s, set }: P) {
  const [devices, setDevices] = useState<Device[]>(seedDevices);
  return (
    <>
      <Notice
        tone="warn"
        title="Turn on two-factor authentication"
        action={
          <a
            href={KEYCLOAK_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground"
          >
            Set up in Keycloak
          </a>
        }
      >
        A second step stops someone from signing in with only your password.
      </Notice>

      <Group title="How you sign in">
        <LinkRow
          label="Password"
          hint="Changed in your Keycloak account."
          value="Change"
          href={KEYCLOAK_URL}
          external
        />
        <LinkRow
          label="Two-factor authentication"
          hint="Authenticator app or security key."
          value="Manage"
          href={KEYCLOAK_URL}
          external
        />
        <LinkRow
          label="Linked accounts"
          hint="Google, Facebook and other sign-ins."
          href={KEYCLOAK_URL}
          external
        />
      </Group>

      <Group
        title="Active sessions"
        description="Devices that are signed in to your account."
      >
        {devices.map((d) => {
          const I = d.kind === "phone" ? Smartphone : Laptop;
          return (
            <div
              key={d.id}
              className="flex items-center gap-4 px-4 py-3.5 sm:px-5"
            >
              <I
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.place} · {d.when}
                </p>
              </div>
              {d.current ? (
                <Badge variant="secondary">This device</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    setDevices((l) => l.filter((x) => x.id !== d.id))
                  }
                >
                  Sign out
                </Button>
              )}
            </div>
          );
        })}
        <Row
          label="Sign out everywhere else"
          hint="Ends every session except this one."
        >
          <ConfirmButton
            label="Sign out all"
            confirmLabel="Yes, sign out"
            disabled={devices.length <= 1}
            onConfirm={() => setDevices((l) => l.filter((x) => x.current))}
          />
        </Row>
      </Group>

      <Group title="Advanced">
        <SwitchRow
          label="Lockdown mode"
          hint="Limits web and connected-app features to reduce prompt-injection risk."
          checked={s.lockdown}
          onChange={(v) => set("lockdown", v)}
        />
      </Group>
    </>
  );
}

/* --------------------------------- Account -------------------------------- */

function Account({ s, set, plan }: P & { plan?: string }) {
  const { getToken } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again to delete your account.");
      await deleteAccount({ token });
      // The account is gone from Keycloak, so log out locally and clear the
      // chats stored in this browser (the backend keeps no transcript).
      clearConversations();
      getKeycloakInstance().clearToken();
      window.location.replace("/");
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <>
      <Group title="Sign-in identity">
        <EditRow
          label="Username"
          value={s.username}
          onSave={(v) => set("username", v)}
        />
        <EditRow
          label="Email"
          type="email"
          value={s.email}
          onSave={(v) => set("email", v)}
        />
        <Row label="Plan">
          <Badge variant="secondary">{planLabel(plan)}</Badge>
        </Row>
        <Row label="Age">
          <span className="text-sm text-muted-foreground">18 or older</span>
        </Row>
      </Group>

      <div className="overflow-hidden rounded-2xl border border-destructive/40">
        <Row
          label="Delete account"
          hint="Removes your account, chats and memory for good. This can’t be undone."
        >
          <ConfirmButton
            label={deleting ? "Deleting…" : "Delete"}
            confirmLabel="Yes, delete my account"
            disabled={deleting}
            onConfirm={removeAccount}
          />
        </Row>
        {error && (
          <p
            role="alert"
            className="border-t border-destructive/40 px-4 py-3 text-xs text-destructive sm:px-5"
          >
            {error}
          </p>
        )}
      </div>
    </>
  );
}

/* ----------------------------- Personalization ---------------------------- */

function Personalization({ s, set }: P) {
  const [facts, setFacts] = useState<Fact[]>(seedFacts);
  const [showRetired, setShowRetired] = useState(false);
  const visible = facts.filter((f) => showRetired || f.active);
  const plain = s.switching === "Standard English";

  return (
    <>
      {/* Live preview: the one thing on this page that moves as you change settings */}
      <div className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-5">
        <p className="mb-3 text-xs text-muted-foreground">
          Preview of how Sando will answer
        </p>
        <div className="max-w-md rounded-2xl rounded-tl-sm bg-card p-4 text-sm leading-relaxed shadow-sm">
          {plain
            ? "Good morning. Your lesson plan for today is ready."
            : s.tone === "Direct"
              ? "Lesson plan ready. Check am."
              : "Good morning oh! Your lesson plan for today ready."}
          {s.emoji === "More" && " 😊"}
          {s.explain && !plain && (
            <span className="mt-2 block text-xs text-muted-foreground">
              “oh” adds friendly emphasis.
            </span>
          )}
        </div>
      </div>

      <Group title="Language style">
        <Row label="Primary dialect" hint="Sando answers in this by default.">
          <Pick
            value={s.dialect}
            onChange={(v) => set("dialect", v)}
            options={withValue(dialects, s.dialect)}
            label="Primary dialect"
          />
        </Row>
        <Row label="Code-switching" hint="How Sando mixes dialect and English.">
          <Pick
            value={s.switching}
            onChange={(v) => set("switching", v)}
            options={switching}
            label="Code-switching"
          />
        </Row>
        <SwitchRow
          label="Explain dialect words"
          hint="Add short meanings after local words."
          checked={s.explain}
          onChange={(v) => set("explain", v)}
        />
      </Group>

      <Group title="Response style">
        <Row label="Base tone">
          <Pick
            value={s.tone}
            onChange={(v) => set("tone", v)}
            options={tones}
            label="Base tone"
          />
        </Row>
        <Row label="Warmth">
          <Pick
            value={s.warmth}
            onChange={(v) => set("warmth", v)}
            options={levels}
            label="Warmth"
          />
        </Row>
        <Row label="Emoji">
          <Pick
            value={s.emoji}
            onChange={(v) => set("emoji", v)}
            options={levels}
            label="Emoji"
          />
        </Row>
        <Row label="Headers and lists">
          <Pick
            value={s.lists}
            onChange={(v) => set("lists", v)}
            options={levels}
            label="Headers and lists"
          />
        </Row>
      </Group>

      <Group
        title="Custom instructions"
        description="Anything Sando should always keep in mind."
      >
        <div className="flex flex-col gap-2 p-4 sm:p-5">
          <Textarea
            value={s.instructions}
            maxLength={1000}
            placeholder="For example: I teach grade 6. Keep examples simple and local."
            aria-label="Custom instructions"
            onChange={(e) => set("instructions", e.target.value)}
          />
          <p className="text-right text-xs tabular-nums text-muted-foreground">
            {s.instructions.length} / 1000
          </p>
        </div>
      </Group>

      <Group
        title="Memory"
        description="What Sando knows about you. Tell Sando in chat when something changes, or edit it here."
      >
        <SwitchRow
          label="Enable memory"
          hint="Let Sando remember facts from your chats."
          checked={s.memoryOn}
          onChange={(v) => set("memoryOn", v)}
        />
        {s.memoryOn && (
          <>
            <SwitchRow
              label="Show retired facts"
              hint="Facts Sando replaced after you told it something new."
              checked={showRetired}
              onChange={setShowRetired}
            />
            {visible.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Sando isn’t remembering anything yet. Tell it about yourself in
                a chat.
              </p>
            )}
            {visible.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
              >
                <div
                  className={cn("min-w-0 flex-1", !f.active && "opacity-50")}
                >
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      !f.active && "line-through",
                    )}
                  >
                    {f.value}
                  </p>
                </div>
                <Badge
                  variant={f.active ? "secondary" : "outline"}
                  className="hidden sm:inline-flex"
                >
                  {f.when}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Forget ${f.label}`}
                  onClick={() =>
                    setFacts((l) => l.filter((x) => x.id !== f.id))
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Row
              label="Wipe all memory"
              hint="Sando forgets everything it knows about you. This can’t be undone."
            >
              <ConfirmButton
                label="Wipe"
                confirmLabel="Yes, wipe it"
                disabled={facts.length === 0}
                onConfirm={() => setFacts([])}
              />
            </Row>
          </>
        )}
      </Group>
    </>
  );
}

/* ------------------------------ Data controls ----------------------------- */

function DataControls({ s, set }: P) {
  return (
    <>
      <Group title="Privacy">
        <SwitchRow
          label="Improve Sando for everyone"
          hint="Allow your chats to be used to train and improve models."
          checked={s.improve}
          onChange={(v) => set("improve", v)}
        />
        <SwitchRow
          label="Use my location"
          hint="Helps Sando give local recommendations, news and weather."
          checked={s.location}
          onChange={(v) => set("location", v)}
        />
        <LinkRow
          label="Shared links"
          hint="See and remove chats you have shared."
          onClick={() => {}}
        />
        <LinkRow
          label="Information shared with apps"
          hint="Review what connected apps can see."
          onClick={() => {}}
        />
      </Group>

      <Group title="Your chats">
        <Row label="Archived chats" hint="Chats hidden from your sidebar.">
          <Button variant="outline" size="sm" className="rounded-full">
            <Archive className="size-4" aria-hidden /> View
          </Button>
        </Row>
        <Row label="Archive all chats">
          <ConfirmButton
            label="Archive all"
            confirmLabel="Yes, archive"
            onConfirm={() => {}}
          />
        </Row>
        <Row
          label="Export data"
          hint="We email you a file with your chats and settings."
        >
          <ActionButton
            label="Export"
            doneLabel="Requested"
            onClick={() => {}}
          />
        </Row>
      </Group>

      <div className="overflow-hidden rounded-2xl border border-destructive/40">
        <Row
          label="Delete all chats"
          hint="Permanently removes every chat. This can’t be undone."
        >
          <ConfirmButton
            label="Delete all"
            confirmLabel="Yes, delete all"
            onConfirm={() => {}}
          />
        </Row>
      </div>

      <Group title="Cookies">
        <LinkRow label="Cookie preferences" onClick={() => {}} />
      </Group>
    </>
  );
}

/* ---------------------------------- Usage --------------------------------- */

function Usage() {
  return (
    <>
      <Group
        title="Your limits"
        description="Resets every day at midnight (GMT)."
      >
        <Meter
          label="Messages today"
          used={38}
          limit={50}
          hint="12 left today. Big Man has much higher limits."
        />
        <Meter label="Ultra model this month" used={9} limit={10} />
        <Meter label="Files uploaded this month" used={4} limit={20} />
      </Group>

      <Group
        title="Messages per day"
        description="The last 14 days. Today is highlighted."
      >
        <Bars data={dayMessages} labels={dayLabels} />
      </Group>

      <Group title="Models you use">
        {modelUse.map((m) => (
          <div key={m.name} className="px-4 py-3.5 sm:px-5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{m.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {m.share}%
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${m.share}%` }}
              />
            </div>
          </div>
        ))}
      </Group>
    </>
  );
}

/* --------------------------------- Billing -------------------------------- */

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    perks: ["50 messages a day", "Fast and Balanced models", "Basic memory"],
  },
  {
    id: "big-man",
    name: "Big Man",
    price: "$9",
    perks: [
      "Much higher limits",
      "Ultra model access",
      "Full memory and file uploads",
    ],
  },
];

const PLAN_LABELS: Record<string, string> = {
  pekin: "Pekin (free)",
  bigman: "Big Man",
  "big-man": "Big Man",
  developer: "Developer",
  enterprise: "Enterprise",
};

function planLabel(plan?: string): string {
  if (!plan) return PLAN_LABELS.pekin;
  return PLAN_LABELS[plan.toLowerCase()] ?? plan;
}

function Billing({ plan }: { plan?: string }) {
  // Token plan claims are `pekin`/`bigman`/…; this screen groups them as free/paid.
  const planId =
    plan?.toLowerCase() === "bigman" || plan?.toLowerCase() === "big-man"
      ? "big-man"
      : "free";
  const invoices: {
    id: string;
    date: string;
    amount: string;
    status: string;
  }[] = [];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => {
          const on = p.id === planId;
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col rounded-2xl border p-5",
                on ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-base font-medium">
                  {p.id === "big-man" && (
                    <Crown className="size-4 text-primary" aria-hidden />
                  )}
                  {p.name}
                </p>
                {on && <Badge variant="secondary">Current plan</Badge>}
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {p.price}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / month
                </span>
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-sm text-muted-foreground">
                {p.perks.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {!on && (
                <Link
                  href="/plan"
                  className={cn(buttonVariants(), "mt-5 rounded-full")}
                >
                  Upgrade to {p.name}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <Group title="Payment methods">
        <Row label="Mobile money" hint="Pay with Orange Money or MTN MoMo.">
          <Button variant="outline" size="sm" className="rounded-full">
            <Wallet className="size-4" aria-hidden /> Add
          </Button>
        </Row>
        <Row label="Card" hint="Visa or Mastercard.">
          <Button variant="outline" size="sm" className="rounded-full">
            <CreditCard className="size-4" aria-hidden /> Add
          </Button>
        </Row>
      </Group>

      <Group title="Invoices">
        {invoices.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No invoices yet. They appear here after your first payment.
          </p>
        ) : (
          invoices.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
            >
              <div>
                <p className="text-sm font-medium">{i.date}</p>
                <Status tone="ok">{i.status}</Status>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums">{i.amount}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Download invoice ${i.id}`}
                >
                  <Download className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))
        )}
      </Group>
    </>
  );
}
