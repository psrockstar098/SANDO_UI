/**
 * Pure helpers for the A2UI answer surface.
 *
 * These have no DOM, network, or React dependencies, so they are unit-tested
 * directly and shared by the streaming client and the renderer. The catalog
 * loading here is data-only: `Catalog.fromJson` builds a schema-only catalog
 * from the checked-in `catalog.json`; the React implementations are attached
 * in `components/chat/A2UIAnswer.tsx`.
 */
import { Catalog, createFunctionImplementation } from "@a2ui/web_core";
import type { FunctionImplementation } from "@a2ui/web_core";
import { OpenUrlApi } from "@a2ui/web_core/catalogs/basic/v1";
import type { AgentToRendererMessage } from "@a2ui/web_core/v1_0";
import catalogJson from "./catalog.json";

/** The catalog every A2UI answer in Sando is validated against. */
export const SANDO_CATALOG_ID =
  "https://sando.app/catalogs/chat/v1/catalog.json";

/** The six v1.0 agent-to-renderer message keys. */
export const A2UI_MESSAGE_KEYS = [
  "createSurface",
  "updateComponents",
  "updateDataModel",
  "deleteSurface",
  "callRendererFunction",
  "agentFunctionResponse",
] as const;

/** One NDJSON frame on the chat stream (same envelope as before). */
export type A2UIFrame = { d?: string; done?: true; error?: string };

/**
 * Parses one NDJSON line. Returns null for blank lines.
 * Throws for malformed JSON so the caller can surface a protocol error.
 */
export function parseA2UIFrame(line: string): A2UIFrame | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`Malformed A2UI frame: ${trimmed.slice(0, 120)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Malformed A2UI frame: ${trimmed.slice(0, 120)}`);
  }
  const frame = parsed as Record<string, unknown>;
  if (
    (frame.d !== undefined && typeof frame.d !== "string") ||
    (frame.done !== undefined && frame.done !== true) ||
    (frame.error !== undefined && typeof frame.error !== "string")
  ) {
    throw new Error(`Malformed A2UI frame: ${trimmed.slice(0, 120)}`);
  }
  const out: A2UIFrame = {};
  if (typeof frame.d === "string") out.d = frame.d;
  if (frame.done === true) out.done = true;
  if (typeof frame.error === "string") out.error = frame.error;
  return out;
}

/** Decodes a base64 frame payload into bytes. */
export function decodeFrameBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** True for http(s) URLs only. */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * True when `value` is a v1.0 agent-to-renderer message: an object with
 * `version: "1.0"` and exactly one of the six message keys.
 */
export function isA2UIMessage(value: unknown): value is AgentToRendererMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  if (message.version !== "1.0") return false;
  const keys = A2UI_MESSAGE_KEYS.filter((key) => key in message);
  return keys.length === 1;
}

/**
 * Parses one stored/streamed A2UI wire message. Returns null for blank lines.
 * Throws when the line is not a v1.0 A2UI message, so the caller can fall back
 * to plain text instead of rendering a blank bubble.
 */
export function parseA2UIMessage(line: string): AgentToRendererMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`Malformed A2UI message: ${trimmed.slice(0, 120)}`);
  }
  if (!isA2UIMessage(parsed)) {
    throw new Error(`Not an A2UI v1.0 message: ${trimmed.slice(0, 120)}`);
  }
  return parsed;
}

/**
 * True once the text holds at least one complete A2UI wire message. A UI-mode
 * reply that is prose fails this, so the chat stores it as text. Stray prose
 * or a memory tag beside the messages does not disqualify the reply: the
 * renderer skips those lines, so the rest can still be drawn.
 */
export function looksLikeA2UI(text: string): boolean {
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      if (parseA2UIMessage(line)) return true;
    } catch {
      // Not a message: keep looking at the remaining lines.
    }
  }
  return false;
}

/**
 * Splits stored A2UI content (one wire message per line) into its messages.
 * Throws on the first bad line; callers fall back to plain text.
 */
export function splitA2UIMessages(text: string): AgentToRendererMessage[] {
  const messages: AgentToRendererMessage[] = [];
  for (const line of text.split("\n")) {
    const message = parseA2UIMessage(line);
    if (message) messages.push(message);
  }
  return messages;
}

let cachedCatalog: ReturnType<typeof Catalog.fromJson> | null = null;

/**
 * The Sando catalog as a schema-only catalog, loaded from the checked-in
 * `catalog.json`. The client never uses the basic catalog: the processor
 * gets only this catalog (plus the React implementations built from it).
 */
export function loadSandoCatalog() {
  if (!cachedCatalog) {
    cachedCatalog = Catalog.fromJson(
      catalogJson as Record<string, unknown>,
      "1.0",
    );
    if (cachedCatalog.id !== SANDO_CATALOG_ID) {
      throw new Error(`catalog.json has wrong id: ${cachedCatalog.id}`);
    }
  }
  return cachedCatalog;
}

/**
 * Sando's `openUrl`: the stock API shape, but renderer-only (the agent may
 * never call it in a binding) and http(s)-only — the stock implementation
 * also allows `mailto:` and `tel:`, which Sando does not open.
 */
export function createSandoOpenUrl(): FunctionImplementation {
  return createFunctionImplementation(
    {
      name: OpenUrlApi.name,
      returnType: OpenUrlApi.returnType,
      schema: OpenUrlApi.schema,
      allowedCallers: "rendererOnly",
      requiresUserActivation: true,
      description: OpenUrlApi.description,
    },
    (args) => {
      const url = (args as { url?: unknown }).url;
      if (typeof url === "string" && isSafeUrl(url)) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
  );
}
