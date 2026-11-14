/**
 * Server-side proxy for chat.
 *
 *   POST /api/chat  { messages, mode?, stream? }
 *   -> 200 { reply, mode }                          (non-streaming)
 *   -> 200 application/x-ndjson                     (streaming, mode "ui" only)
 *   -> 4xx/5xx { error }
 *
 * The backend answers with `{ response, dialect, choices }`; the UI only needs
 * the text, so it is flattened to `{ reply }` here. In UI mode the reply is
 * OpenUI Lang and is passed through untouched — `toPlainText` applies to
 * text mode only. Streaming forwards the backend's base64 NDJSON frames
 * unchanged; the browser decodes them (see `lib/chat/openui.ts`).
 */

import { CHAT_TIMEOUT_MS, callBackend, callBackendStream, fail } from "@/lib/api/backend";
import { toPlainText } from "@/lib/format";

type Turn = { role: "user" | "assistant"; content: string };

function isTurn(value: unknown): value is Turn {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    (t.role === "user" || t.role === "assistant") &&
    typeof t.content === "string" &&
    t.content.trim().length > 0
  );
}

/** Reads `response` and/or `choices[0].message.content` from the backend. */
function extractReply(data: unknown): string | null {
  if (typeof data === "string") return data.trim() || null;
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, unknown>;
  for (const key of ["response", "reply", "answer", "content", "message"]) {
    const v = d[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const choices = d.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    const content = message?.content ?? first?.text;
    if (typeof content === "string" && content.trim()) return content.trim();
  }

  return null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("The request body must be valid JSON.", 400);
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const messages = payload.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return fail("messages must be a non-empty array.", 400);
  }
  if (!messages.every(isTurn)) {
    return fail(
      "Each message needs a role (user or assistant) and non-empty content.",
      400,
    );
  }

  const mode = payload.mode === "ui" ? "ui" : "text";
  const stream = payload.stream === true;

  if (stream) {
    if (mode !== "ui") {
      return fail('streaming is only supported for mode "ui".', 400);
    }

    const result = await callBackendStream("/api/chat", request, {
      messages,
      mode,
      stream: true,
    });

    if (!result.ok) {
      return fail(result.error, result.status);
    }

    return new Response(result.body, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
      },
    });
  }

  const result = await callBackend("/api/chat", request, {
    method: "POST",
    body: { messages, mode, stream: false },
    timeoutMs: CHAT_TIMEOUT_MS,
  });

  if (!result.ok) {
    return fail(result.error, result.status);
  }

  const rawReply = extractReply(result.data);
  if (!rawReply) {
    return fail("Sando returned an empty response.", 502);
  }

  return Response.json({
    reply: mode === "ui" ? rawReply : toPlainText(rawReply),
    mode,
  });
}
