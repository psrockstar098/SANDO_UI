"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { getDisplayName, toPlainText } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useConversationMessages } from "@/hooks/useConversation";
import {
  errorMessage,
  isAbortError,
  sendPrompt,
  streamPrompt,
  type ChatTurn,
} from "@/lib/api/api";
import {
  createConversation,
  getConversation,
  listConversations,
  saveConversation,
  type StoredMessage,
} from "@/lib/chat/store";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Message = StoredMessage;
type Tab = "chat" | "avatar";

const suggestions = [
  "Teach me greetings in Koloqua",
  "Translate a sentence for me",
  "Quiz me on Gio vocabulary",
];

// The OpenUI library only runs in the browser; keep it out of SSR entirely.
const OpenUIAnswer = dynamic(() => import("@/components/chat/OpenUIAnswer"), {
  ssr: false,
});

/** True when the text starts a plausible OpenUI Lang program. */
function looksLikeOpenUI(code: string): boolean {
  return /^\s*(root|[A-Za-z_][A-Za-z0-9_]*)\s*=/m.test(code);
}

/** True once the text contains an OpenUI Lang assignment statement. */
function hasAssignment(code: string): boolean {
  return /(^|\n)\s*(root|[A-Za-z_][A-Za-z0-9_]*)\s*=/.test(code);
}

function assistantMessage(
  content: string,
  kind: "text" | "openui",
): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: Date.now(),
    kind,
  };
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function Bubble({
  message,
  onFollowUp,
  onStateUpdate,
}: {
  message: Message;
  onFollowUp: (prompt: string) => void;
  onStateUpdate: (id: string, state: Record<string, unknown>) => void;
}) {
  const mine = message.role === "user";
  if (!mine && message.kind === "openui") {
    return (
      <OpenUIAnswer
        code={message.content}
        state={message.uiState}
        onStateUpdate={(state) => onStateUpdate(message.id, state)}
        onFollowUp={onFollowUp}
      />
    );
  }
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed md:max-w-[70%]",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-white/[0.07] text-neutral-100",
        )}
      >
        {mine ? message.content : toPlainText(message.content)}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div
      className="flex justify-start"
      role="status"
      aria-label="Sando is typing"
    >
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3.5">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="size-1.5 animate-bounce rounded-full bg-neutral-400"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chat: the user talks to the AI                                      */
/* ------------------------------------------------------------------ */

/** Prompts already auto-sent from `?prompt=`, so remounts don't repeat them. */
const handledPrompts = new Set<string>();

function Chat({ routeId }: { routeId: string | null }) {
  const { user, status, getToken } = useAuth();
  const params = useSearchParams();
  const initialPrompt = params.get("prompt");

  const [conversationId, setConversationId] = useState<string | null>(routeId);
  // The transcript lives in the store, so it hydrates and switches chats safely.
  const messages = useConversationMessages(conversationId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Live streaming answer; written to the store when it ends. */
  const [draft, setDraft] = useState<{ id: string; content: string } | null>(
    null,
  );
  /** Conversation the in-flight reply belongs to (null when idle). */
  const [pendingId, setPendingId] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** The conversation currently on screen, readable from async callbacks. */
  const activeId = useRef<string | null>(conversationId);

  const firstName = getDisplayName(user, "").split(" ")[0];

  useEffect(() => {
    activeId.current = conversationId;
  }, [conversationId]);

  // Follow the URL so sidebar links and back/forward switch transcripts.
  // The id we write back after creating a conversation is already on screen,
  // so only the bookkeeping changes then — never a reload mid-reply.
  const [syncedRoute, setSyncedRoute] = useState(routeId);
  if (routeId !== syncedRoute) {
    setSyncedRoute(routeId);
    if (routeId !== conversationId) {
      setConversationId(routeId);
      setInput("");
      setError(null);
      setLoading(pendingId !== null && pendingId === routeId);
    }
  }

  // Note: URL changes remount this view in this app, so a reply must never be
  // cancelled by an unmount — it is written to the store and picked up again.

  // Keep the newest message in view
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, draft?.content]);

  // Auto-grow the textarea (max ~6 lines)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const send = useCallback(
    async (text: string, mode: "text" | "ui" = "ui") => {
      const content = text.trim();
      if (!content || loading) return;

      // Create a conversation on the first message so reloads keep it.
      let id = conversationId;
      if (!id || !getConversation(id)) {
        id = createConversation().id;
        setConversationId(id);
        window.history.replaceState(null, "", `/chat?id=${id}`);
      }

      const next: Message[] = [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "user",
          content,
          createdAt: Date.now(),
        },
      ];
      saveConversation(id, next);
      setInput("");
      setError(null);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;
      setPendingId(id);

      // Accumulated stream text, kept outside `try` so `catch` can save the
      // partial answer without reading stale state from the closure.
      let streamed = "";

      try {
        const token = await getToken();
        const history: ChatTurn[] = next
          .slice(0, -1)
          .map(({ role, content: c }) => ({ role, content: c }));

        if (mode === "text") {
          const { reply } = await sendPrompt({
            prompt: content,
            history,
            token,
            signal: controller.signal,
            mode,
          });
          // Persists to the store either way; the view follows the store.
          saveConversation(id, [...next, assistantMessage(reply, "text")]);
          return;
        }

        const draftId = crypto.randomUUID();
        setDraft({ id: draftId, content: "" });
        const { reply } = await streamPrompt({
          prompt: content,
          history,
          token,
          mode: "ui",
          signal: controller.signal,
          onToken: (chunk) => {
            streamed += chunk;
            setDraft((d) =>
              d ? { ...d, content: d.content + chunk } : d,
            );
          },
        });

        // A UI-mode reply that is not a program is prose: store it as text
        // so it renders as a normal bubble instead of an empty box.
        const kind = looksLikeOpenUI(reply) ? "openui" : "text";
        // Persists to the store either way; the view follows the store.
        saveConversation(id, [...next, assistantMessage(reply, kind)]);
      } catch (err) {
        if (isAbortError(err)) {
          // Stop keeps the partial answer when there is one.
          if (streamed.trim()) {
            const kind = looksLikeOpenUI(streamed) ? "openui" : "text";
            saveConversation(id, [
              ...next,
              assistantMessage(streamed, kind),
            ]);
          }
        } else {
          // A mid-stream failure keeps the partial answer and shows the
          // error text below it.
          const partial = (err as { partial?: string }).partial;
          if (partial && partial.trim()) {
            const kind = looksLikeOpenUI(partial) ? "openui" : "text";
            saveConversation(id, [
              ...next,
              assistantMessage(partial, kind),
            ]);
          }
          if (activeId.current === id) {
            setError(errorMessage(err));
          }
        }
      } finally {
        setDraft(null);
        setPendingId(null);
        if (abortRef.current === controller) abortRef.current = null;
        setLoading(false);
        box.current?.focus();
      }
    },
    [conversationId, messages, loading, getToken],
  );

  const onFollowUp = useCallback(
    (prompt: string) => {
      void send(prompt);
    },
    [send],
  );

  /** Persists an in-answer form's state on its stored message. */
  const onStateUpdate = useCallback(
    (id: string, state: Record<string, unknown>) => {
      const cid = conversationId;
      if (!cid) return;
      const convo = getConversation(cid);
      if (!convo) return;
      saveConversation(
        cid,
        convo.messages.map((m) => (m.id === id ? { ...m, uiState: state } : m)),
      );
    },
    [conversationId],
  );

  // "Ask Sando" from Help lands here with ?prompt=… — send each prompt once.
  // The guard lives outside the component: this view remounts when the URL
  // changes and after the sign-in round-trip reloads the page.
  useEffect(() => {
    if (!initialPrompt || routeId) return;
    // Wait for the Keycloak check: it can reload the page, and a request that
    // starts before that reload never comes back.
    if (status === "loading" || status === "error") return;
    if (handledPrompts.has(initialPrompt)) return;
    handledPrompts.add(initialPrompt);

    // The page reloaded after asking already: reopen that answer instead.
    const answered = listConversations().find(
      (c) =>
        c.messages[0]?.role === "user" &&
        c.messages[0].content === initialPrompt &&
        c.messages.some((m) => m.role === "assistant"),
    );
    if (answered) {
      window.history.replaceState(null, "", `/chat?id=${answered.id}`);
      return;
    }

    // After paint, not during the effect's render pass (and the timer must
    // survive a StrictMode remount, so it is deliberately not cleaned up).
    setTimeout(() => void send(initialPrompt), 0);
  }, [initialPrompt, routeId, status, send]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a new line (ignore IME composing)
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-2 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] md:px-6"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-6 text-center">
            <div>
              <h1 className="text-2xl font-medium text-white">
                {firstName ? `Hello, ${firstName}` : "Hello"}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                What would you like to learn today?
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-white/10 px-3.5 py-2 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4 py-4">
            {messages.map((m) => (
              <Bubble
                key={m.id}
                message={m}
                onFollowUp={onFollowUp}
                onStateUpdate={onStateUpdate}
              />
            ))}
            {draft &&
              (hasAssignment(draft.content) ? (
                <OpenUIAnswer
                  code={draft.content}
                  isStreaming
                  onFollowUp={(prompt) => void send(prompt)}
                />
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5 text-sm leading-relaxed text-neutral-100 md:max-w-[70%]">
                    {draft.content}
                  </div>
                </div>
              ))}
            {loading && !draft && <TypingBubble />}
            {error && (
              <p role="alert" className="text-center text-xs text-neutral-300">
                {error}
              </p>
            )}
            <div ref={bottom} />
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mx-auto w-full max-w-3xl shrink-0 px-1 pb-1 pt-2 md:px-0"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 transition-colors focus-within:border-white/25">
          <textarea
            ref={box}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Message Sando…"
            aria-label="Message"
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
          />
          {loading ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop generating"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <SendIcon />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar: real-time avatar that speaks to the user (placeholder)      */
/* ------------------------------------------------------------------ */

function Avatar() {
  return (
    <div className="grid h-full place-items-center text-sm text-neutral-500">
      Avatar coming soon
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const tabs: { id: Tab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "avatar", label: "Avatar" },
];

function ChatHome() {
  const params = useSearchParams();
  const routeId = params.get("id");
  const [tab, setTab] = useState<Tab>("chat");

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      setTab((t) => (t === "chat" ? "avatar" : "chat"));
    }
  };

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-black p-2">
      {/* Tab switch */}
      <div className="flex shrink-0 justify-center pb-2 pt-1">
        <div
          role="tablist"
          aria-label="Mode"
          onKeyDown={onTabKey}
          className="flex rounded-full border border-white/10 bg-white/[0.04] p-1"
        >
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-full px-5 py-1.5 text-sm transition-colors",
                tab === id
                  ? "bg-white/[0.12] text-white"
                  : "text-neutral-400 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Both stay mounted so the conversation isn't lost when switching */}
      <div
        role="tabpanel"
        id="panel-chat"
        aria-labelledby="tab-chat"
        hidden={tab !== "chat"}
        className="min-h-0 flex-1"
      >
        {/* Chat follows the `?id=` param itself, so it must not remount */}
        <Chat routeId={routeId} />
      </div>
      <div
        role="tabpanel"
        id="panel-avatar"
        aria-labelledby="tab-avatar"
        hidden={tab !== "avatar"}
        className="min-h-0 flex-1"
      >
        <Avatar />
      </div>
    </section>
  );
}

export default function ChatView() {
  return <ChatHome />;
}
