import {
  decodeFrameBytes,
  isA2UIMessage,
  parseA2UIFrame,
} from "@/lib/chat/a2ui";
import type { AgentToRendererMessage } from "@a2ui/web_core/v1_0";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

/**
 * Browser requests go to our own Next.js routes, which proxy to the backend
 * with the caller's token. See `app/api/*`.
 */
const CHAT_PATH = "/api/chat";
const USER_PATH = "/api/user";
const DIALECT_PATH = "/api/user/dialect";
const LOCATION_PATH = "/api/user/location";
const LANGUAGE_PATH = "/api/user/language";
const META_LIBERIA_PATH = "/api/meta/liberia";
const SESSION_PROMPT_PATH = "/api/session/prompt";
const REGENERATE_PATH = "/api/chat/regenerate";
const EDIT_PATH = "/api/chat/edit";
const SESSION_MESSAGES_PATH = "/api/session/messages";
const SESSION_REMEMBER_PATH = "/api/session/remember";
const SESSION_EXPORT_PATH = "/api/session/export";
const SESSION_IMPORT_PATH = "/api/session/import";
const SESSION_HISTORY_PATH = "/api/session/history";
const SESSION_PATH = "/api/session";
const KNOWLEDGE_PATH = "/api/knowledge";
const DEFAULT_TIMEOUT_MS = 90_000;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface SendPromptParams {
  prompt: string;
  /** Earlier messages in this conversation (not including `prompt`). */
  history?: ChatTurn[];
  /** Keycloak access token from `getToken()`. */
  token: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  mode?: "text" | "ui";
}

export interface ChatResponse {
  reply: string;
  mode: "text" | "ui";
}

/** The profile the backend keeps for the signed-in user. */
export interface ServerProfile {
  id: string;
  name?: string;
  username: string;
  email: string;
  dialect: string;
  region: string;
}

export interface AuthParams {
  token: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Public metadata used by the sign-up and settings forms. */
export interface LiberiaMeta {
  counties: string[];
  languages: string[];
}

/** The user's full memory snapshot, as returned by `GET /api/session/export`. */
export interface SessionSnapshot {
  persona: string;
  human: string;
  history: ChatTurn[];
  user_id?: string;
  last_active_ms?: number;
}

/** A subset of a snapshot accepted by `POST /api/session/import`. */
export interface SessionImport {
  persona?: string;
  human?: string;
  history?: ChatTurn[];
}

/** A dialect entry taught to the backend through `POST /api/knowledge`. */
export interface KnowledgeEntry {
  collection: string;
  id: string;
  input: string;
  response: string;
  types?: string;
  region?: string;
  register?: string;
  standard_english?: string;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get isUnauthorized() {
    return this.status === 401 || this.status === 403;
  }

  get isTimeout() {
    return this.status === 408 || this.status === 504;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------------ */
/* Core request helper                                                 */
/* ------------------------------------------------------------------ */

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const {
    method = "POST",
    body,
    token,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  // One controller handles both our timeout and the caller's cancel
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", onCallerAbort, { once: true });

  try {
    const res = await fetch(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      throw new ApiError(
        extractMessage(data) ?? `Request failed (${res.status})`,
        res.status,
        data,
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isAbortError(err)) {
      if (timedOut)
        throw new ApiError("The request timed out. Please try again.", 408);
      throw err; // cancelled by the caller
    }
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

function extractMessage(data: unknown): string | null {
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["error", "message", "detail"]) {
      if (typeof d[key] === "string" && (d[key] as string).trim()) {
        return d[key] as string;
      }
    }
  }
  return null;
}

/** Normalises `{ reply, mode }` from a chat-shaped backend response. */
function chatResponse(
  data: { reply?: unknown; mode?: unknown } | null,
  fallbackMode: "text" | "ui",
): ChatResponse {
  const reply =
    data && typeof data.reply === "string" ? data.reply.trim() : undefined;

  if (!reply) {
    throw new ApiError("The server returned an empty response.", 502, data);
  }
  const mode =
    data && (data.mode === "ui" || data.mode === "text")
      ? data.mode
      : fallbackMode;
  return { reply, mode };
}

function isSessionTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Record<string, unknown>;
  return (
    (turn.role === "user" || turn.role === "assistant") &&
    typeof turn.content === "string"
  );
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sends the user's prompt (plus conversation history) to Sando.
 *
 * The backend is stateless: it needs the full history on every request, and it
 * reads the user's identity from the bearer token rather than the body.
 */
export async function sendPrompt({
  prompt,
  history = [],
  token,
  signal,
  timeoutMs,
  mode: requestedMode = "text",
}: SendPromptParams): Promise<ChatResponse> {
  const text = prompt.trim();
  if (!text) throw new ApiError("Prompt is empty.", 400);

  const messages: ChatTurn[] = [
    ...history.filter((t) => t.content.trim().length > 0),
    { role: "user", content: text },
  ];

  const data = await request<{ reply?: unknown; mode?: unknown }>(CHAT_PATH, {
    method: "POST",
    token,
    signal,
    timeoutMs,
    body: { messages, mode: requestedMode, stream: false },
  });

  return chatResponse(data, requestedMode);
}

/** The profile and chat preferences the backend holds for this user. */
export async function getProfile({
  token,
  signal,
  timeoutMs = 8_000,
}: AuthParams): Promise<ServerProfile> {
  return request<ServerProfile>(USER_PATH, {
    method: "GET",
    token,
    signal,
    timeoutMs,
  });
}

/** Changes the dialect and region Sando uses to answer. */
export async function updateDialect({
  dialect,
  region,
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams & { dialect: string; region: string }): Promise<void> {
  await request<{ status?: string }>(DIALECT_PATH, {
    method: "PUT",
    token,
    signal,
    timeoutMs,
    body: { dialect, region },
  });
}

/** Deletes the account in Keycloak. There is no undo. */
export async function deleteAccount({
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams): Promise<void> {
  await request<{ status?: string }>(USER_PATH, {
    method: "DELETE",
    token,
    signal,
    timeoutMs,
  });
}

/* ------------------------------------------------------------------ */
/* Liberia metadata, memory, and knowledge                             */
/* ------------------------------------------------------------------ */

/** Public: the 15 counties and the languages Sando supports. */
export async function getLiberiaMeta({
  token,
  signal,
  timeoutMs = 8_000,
}: Partial<AuthParams> = {}): Promise<LiberiaMeta> {
  return request<LiberiaMeta>(META_LIBERIA_PATH, {
    method: "GET",
    token,
    signal,
    timeoutMs,
  });
}

/** Changes the user's home county. */
export async function updateLocation({
  county,
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams & { county: string }): Promise<{
  county: string;
  dialect?: string;
}> {
  const text = county.trim();
  if (!text) throw new ApiError("County is empty.", 400);

  const data = await request<{ county?: unknown; dialect?: unknown }>(
    LOCATION_PATH,
    {
      method: "PUT",
      token,
      signal,
      timeoutMs,
      body: { county: text },
    },
  );

  return {
    county: typeof data.county === "string" ? data.county : text,
    ...(typeof data.dialect === "string" && data.dialect
      ? { dialect: data.dialect }
      : {}),
  };
}

/** Changes the language / dialect collection Sando answers in. */
export async function updateLanguage({
  language,
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams & { language: string }): Promise<{
  language: string;
  county?: string;
}> {
  const text = language.trim();
  if (!text) throw new ApiError("Language is empty.", 400);

  const data = await request<{ language?: unknown; county?: unknown }>(
    LANGUAGE_PATH,
    {
      method: "PUT",
      token,
      signal,
      timeoutMs,
      body: { language: text },
    },
  );

  return {
    language: typeof data.language === "string" ? data.language : text,
    ...(typeof data.county === "string" && data.county
      ? { county: data.county }
      : {}),
  };
}

/** Replaces the session's system persona and/or human memory block. */
export async function updateSessionPrompt({
  persona,
  human,
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams & { persona?: string; human?: string }): Promise<void> {
  if (persona === undefined && human === undefined) {
    throw new ApiError("Provide persona, human, or both.", 400);
  }

  await request<{ status?: string }>(SESSION_PROMPT_PATH, {
    method: "PUT",
    token,
    signal,
    timeoutMs,
    body: {
      ...(persona !== undefined && { persona }),
      ...(human !== undefined && { human }),
    },
  });
}

/** Regenerates the last assistant reply without using the cache. */
export async function regenerateReply({
  collection,
  topK,
  token = null,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: Partial<AuthParams> & {
  collection?: string;
  topK?: number;
} = {}): Promise<ChatResponse> {
  const data = await request<{ reply?: unknown; mode?: unknown }>(
    REGENERATE_PATH,
    {
      method: "POST",
      token,
      signal,
      timeoutMs,
      body: {
        ...(collection !== undefined && { collection }),
        ...(topK !== undefined && { top_k: topK }),
      },
    },
  );

  return chatResponse(data, "text");
}

/** Edits the message at `index` and regenerates from that point. */
export async function editAndRegenerate({
  index,
  content,
  collection,
  topK,
  token = null,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: Partial<AuthParams> & {
  index: number;
  content: string;
  collection?: string;
  topK?: number;
}): Promise<ChatResponse> {
  const text = content.trim();
  if (!Number.isInteger(index) || index < 0) {
    throw new ApiError("index must be a non-negative integer.", 400);
  }
  if (!text) throw new ApiError("Prompt is empty.", 400);

  const data = await request<{ reply?: unknown; mode?: unknown }>(EDIT_PATH, {
    method: "POST",
    token,
    signal,
    timeoutMs,
    body: {
      index,
      content: text,
      ...(collection !== undefined && { collection }),
      ...(topK !== undefined && { top_k: topK }),
    },
  });

  return chatResponse(data, "text");
}

/** Removes the message at `fromIndex` and everything after it. */
export async function deleteMessagesFrom({
  fromIndex,
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams & { fromIndex: number }): Promise<void> {
  if (!Number.isInteger(fromIndex) || fromIndex < 0) {
    throw new ApiError("fromIndex must be a non-negative integer.", 400);
  }

  await request<{ status?: string }>(SESSION_MESSAGES_PATH, {
    method: "DELETE",
    token,
    signal,
    timeoutMs,
    body: { from_index: fromIndex },
  });
}

/** Pins an explicit fact to core memory. */
export async function rememberFact({
  fact,
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams & { fact: string }): Promise<void> {
  const text = fact.trim();
  if (!text) throw new ApiError("Fact is empty.", 400);

  await request<{ status?: string }>(SESSION_REMEMBER_PATH, {
    method: "POST",
    token,
    signal,
    timeoutMs,
    body: { fact: text },
  });
}

/** Downloads and normalises the user's full memory snapshot. */
export async function exportSession({
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams): Promise<SessionSnapshot> {
  const data = await request<Record<string, unknown> | null>(
    SESSION_EXPORT_PATH,
    {
      method: "GET",
      token,
      signal,
      timeoutMs,
    },
  );
  const snapshot = data ?? {};

  const history = Array.isArray(snapshot.history)
    ? snapshot.history.filter(isSessionTurn)
    : [];

  return {
    persona: typeof snapshot.persona === "string" ? snapshot.persona : "",
    human: typeof snapshot.human === "string" ? snapshot.human : "",
    history,
    ...(typeof snapshot.user_id === "string" && {
      user_id: snapshot.user_id,
    }),
    ...(typeof snapshot.last_active_ms === "number" && {
      last_active_ms: snapshot.last_active_ms,
    }),
  };
}

/** Restores persona, human memory, and/or history from a snapshot. */
export async function importSession({
  snapshot,
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams & { snapshot: SessionImport }): Promise<void> {
  if (
    snapshot.persona === undefined &&
    snapshot.human === undefined &&
    snapshot.history === undefined
  ) {
    throw new ApiError("Provide persona, human, or history.", 400);
  }

  await request<{ status?: string }>(SESSION_IMPORT_PATH, {
    method: "POST",
    token,
    signal,
    timeoutMs,
    body: {
      ...(snapshot.persona !== undefined && { persona: snapshot.persona }),
      ...(snapshot.human !== undefined && { human: snapshot.human }),
      ...(snapshot.history !== undefined && { history: snapshot.history }),
    },
  });
}

/** Starts a new chat: clears the transcript but keeps core memory. */
export async function clearHistory({
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams): Promise<void> {
  await request<{ status?: string }>(SESSION_HISTORY_PATH, {
    method: "DELETE",
    token,
    signal,
    timeoutMs,
  });
}

/** Wipes the whole session, including core memory. There is no undo. */
export async function wipeSession({
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams): Promise<void> {
  await request<{ status?: string }>(SESSION_PATH, {
    method: "DELETE",
    token,
    signal,
    timeoutMs,
  });
}

/** Adds a dialect entry to the backend's Qdrant knowledge base. */
export async function teachKnowledge({
  entry,
  token,
  signal,
  timeoutMs = 20_000,
}: AuthParams & { entry: KnowledgeEntry }): Promise<void> {
  if (
    !entry.collection.trim() ||
    !entry.id.trim() ||
    !entry.input.trim() ||
    !entry.response.trim()
  ) {
    throw new ApiError(
      "collection, id, input, and response are required.",
      400,
    );
  }

  await request<{ status?: string }>(KNOWLEDGE_PATH, {
    method: "POST",
    token,
    signal,
    timeoutMs,
    body: entry,
  });
}

/* ------------------------------------------------------------------ */
/* Streaming (A2UI mode)                                               */
/* ------------------------------------------------------------------ */

export interface StreamPromptParams extends SendPromptParams {
  mode: "ui";
  /** One complete A2UI wire message per call, in stream order. */
  onMessage: (message: AgentToRendererMessage) => void;
}

export interface StreamChatResponse {
  /** The wire log: one A2UI message JSON object per line. */
  reply: string;
  mode: "ui";
}

type ApiErrorWithPartial = ApiError & { partial?: string };

/**
 * Streams a UI-mode answer from `/api/chat` as base64 NDJSON frames.
 *
 * Each decoded frame is one complete A2UI wire message. `onMessage` receives
 * it parsed and validated; the returned `reply` is the wire log (one message
 * per line) for storage. When the backend reports an error mid-stream, or the
 * connection fails after messages, the thrown `ApiError` carries the
 * accumulated log as `partial` so the caller can keep it. The caller's
 * `signal` aborts the reader; that abort is rethrown as-is. No internal
 * timeout: a generation may legitimately run long, and the caller owns
 * cancellation.
 */
export async function streamPrompt({
  prompt,
  history = [],
  token,
  signal,
  onMessage,
}: StreamPromptParams): Promise<StreamChatResponse> {
  const text = prompt.trim();
  if (!text) throw new ApiError("Prompt is empty.", 400);

  const messages: ChatTurn[] = [
    ...history.filter((t) => t.content.trim().length > 0),
    { role: "user", content: text },
  ];

  let res: Response;
  try {
    res = await fetch(CHAT_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ messages, mode: "ui", stream: true }),
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  }

  if (!res.ok) {
    const raw = await res.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }
    throw new ApiError(
      extractMessage(data) ?? `Request failed (${res.status})`,
      res.status,
      data,
    );
  }

  if (!res.body) {
    throw new ApiError("The server did not return a stream.", 502);
  }

  // One decoder for the NDJSON wire bytes, one for the base64 frame
  // payloads; both stream so a UTF-8 codepoint split across frames survives.
  const wire = new TextDecoder("utf-8");
  const payload = new TextDecoder("utf-8");
  const reader = res.body.getReader();
  let buffer = "";
  let reply = "";

  const withPartial = (err: ApiError): ApiErrorWithPartial => {
    const withReply = err as ApiErrorWithPartial;
    withReply.partial = reply;
    return withReply;
  };

  /** Handles one complete NDJSON line; returns true when the stream ends. */
  const handleLine = (line: string): boolean => {
    const frame = parseA2UIFrame(line);
    if (!frame) return false;
    if (frame.error !== undefined) {
      throw withPartial(new ApiError(frame.error, 502));
    }
    if (frame.d !== undefined) {
      const decoded = payload.decode(decodeFrameBytes(frame.d), {
        stream: true,
      });
      let message: unknown;
      try {
        message = JSON.parse(decoded);
      } catch {
        throw withPartial(
          new ApiError(`Malformed A2UI message: ${decoded.slice(0, 120)}`, 502),
        );
      }
      if (!isA2UIMessage(message)) {
        throw withPartial(
          new ApiError(
            `Not an A2UI v1.0 message: ${decoded.slice(0, 120)}`,
            502,
          ),
        );
      }
      reply += `${JSON.stringify(message)}\n`;
      onMessage(message);
    }
    return frame.done === true;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += wire.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        if (handleLine(buffer.slice(0, nl))) return { reply, mode: "ui" };
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
    }
    // The stream closed without a done frame: flush both decoders and
    // process any trailing line, then return what arrived.
    buffer += wire.decode();
    if (buffer.trim()) handleLine(buffer);
    payload.decode();
    return { reply, mode: "ui" };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isAbortError(err)) throw err;
    throw withPartial(
      new ApiError("Can't reach the server. Check your connection.", 0),
    );
  } finally {
    reader.releaseLock();
  }
}
