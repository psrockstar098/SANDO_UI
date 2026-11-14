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
}

export interface ChatResponse {
  reply: string;
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
}: SendPromptParams): Promise<ChatResponse> {
  const text = prompt.trim();
  if (!text) throw new ApiError("Prompt is empty.", 400);

  const messages: ChatTurn[] = [
    ...history.filter((t) => t.content.trim().length > 0),
    { role: "user", content: text },
  ];

  const data = await request<{ reply?: unknown }>(CHAT_PATH, {
    method: "POST",
    token,
    signal,
    timeoutMs,
    body: { messages, stream: false },
  });

  const reply =
    data && typeof data.reply === "string" ? data.reply.trim() : undefined;

  if (!reply) {
    throw new ApiError("The server returned an empty response.", 502, data);
  }
  return { reply };
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
