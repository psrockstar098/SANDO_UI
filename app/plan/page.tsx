"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icon } from "@/components/Icon";
import { PageShell } from "@/components/PageShell";
import { cn } from "@/lib/utils";

type PlanId = "pekin" | "bigman" | "developer" | "enterprise";
type Audience = "everyday" | "builders";

type Plan = {
  id: PlanId;
  name: string;
  tag: string;
  monthly: number | null; // null = custom pricing
  note?: string;
  features: string[];
  popular?: boolean;
  audience: Audience;
};

// TODO: read from your Keycloak session / role (e.g. pro_subscriber). null = signed out.
const viewer: { plan: PlanId | null } = { plan: "pekin" };

// TODO: point at your billing portal route.
const BILLING_HREF = "/settings#billing";

const YEARLY_DISCOUNT = 0.2;
const PLAN_ORDER: PlanId[] = ["pekin", "bigman", "developer", "enterprise"];

const plans: Plan[] = [
  {
    id: "pekin",
    name: "Pekin",
    tag: "Starter",
    monthly: 0,
    audience: "everyday",
    features: [
      "Unlimited web text chat",
      "Standard RAG knowledge base",
      "Koloqua only",
      "Basic session memory (30 days)",
    ],
  },
  {
    id: "bigman",
    name: "Big Man",
    tag: "Pro Voice",
    monthly: 8,
    note: "about 1,500 LRD / month",
    popular: true,
    audience: "everyday",
    features: [
      "Everything in Pekin",
      "Real-time voice chat",
      "All indigenous dialects",
      "Persistent Letta memory",
      "Top-tier models ",
    ],
  },
  {
    id: "developer",
    name: "Developer",
    tag: "Full API",
    monthly: 29,
    note: "Overages: $0.002 / 1K tokens, $0.05 / voice minute",
    audience: "builders",
    features: [
      "Everything in Big Man",
      "Text API: 1M tokens / month",
      "Voice API: 120 minutes / month",
      "Qdrant vector search access",
      "Webhooks and Keycloak OAuth",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tag: "Org & NGO",
    monthly: null,
    audience: "builders",
    features: [
      "Custom dialect knowledge bases",
      "Custom voice models",
      "Dedicated Letta memory workspaces",
      "99.9% uptime SLA",
      "Invoice, wire and Mobile Money billing",
    ],
  },
];

const NONE = "—";

const row = (
  feature: string,
  pekin: string,
  bigman: string,
  developer: string,
  enterprise: string,
) => ({ feature, values: { pekin, bigman, developer, enterprise } });

const matrix = [
  row("Text chat interface", "Yes", "Yes", "Yes", "Yes"),
  row("Voice chat (hands-free)", NONE, "Unlimited", "Unlimited", "Unlimited"),
  row("Supported dialects", "Koloqua", "All 16+", "All 16+", "Custom"),
  row(
    "Persistent Letta memory",
    "Basic",
    "Advanced",
    "Advanced",
    "Dedicated cluster",
  ),
  row(
    "Model quality",
    "30B fast",
    "550B / 70B",
    "550B / 70B",
    "Custom fine-tunes",
  ),
  row("Text API (REST)", NONE, NONE, "1M tokens / mo", "High volume"),
  row("Voice API (TTS & ASR)", NONE, NONE, "120 mins / mo", "Custom SLA"),
  row("Custom Qdrant collections", NONE, NONE, "1 collection", "Unlimited"),
  row(
    "Support",
    "Community",
    "Priority email",
    "Slack / Discord",
    "24/7 phone & MoMo",
  ),
];

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);

// Work in cents so 8 * 0.8 never renders as 6.4000000000000001
const perMonth = (base: number, yearly: boolean) =>
  Math.round(base * 100 * (yearly ? 1 - YEARLY_DISCOUNT : 1)) / 100;

const pill = "w-full rounded-full";

function PlanAction({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const variant = plan.popular ? "default" : "outline";
  const style = (extra?: string) =>
    cn(buttonVariants({ variant, size: "lg" }), pill, extra);

  if (viewer.plan === plan.id) {
    return (
      <Button variant="outline" size="lg" disabled className={pill}>
        Current plan
      </Button>
    );
  }
  if (plan.id === "enterprise") {
    return (
      <a href="mailto:sales@sando.ai" className={style()}>
        Contact sales
      </a>
    );
  }
  if (
    viewer.plan &&
    PLAN_ORDER.indexOf(plan.id) < PLAN_ORDER.indexOf(viewer.plan)
  ) {
    return (
      <Link href={BILLING_HREF} className={style()}>
        Manage plan
      </Link>
    );
  }
  if (plan.id === "pekin") {
    return (
      <Link href="/signup" className={style()}>
        Sign up free
      </Link>
    );
  }
  // Point this at your Stripe Checkout / billing portal route
  return (
    <Link
      href={`/api/checkout?plan=${plan.id}&billing=${yearly ? "yearly" : "monthly"}`}
      className={style()}
    >
      {viewer.plan ? `Upgrade to ${plan.name}` : `Get ${plan.name}`}
    </Link>
  );
}

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const price = plan.monthly === null ? null : perMonth(plan.monthly, yearly);
  const figure = "font-agd text-5xl leading-none";

  return (
    <Card
      className={cn(
        "gap-6 rounded-2xl py-7 shadow-none",
        plan.popular && "border-foreground",
      )}
    >
      <CardHeader className="gap-1">
        <div className="flex items-center justify-between">
          <CardDescription>{plan.tag}</CardDescription>
          {plan.popular && <Badge>Most popular</Badge>}
        </div>
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <div className="pt-3">
          <p className="flex items-baseline gap-2">
            {price === null ? (
              <span className={figure}>Custom</span>
            ) : price === 0 ? (
              <>
                <span className={figure}>Free</span>
                <span className="text-sm text-muted-foreground">forever</span>
              </>
            ) : (
              <>
                <span className={figure}>{money(price)}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </>
            )}
          </p>
          <p className="mt-2 min-h-8 text-xs text-muted-foreground">
            {price && yearly
              ? `Billed ${money(Math.round(price * 12 * 100) / 100)} yearly`
              : plan.note}
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <ul className="flex flex-col gap-3 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <Icon name="check" size={16} className="mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <PlanAction plan={plan} yearly={yearly} />
      </CardFooter>
    </Card>
  );
}

export default function PlansPage() {
  const [yearly, setYearly] = useState(false);
  const [audience, setAudience] = useState<Audience>("everyday");
  const shown = plans.filter((p) => p.audience === audience);

  return (
    <PageShell
      wide
      title="Plans & pricing"
      subtitle="Start free. Upgrade for voice, every dialect, permanent memory and API access."
    >
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={audience}
          onValueChange={(v) => setAudience(v as Audience)}
        >
          <TabsList aria-label="Plan audience">
            <TabsTrigger value="everyday">Everyday users</TabsTrigger>
            <TabsTrigger value="builders">
              Builders &amp; businesses
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs
          value={yearly ? "yearly" : "monthly"}
          onValueChange={(v) => setYearly(v === "yearly")}
        >
          <TabsList aria-label="Billing period">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">
              Yearly
              <Badge variant="secondary" className="ml-1.5">
                Save {YEARLY_DISCOUNT * 100}%
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((p) => (
          <PlanCard key={p.id} plan={p} yearly={yearly} />
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Accepted: Visa, Mastercard, Stripe, Lonestar MTN Mobile Money, Orange
        Money.
      </p>

      <section className="mt-16" aria-labelledby="compare">
        <h2 id="compare" className="mb-4 text-xl font-medium">
          Compare all plans
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 w-52 bg-background">
                  Feature
                </TableHead>
                {plans.map((p) => (
                  <TableHead key={p.id}>
                    {p.name}
                    {viewer.plan === p.id && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Current
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map(({ feature, values }) => (
                <TableRow key={feature} className="hover:bg-muted/50">
                  <TableCell className="sticky left-0 bg-background font-medium">
                    {feature}
                  </TableCell>
                  {plans.map((p) => {
                    const value = values[p.id];
                    return (
                      <TableCell
                        key={p.id}
                        className={cn(viewer.plan === p.id && "bg-muted/50")}
                      >
                        {value === NONE ? (
                          <>
                            <span aria-hidden className="text-muted-foreground">
                              {NONE}
                            </span>
                            <span className="sr-only">Not included</span>
                          </>
                        ) : (
                          value
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </PageShell>
  );
}
