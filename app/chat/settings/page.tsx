"use client";

import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icon } from "@/components/Icon";
import { PageShell } from "@/components/PageShell";
import { Pick } from "@/components/Pick";
import { Group, Row } from "@/components/SettingsKit";

// Keycloak account console (set NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL in .env)
const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL ?? "#";

const dialects = [
  "Koloqua",
  "Gio / Dan",
  "Bassa",
  "Kpelle",
  "Kru",
  "Vai",
  "Other",
];
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
const voices = ["Monrovia (female)", "Kakata (male)", "Elder (warm)"];
const models = [
  "Fast (30B)",
  "Balanced (Llama 3.3 70B)",
  "Ultra (Nemotron-3 550B)",
];
const modes = ["Quick answers", "Balanced", "Think it through"];
const switching = [
  "Match my dialect",
  "Always Koloqua",
  "Mix dialect and English",
  "Standard English",
];

type Fact = {
  id: number;
  label: string;
  value: string;
  when: string;
  active: boolean;
};
// Sample data: replace with the human memory block from Letta
const seed: Fact[] = [
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

export default function SettingsPage() {
  const [tab, setTab] = useState("profile");
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("Ghazaleh Eshghi");
  const [email, setEmail] = useState("ghazaleh@example.com");
  const [dialect, setDialect] = useState("Koloqua");
  const [county, setCounty] = useState("Montserrado");
  const [synced, setSynced] = useState(false);

  const [voice, setVoice] = useState(voices[0]);
  const [rate, setRate] = useState(1);
  const [autoplay, setAutoplay] = useState(true);
  const [ptt, setPtt] = useState(false);
  const [mic, setMic] = useState<"idle" | "ok" | "denied">("idle");

  const [model, setModel] = useState(models[1]);
  const [mode, setMode] = useState(modes[1]);
  const [sw, setSw] = useState(switching[0]);
  const [explain, setExplain] = useState(true);

  const [facts, setFacts] = useState<Fact[]>(seed);
  const [showRetired, setShowRetired] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    if (window.location.hash === "#memory") setTab("memory");
  }, []);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }; // TODO: persist
  const testMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setMic("ok");
    } catch {
      setMic("denied");
    }
  };
  const visible = facts.filter((f) => showRetired || f.active);
  const SaveBar = (
    <div className="mt-8 flex justify-end">
      <Button size="lg" onClick={save}>
        {saved ? "Saved" : "Save changes"}
      </Button>
    </div>
  );

  return (
    <PageShell
      title="Settings"
      subtitle="Your profile, security, voice, AI behaviour and what Sando remembers."
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto [scrollbar-width:none]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="ai">AI brain</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
        </TabsList>

        {/* Profile & identity */}
        <TabsContent value="profile" className="mt-6 flex flex-col gap-8">
          <Group title="Profile & identity" icon="user">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-14">
                  <AvatarFallback className="bg-secondary text-xl">
                    {name[0] || "G"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {email}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Change photo
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSynced(true);
                    setTimeout(() => setSynced(false), 1800);
                  }}
                >
                  {synced ? "Synced" : "Sync with Keycloak"}
                </Button>
              </div>
            </div>
            <Row label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Row>
            <Row label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Row>
          </Group>
          <Group title="Language & region" icon="language">
            <Row
              label="Primary dialect"
              hint="Sando answers in this by default."
            >
              <Pick value={dialect} onChange={setDialect} options={dialects} />
            </Row>
            <Row
              label="Home county"
              hint="Used for local news, weather and guides."
            >
              <Pick value={county} onChange={setCounty} options={counties} />
            </Row>
          </Group>
          {SaveBar}
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6 flex flex-col gap-8">
          <Group title="Account security" icon="shield">
            <Row label="Password" hint="Changed in your Keycloak account.">
              <a
                href={KEYCLOAK_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" }) + " w-full"}
              >
                Change password
              </a>
            </Row>
            <Row
              label="Two-factor authentication"
              hint="Add a second step when you sign in."
            >
              <a
                href={KEYCLOAK_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" }) + " w-full"}
              >
                Manage 2FA
              </a>
            </Row>
            <Row
              label="Account console"
              hint="Sessions, linked accounts and more."
            >
              <a
                href={KEYCLOAK_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants() + " w-full"}
              >
                Open Keycloak
              </a>
            </Row>
          </Group>
        </TabsContent>

        {/* Voice */}
        <TabsContent value="voice" className="mt-6 flex flex-col gap-8">
          <Group title="Voice & audio" icon="mic">
            <Row label="Voice" hint="How Sando sounds when it speaks.">
              <Pick value={voice} onChange={setVoice} options={voices} />
            </Row>
            <Row
              label={`Speaking rate: ${rate.toFixed(1)}x`}
              hint="Slower is easier to follow."
            >
              <Slider
                value={[rate]}
                min={0.5}
                max={1.5}
                step={0.1}
                onValueChange={(v) => setRate(v[0])}
                aria-label="Speaking rate"
              />
            </Row>
            <Row label="Play replies automatically">
              <div className="flex sm:justify-end">
                <Switch
                  checked={autoplay}
                  onCheckedChange={setAutoplay}
                  aria-label="Play replies automatically"
                />
              </div>
            </Row>
            <Row
              label="Push to talk"
              hint="Hold a key to speak instead of open mic."
            >
              <div className="flex sm:justify-end">
                <Switch
                  checked={ptt}
                  onCheckedChange={setPtt}
                  aria-label="Push to talk"
                />
              </div>
            </Row>
            <Row
              label="Microphone"
              hint={
                mic === "ok"
                  ? "Microphone works."
                  : mic === "denied"
                    ? "Blocked. Allow it in your browser settings."
                    : "Check that your mic is allowed."
              }
            >
              <Button variant="outline" className="w-full" onClick={testMic}>
                Test microphone
              </Button>
            </Row>
          </Group>
          {SaveBar}
        </TabsContent>

        {/* AI brain */}
        <TabsContent value="ai" className="mt-6 flex flex-col gap-8">
          <Group title="AI brain & reasoning" icon="bolt">
            <Row label="Model" hint="Ultra and Balanced need the Big Man plan.">
              <Pick value={model} onChange={setModel} options={models} />
            </Row>
            <Row label="Reasoning mode">
              <Pick value={mode} onChange={setMode} options={modes} />
            </Row>
            <Row
              label="Code-switching"
              hint="How Sando mixes dialect and English."
            >
              <Pick value={sw} onChange={setSw} options={switching} />
            </Row>
            <Row
              label="Explain dialect words"
              hint="Add short meanings after local words."
            >
              <div className="flex sm:justify-end">
                <Switch
                  checked={explain}
                  onCheckedChange={setExplain}
                  aria-label="Explain dialect words"
                />
              </div>
            </Row>
          </Group>
          {SaveBar}
        </TabsContent>

        {/* Memory inspector */}
        <TabsContent value="memory" className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              This is what Sando knows about you. Tell Sando in chat when
              something changes, or edit it here.
            </p>
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <Switch
                checked={showRetired}
                onCheckedChange={setShowRetired}
                aria-label="Show retired facts"
              />
              Show retired
            </label>
          </div>

          <Group title="Saved facts" icon="shield">
            {visible.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Sando isn't remembering anything yet.
              </p>
            )}
            {visible.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-4 sm:p-5">
                <div
                  className={`min-w-0 flex-1 ${f.active ? "" : "opacity-50"}`}
                >
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p
                    className={`truncate text-sm font-medium ${f.active ? "" : "line-through"}`}
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
                  <Icon name="trash" size={16} />
                </Button>
              </div>
            ))}
          </Group>

          <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div>
              <p className="text-sm font-medium">Wipe all memory</p>
              <p className="text-xs text-muted-foreground">
                Sando forgets everything it knows about you. This can't be
                undone.
              </p>
            </div>
            {confirmWipe ? (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setFacts([]);
                    setConfirmWipe(false);
                  }}
                >
                  Yes, wipe it
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setConfirmWipe(true)}
                disabled={facts.length === 0}
              >
                Wipe
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
