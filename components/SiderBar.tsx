"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

const USER_NAME = "Ghazaleh"; // TODO: read from your Keycloak session

type Group = "Today" | "Yesterday" | "Previous 7 days";
type Chat = { id: string; title: string; group: Group };
const groups: Group[] = ["Today", "Yesterday", "Previous 7 days"];

// Replace with your real history
const chats: Chat[] = [
  { id: "s1", title: "Gio Vocabulary Practice", group: "Today" },
  { id: "s3", title: "Market phrases in Gio", group: "Today" },
  { id: "s4", title: "Translate my letter to Koloqua", group: "Today" },
  { id: "s5", title: "Grand Bassa proverbs", group: "Yesterday" },
  { id: "s6", title: "Greeting elders in Nimba", group: "Yesterday" },
  { id: "s2", title: "Liberian History Study", group: "Previous 7 days" },
  { id: "s7", title: "Kpelle numbers", group: "Previous 7 days" },
  { id: "s8", title: "Help with my CV", group: "Previous 7 days" },
];

type NavItem = { label: string; href: string; icon: IconName };
const nav: NavItem[] = [
  { label: "Connect", href: "/chat/connect", icon: "plug" },
  { label: "Plugins", href: "/chat/plugin", icon: "puzzle" },
];
const languages = ["English", "Español", "Français", "العربية"];

const surface = "border border-white/[0.07] bg-[#0a0a0b] text-zinc-100";
const hoverRow = "hover:bg-white/[0.06] hover:text-white";
const activeRow = "bg-white/[0.09] text-white";
const idleRow = "text-zinc-400";

function ChatRow({
  chat,
  onNavigate,
}: {
  chat: Chat;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={`/chat?id=${chat.id}`}
      onClick={onNavigate}
      title={chat.title}
      className={cn(
        "block truncate rounded-lg px-3 py-2 text-[13px] transition-colors",
        idleRow,
        hoverRow,
      )}
    >
      {chat.title}
    </Link>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-4 text-[11px] font-medium text-zinc-500">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="mx-1 h-px shrink-0 bg-white/[0.07]" />;
}

/**
 * One panel, two layouts:
 *  - full (drawer, or desktop rail while hovered): labels + history
 *  - collapsed (desktop rail at rest): icons only
 */
function Panel({
  full,
  collapsed,
  onNavigate,
  onMenuChange,
  lang,
  onLang,
}: {
  full?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  onMenuChange?: (open: boolean) => void;
  lang: string;
  onLang: (l: string) => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "language">("menu");
  const wrap = useRef<HTMLDivElement>(null);

  // Label visibility + row alignment per layout
  const lbl = full ? "" : collapsed ? "hidden" : "hidden lg:block";
  const row = full
    ? "justify-start px-3"
    : collapsed
      ? "justify-center px-0"
      : "justify-center px-0 lg:justify-start lg:px-3";

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) =>
      !wrap.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  // Let the parent keep the rail expanded while the profile menu is open
  useEffect(() => {
    onMenuChange?.(open);
  }, [open, onMenuChange]);

  // Return to the main menu after the popup has closed
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setView("menu"), 200);
    return () => clearTimeout(t);
  }, [open]);

  const go = () => {
    setOpen(false);
    onNavigate?.();
  };

  const item =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors";
  const menuItem = cn(item, "text-zinc-200 hover:bg-white/[0.07]");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Header */}
      <div
        className={cn(
          "flex h-10 items-center gap-2.5 px-1",
          collapsed && "justify-center",
        )}
      >
        <Link href="/" onClick={onNavigate} aria-label="Sando home">
          <span className={cn("font-zentry text-xl tracking-wide", lbl)}>
            Sando
          </span>
          <span
            aria-hidden
            className={cn(
              "font-zentry text-xl",
              full ? "hidden" : collapsed ? "" : "lg:hidden",
            )}
          >
            S
          </span>
        </Link>
      </div>

      <Divider />

      {/* Nav */}
      <nav aria-label="Main" className="flex flex-col gap-1">
        <Link
          href="/chat"
          onClick={onNavigate}
          title="New chat"
          className={cn(
            "mb-1 flex h-10 items-center gap-2.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85",
            row,
          )}
        >
          <Icon name="plus" />
          <span className={lbl}>New chat</span>
        </Link>
        {nav.map(({ label, href, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-xl text-sm transition-colors",
                row,
                active ? activeRow : cn(idleRow, hoverRow),
              )}
            >
              <Icon name={icon} />
              <span className={lbl}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <Divider />

      {/* History */}
      <div
        className={cn(
          "min-h-0 flex-1 flex-col",
          full ? "flex" : collapsed ? "hidden" : "hidden lg:flex",
        )}
      >
        <div className="flex-1 overflow-y-auto [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]">
          {groups.map((g, i) => {
            const list = chats.filter((c) => c.group === g);
            return list.length === 0 ? null : (
              <React.Fragment key={g}>
                <p
                  className={cn(
                    "px-3 pb-1.5 text-[11px] font-medium text-zinc-500",
                    i === 0 ? "pt-1" : "pt-4",
                  )}
                >
                  {g}
                </p>
                {list.map((c) => (
                  <ChatRow key={c.id} chat={c} onNavigate={onNavigate} />
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Spacer pushes the profile to the bottom when history is hidden (rail) */}
      <div
        className={cn(
          "flex-1",
          full ? "hidden" : collapsed ? "block" : "block lg:hidden",
        )}
      />

      <Divider />

      {/* Profile + popup */}
      <div ref={wrap} className="relative">
        <div
          role="menu"
          inert={!open}
          className={cn(
            "absolute bottom-full left-0 z-30 mb-2 w-56 origin-bottom-left rounded-xl border border-white/10 bg-[#141416] p-1.5 shadow-2xl shadow-black/60 transition-[opacity,transform] duration-150",
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0",
          )}
        >
          {view === "menu" ? (
            <div className="flex flex-col">
              <Link
                href="/chat/settings"
                role="menuitem"
                onClick={go}
                className={menuItem}
              >
                <Icon name="settings" className="text-zinc-400" />
                <span className="flex-1">Settings</span>
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => setView("language")}
                className={menuItem}
              >
                <Icon name="language" className="text-zinc-400" />
                <span className="flex-1">Language</span>
                <span className="text-xs text-zinc-500">{lang}</span>
                <Icon name="chevron" size={14} className="text-zinc-500" />
              </button>
              <Link
                href="/help"
                role="menuitem"
                onClick={go}
                className={menuItem}
              >
                <Icon name="help" className="text-zinc-400" />
                <span className="flex-1">Get help</span>
              </Link>
              <div className="mx-2 my-1 h-px bg-white/[0.07]" />
              <Link
                href="/plan"
                role="menuitem"
                onClick={go}
                className={cn(
                  item,
                  "bg-primary font-medium text-primary-foreground hover:bg-primary/85",
                )}
              >
                <Icon name="upgrade" /> Upgrade plan
              </Link>
            </div>
          ) : (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setView("menu")}
                className={cn(
                  item,
                  "text-zinc-400 hover:bg-white/[0.07] hover:text-white",
                )}
              >
                <Icon name="back" size={16} /> Language
              </button>
              <div className="mx-2 my-1 h-px bg-white/[0.07]" />
              {languages.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="menuitemradio"
                  aria-checked={lang === l}
                  onClick={() => {
                    onLang(l);
                    setView("menu");
                  }}
                  className={cn(menuItem, "justify-between")}
                >
                  {l}
                  {lang === l && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title={USER_NAME}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.06]",
            open && "bg-white/[0.06]",
            !full &&
              (collapsed
                ? "justify-center"
                : "justify-center lg:justify-start"),
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-medium text-white">
            {USER_NAME[0]}
          </span>
          <span className={cn("flex-1 truncate text-sm", lbl)}>
            {USER_NAME}
          </span>
          <Icon
            name="chevron"
            size={16}
            className={cn(
              "text-zinc-500 transition-transform duration-150",
              open ? "-rotate-90" : "rotate-90",
              lbl,
            )}
          />
        </button>
      </div>
    </div>
  );
}

export const SiderBar = () => {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const expanded = hovered || menuOpen;
  const [lang, setLang] = useState("English"); // shared by rail and drawer

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  // Stop the page behind the drawer from scrolling
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  return (
    <>
      {/* Mobile top bar */}
      <header
        className={cn(
          "flex h-14 shrink-0 items-center justify-between rounded-2xl px-2 md:hidden",
          surface,
        )}
      >
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
          className="grid size-10 place-items-center rounded-lg transition-colors hover:bg-white/[0.08]"
        >
          <Icon name="menu" size={20} />
        </button>
        <Link
          href="/"
          aria-label="Sando home"
          className="font-zentry text-xl tracking-wide"
        >
          Sando
        </Link>
        <Link
          href="/chat"
          aria-label="New chat"
          className="grid size-10 place-items-center rounded-lg transition-colors hover:bg-white/[0.08]"
        >
          <Icon name="plus" size={20} />
        </Link>
      </header>

      {/* Desktop rail: small at rest, slides open on hover */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setHovered(false);
        }}
        className={cn(
          "relative hidden shrink-0 overflow-visible rounded-[22px] p-3 transition-[width] duration-300 ease-in-out md:block",
          surface,
          expanded ? "w-[264px]" : "w-[68px]",
        )}
      >
        <Panel
          full={expanded}
          collapsed={!expanded}
          onMenuChange={setMenuOpen}
          lang={lang}
          onLang={setLang}
        />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          !drawer && "pointer-events-none",
        )}
        inert={!drawer}
      >
        <div
          onClick={() => setDrawer(false)}
          className={cn(
            "absolute inset-0 bg-black/70 transition-opacity duration-200",
            drawer ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          className={cn(
            "absolute inset-y-2 left-2 w-[85%] max-w-[300px] rounded-[22px] p-4 transition-transform duration-300",
            surface,
            drawer ? "translate-x-0" : "-translate-x-[110%]",
          )}
        >
          <button
            type="button"
            onClick={() => setDrawer(false)}
            aria-label="Close menu"
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Icon name="close" size={16} />
          </button>
          <Panel
            full
            onNavigate={() => setDrawer(false)}
            lang={lang}
            onLang={setLang}
          />
        </aside>
      </div>
    </>
  );
};
