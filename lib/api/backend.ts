/**
 * Shared plumbing for the Next.js route handlers under `app/api`.
 *
 * Every browser request is forwarded to the Sando backend with the caller's
 * Keycloak token. Keeping this on the server means the backend address stays
 * configurable and the browser never needs to know it.
 *
 * Backend contract (see the Zig server):
 *   GET    /api/meta/liberia                       -> { counties, languages }   (public)
 *   POST   /api/chat          { messages, stream }  -> { response, dialect, choices }
 *   POST   /api/chat/regenerate { collection? }     -> { response, dialect, choices }
 *   POST   /api/chat/edit     { index, content }    -> { response, dialect, choices }
 *   POST   /api/knowledge     { collection, ... }   -> { status, message }
 *   GET    /api/user                                -> { id, username, email, dialect, region }
 *   PUT    /api/user/location { county }            -> { status, county, dialect }
 *   PUT    /api/user/language { language }          -> { status, language, county }
 *   PUT    /api/user/dialect  { dialect, region }   -> { status, message }
 *   PUT    /api/session/prompt { persona?, human? } -> { status, message }
 *   POST   /api/session/remember { fact }           -> { status, message }
 *   POST   /api/session/import { persona?, human?, history? } -> { status, message }
 *   GET    /api/session/export                      -> { persona, human, history, ... }
 *   DELETE /api/session/messages { from_index }     -> { status, message }
 *   DELETE /api/session/history                     -> { status, message }
 *   DELETE /api/session                             -> { status, message }
 *   DELETE /api/user                                -> { status, message }
 *
 * The backend answers 401 without a valid bearer token and 429 when the caller
 * is going too fast; both are passed through so the UI can show the real reason.
 */

const DEFAULT_BACKEND = "http://127.0.0.1:22323";

export const DEFAULT_TIMEOUT_MS = 20_000;
export const CHAT_TIMEOUT_MS = 90_000;

export type BackendResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

function backendUrl(): string {
  const url =
    process.env.SANDO_API_URL ??
    process.env.NEXT_PUBLIC_BACKEND ??
    DEFAULT_BACKEND;
  return url.replace(/\/+$/, "");
}

export function fail(error: string, status: number) {
  return Response.json({ error }, { status });
}

export type JsonObject = Record<string, unknown>;

export type JsonBodyResult =
  | { ok: true; value: JsonObject }
  | { ok: false; error: string };

/**
 * Reads the request body as a JSON object.
 *
 * `allowEmpty` is for endpoints whose payload is optional (`{}` is then a
 * valid body); everything else rejects a missing body like malformed JSON.
 */
export async function readJsonObject(
  request: Request,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): Promise<JsonBodyResult> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, error: "The request body must be valid JSON." };
  }

  if (!text.trim()) {
    return allowEmpty
      ? { ok: true, value: {} }
      : { ok: false, error: "The request body must be valid JSON." };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "The request body must be a JSON object." };
    }
    return { ok: true, value: parsed as JsonObject };
  } catch {
    return { ok: false, error: "The request body must be valid JSON." };
  }
}

/** Trims a required string field; rejects empty, wrong-type, or over-long values. */
export function cleanString(value: unknown, maxLength = 256): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

/**
 * Trims an optional string field. `undefined` means the key was absent,
 * `null` means it was present but not a string or too long.
 */
export function optionalString(
  value: unknown,
  maxLength = 20_000,
): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) return null;
  return value.trim();
}

/** The backend reports failures as `{ error }`; accept a plain string too. */
export function errorMessage(data: unknown): string | null {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  for (const key of ["error", "message", "detail"]) {
    if (typeof d[key] === "string" && (d[key] as string).trim()) {
      return (d[key] as string).trim();
    }
  }
  return null;
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface CallOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Abort the upstream request after this long. */
  timeoutMs?: number;
}

/**
 * Calls the backend and normalises the result. Never throws: route handlers
 * can hand the failure straight back to the browser.
 */
export async function callBackend(
  path: string,
  request: Request,
  { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS }: CallOptions = {},
): Promise<BackendResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const authorization = request.headers.get("authorization");

    const upstream = await fetch(`${backendUrl()}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(authorization && { Authorization: authorization }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const data = parseBody(await upstream.text());

    if (!upstream.ok) {
      // A 4xx is about this request (bad body, bad token, rate limit) and is
      // useful to the caller; anything else is an upstream failure.
      const status =
        upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      return {
        ok: false,
        status,
        error:
          errorMessage(data) ?? `Sando replied with status ${upstream.status}.`,
      };
    }

    return { ok: true, data };
  } catch (err) {
    if (timedOut) {
      return {
        ok: false,
        status: 504,
        error: "Sando took too long to answer. Please try again.",
      };
    }
    console.error(`Backend ${method} ${path} failed:`, err);
    return {
      ok: false,
      status: 502,
      error: "Can't reach Sando right now. Please try again.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export type BackendStreamResult =
  | { ok: true; body: ReadableStream<Uint8Array> }
  | { ok: false; status: number; error: string };

/**
 * Calls the backend and returns its response stream untouched.
 *
 * Unlike `callBackend`, the timeout only guards the wait for headers: once
 * `fetch` resolves the timer is cleared, because aborting after headers
 * would kill the stream. Callers must consume `body` promptly.
 */
export async function callBackendStream(
  path: string,
  request: Request,
  body: unknown,
  timeoutMs = CHAT_TIMEOUT_MS,
): Promise<BackendStreamResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const authorization = request.headers.get("authorization");

    const upstream = await fetch(`${backendUrl()}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/x-ndjson",
        "Content-Type": "application/json",
        ...(authorization && { Authorization: authorization }),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    // Headers arrived: the timer must not kill the stream.
    clearTimeout(timer);

    if (!upstream.ok) {
      const data = parseBody(await upstream.text());
      const status =
        upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      return {
        ok: false,
        status,
        error:
          errorMessage(data) ?? `Sando replied with status ${upstream.status}.`,
      };
    }

    if (!upstream.body) {
      return { ok: false, status: 502, error: "Sando returned no stream." };
    }

    return { ok: true, body: upstream.body };
  } catch (err) {
    if (timedOut) {
      return {
        ok: false,
        status: 504,
        error: "Sando took too long to answer. Please try again.",
      };
    }
    console.error(`Backend stream ${path} failed:`, err);
    return {
      ok: false,
      status: 502,
      error: "Can't reach Sando right now. Please try again.",
    };
  } finally {
    clearTimeout(timer);
  }
}
