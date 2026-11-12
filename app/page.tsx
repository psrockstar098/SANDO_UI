import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { HearSando } from "@/components/HearSando";
import { Icon, type IconName } from "@/components/Icon";
import { MobileNav } from "@/components/MobileNav";
import { cn } from "@/lib/utils";

// Point this at your Keycloak sign-up URL
const SIGNUP = process.env.NEXT_PUBLIC_SIGNUP_URL ?? "/chat";

const nav = [
  { label: "Hear Sando", href: "#hear" },
  { label: "Languages", href: "#languages" },
  { label: "Why Sando", href: "#trust" },
  { label: "Plans", href: "/plan" },
  { label: "Help", href: "/help" },
] as const;

const conversation = [
  { from: "user", text: "How the body today?" },
  { from: "sando", text: "Baa! Body fine, my guy. And you, how you do?" },
  { from: "user", text: "I’m reaching to my hou’ now." },
  {
    from: "sando",
    text: "Ah, you’re setting off for home. Safe road, my guy!",
  },
] as const;

const languages: { name: string; region?: string }[] = [
  { name: "Koloqua", region: "Monrovia" },
  { name: "Gio / Dan", region: "Nimba" },
  { name: "Bassa", region: "Grand Bassa" },
  { name: "Kpelle", region: "Bong" },
  { name: "Kru" },
  { name: "Vai", region: "Grand Cape Mount" },
  { name: "Grebo", region: "Maryland" },
  { name: "Mandingo" },
  { name: "Gola" },
  { name: "Kisi", region: "Lofa" },
  { name: "Loma", region: "Lofa" },
  { name: "Mano", region: "Nimba" },
  { name: "Krahn", region: "Grand Gedeh" },
  { name: "Gbandi", region: "Lofa" },
  { name: "Dei" },
  { name: "Mende" },
];

const pillars: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "user",
    title: "Real memory",
    text: "Remembers who you are and where you live, and keeps it up to date over time.",
  },
  {
    icon: "book",
    title: "Verified knowledge",
    text: "Dictionary facts backed by cultural archives, so answers come from real sources.",
  },
  {
    icon: "mic",
    title: "Natural voice",
    text: "Understands and speaks with local cadence, rhythm and tone.",
  },
  {
    icon: "shield",
    title: "Data privacy",
    text: "Secure sign-in and a private data silo for every user.",
  },
];

const pill = "rounded-full";

function Section({
  id,
  title,
  text,
  children,
}: {
  id?: string;
  title: string;
  text?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h2>
          {text && <p className="mt-3 text-muted-foreground">{text}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="Sando home"
            className="font-zentry text-xl tracking-wide"
          >
            Sando
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 md:flex"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                pill,
                "hidden sm:inline-flex",
              )}
            >
              Sign in
            </Link>
            <Link
              href={SIGNUP}
              className={cn(buttonVariants({ size: "sm" }), pill)}
            >
              Start free
            </Link>
            <MobileNav items={[...nav, { label: "Sign in", href: "/chat" }]} />
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28 lg:pt-24">
          <div className="animate-rise">
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              The first AI that speaks pure Liberian English and native
              dialects.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Conversational AI, grounded translation and voice intelligence for
              Koloqua, Gio/Dan, Bassa, Kpelle and beyond.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href={SIGNUP}
                className={cn(buttonVariants({ size: "lg" }), pill)}
              >
                Start chatting free
              </Link>
              <a
                href="#hear"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  pill,
                )}
              >
                <Icon name="mic" size={16} />
                Listen to a voice demo
              </a>
            </div>
          </div>

          <figure
            aria-label="Example conversation in Koloqua"
            className="animate-rise rounded-2xl border border-border bg-card [animation-delay:120ms]"
          >
            <figcaption className="flex items-center gap-2 border-b border-border px-5 py-3.5 text-sm text-muted-foreground">
              <Icon name="chat" size={16} />
              Koloqua · Monrovia
            </figcaption>
            <div className="flex flex-col gap-3 p-5 text-sm">
              {conversation.map((m) => (
                <p
                  key={m.text}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5",
                    m.from === "user"
                      ? "self-end rounded-br-sm bg-primary text-primary-foreground"
                      : "self-start rounded-bl-sm bg-secondary",
                  )}
                >
                  {m.text}
                </p>
              ))}
            </div>
          </figure>
        </section>

        <Section
          id="hear"
          title="Hear Sando talk"
          text="Pick a dialect and press play."
        >
          <div className="max-w-3xl">
            <HearSando />
          </div>
        </Section>

        <Section
          title="Sando vs. generic AI"
          text="Same message. Very different understanding."
        >
          <p className="mb-4 text-sm text-muted-foreground">
            You wrote: “I’m reaching to my hou’ now.”
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <figure className="rounded-xl border border-border bg-card p-6">
              <figcaption className="mb-3 text-sm text-muted-foreground">
                Generic AI
              </figcaption>
              <blockquote className="text-muted-foreground">
                I do not recognize that slang. “Hou” is likely a misspelling of
                “house”…
              </blockquote>
            </figure>
            <figure className="rounded-xl bg-white p-6 text-black">
              <figcaption className="mb-3 text-sm text-neutral-600">
                Sando
              </figcaption>
              <blockquote>
                My guy, “reaching to my hou’” means you’re setting off for home
                right now. Baa!
              </blockquote>
            </figure>
          </div>
        </Section>

        <Section
          id="languages"
          title="Built for the whole nation"
          text="Not just Monrovia street talk. Sando is built for Liberia’s languages, from every county."
        >
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
            {languages.map(({ name, region }) => (
              <li key={name} className="bg-background p-5">
                <p className="font-medium">{name}</p>
                <p className="mt-1 h-5 text-sm text-muted-foreground">
                  {region}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="trust" title="Why you can trust Sando">
          <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <li key={p.title} className="bg-background p-6">
                <Icon name={p.icon} className="mb-8 text-muted-foreground" />
                <h3 className="font-medium">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Final CTA: the one inverted block on the page */}
        <section className="bg-white text-black">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-24 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="max-w-xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                Ready to talk to Sando?
              </h2>
              <p className="mt-3 text-neutral-600">
                Free to start. No card needed.
              </p>
            </div>
            <Link
              href={SIGNUP}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-black px-7 text-sm font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-black"
            >
              Create your free account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Sando. Made for Liberia.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/plan" className="hover:text-foreground">
              Plans
            </Link>
            <Link href="/help" className="hover:text-foreground">
              Help
            </Link>
            <a href="mailto:support@sando.ai" className="hover:text-foreground">
              support@sando.ai
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
