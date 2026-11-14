/**
 * Pure helpers for the OpenUI answer surface.
 *
 * These have no DOM, network, or React dependencies, so they are unit-tested
 * directly (see Task 7) and shared by the streaming client and the renderer.
 */

export type OpenUIFrame = { d?: string; done?: true; error?: string };

/**
 * Parses one NDJSON line. Returns null for blank lines.
 * Throws for malformed JSON so the caller can surface a protocol error.
 */
export function parseOpenUIFrame(line: string): OpenUIFrame | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`Malformed OpenUI frame: ${trimmed.slice(0, 120)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Malformed OpenUI frame: ${trimmed.slice(0, 120)}`);
  }
  const frame = parsed as Record<string, unknown>;
  if (
    (frame.d !== undefined && typeof frame.d !== "string") ||
    (frame.done !== undefined && frame.done !== true) ||
    (frame.error !== undefined && typeof frame.error !== "string")
  ) {
    throw new Error(`Malformed OpenUI frame: ${trimmed.slice(0, 120)}`);
  }
  const out: OpenUIFrame = {};
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
