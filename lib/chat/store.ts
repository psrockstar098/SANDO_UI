/**
 * Conversation history stored in the browser.
 *
 * The backend is stateless, so the client owns the transcript. Keeping it in
 * localStorage makes the sidebar history real (and survives reloads) without
 * until there is a server-side conversations API.
 */

export type ChatRole = "user" | "assistant";

export type ChatKind = "text" | "openui";

export interface StoredMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  /** Absent means "text", so messages stored before OpenUI still load. */
  kind?: ChatKind;
  /** OpenUI form state, persisted with the message. */
  uiState?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

export type ConversationGroup =
  | "Today"
  | "Yesterday"
  | "Previous 7 days"
  | "Older";

export const CONVERSATION_GROUPS: ConversationGroup[] = [
  "Today",
  "Yesterday",
  "Previous 7 days",
  "Older",
];

export const NEW_CHAT_TITLE = "New chat";

const STORAGE_KEY = "sando:conversations:v1";
const CHANGE_EVENT = "sando:conversations-change";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isMessage(value: unknown): value is StoredMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    typeof m.createdAt === "number" &&
    (m.kind === undefined || m.kind === "text" || m.kind === "openui") &&
    (m.uiState === undefined ||
      (typeof m.uiState === "object" && m.uiState !== null))
  );
}

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    typeof c.createdAt === "number" &&
    typeof c.updatedAt === "number" &&
    Array.isArray(c.messages) &&
    c.messages.every(isMessage)
  );
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Parsed copy of storage, so `getSnapshot`-style reads return a stable
 * reference between writes (React's useSyncExternalStore requires that).
 */
let cache: Conversation[] | null = null;

/** Stable snapshot for "no messages", used by useSyncExternalStore. */
export const NO_MESSAGES: readonly StoredMessage[] = [];

function readAll(): Conversation[] {
  if (!isBrowser()) return [];
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return (cache = []);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return (cache = []);
    cache = parsed
      .filter(isConversation)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return cache;
  } catch {
    return (cache = []);
  }
}

function writeAll(conversations: Conversation[]) {
  if (!isBrowser()) return;
  // Remember the write even if storage is unavailable (private mode, quota).
  cache = conversations;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage full or disabled: the conversation still works in memory.
  }
  notify();
}

export function subscribeConversations(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  // Another tab cleared or changed the list: drop the cache before notifying.
  const onExternalChange = () => {
    cache = null;
    listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onExternalChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onExternalChange);
  };
}

export function listConversations(): Conversation[] {
  return readAll();
}

export function getConversation(id: string): Conversation | null {
  return readAll().find((c) => c.id === id) ?? null;
}

/** Stable transcript read for `useSyncExternalStore` (server: empty). */
export function getMessages(id: string | null): readonly StoredMessage[] {
  if (!id) return NO_MESSAGES;
  return getConversation(id)?.messages ?? NO_MESSAGES;
}

export function createConversation(): Conversation {
  const now = Date.now();
  const conversation: Conversation = {
    id: crypto.randomUUID(),
    title: NEW_CHAT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  writeAll([conversation, ...readAll()]);
  return conversation;
}

function titleFromMessages(messages: StoredMessage[]): string | null {
  const first = messages.find((m) => m.role === "user" && m.content.trim());
  if (!first) return null;
  const oneLine = first.content.replace(/\s+/g, " ").trim();
  return oneLine.length > 52 ? `${oneLine.slice(0, 52).trimEnd()}…` : oneLine;
}

/** Replaces the transcript of a conversation and refreshes its title/date. */
export function saveConversation(
  id: string,
  messages: StoredMessage[],
): Conversation | null {
  const all = readAll();
  const index = all.findIndex((c) => c.id === id);
  if (index === -1) return null;

  const current = all[index];
  const autoTitle =
    current.title === NEW_CHAT_TITLE ? titleFromMessages(messages) : null;

  const next: Conversation = {
    ...current,
    messages,
    title: autoTitle ?? current.title,
    updatedAt: Date.now(),
  };

  all[index] = next;
  writeAll(all.sort((a, b) => b.updatedAt - a.updatedAt));
  return next;
}

export function renameConversation(id: string, title: string): void {
  const all = readAll();
  const index = all.findIndex((c) => c.id === id);
  if (index === -1) return;
  const clean = title.trim();
  if (clean) all[index] = { ...all[index], title: clean };
  writeAll(all);
}

export function deleteConversation(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function clearConversations(): void {
  writeAll([]);
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function groupForDate(time: number): ConversationGroup {
  const today = startOfDay(Date.now());
  const day = startOfDay(time);
  const days = Math.round((today - day) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  return "Older";
}

export function groupConversations(
  conversations: Conversation[],
): { label: ConversationGroup; items: Conversation[] }[] {
  return CONVERSATION_GROUPS.map((label) => ({
    label,
    items: conversations.filter((c) => groupForDate(c.updatedAt) === label),
  })).filter((group) => group.items.length > 0);
}
