/**
 * Server-side proxy for chat.
 *
 *   POST /api/chat  { messages: [{ role, content }], mode?: "text" | "ui", stream?: boolean }
 *   -> 200 { reply: string, mode: "text" | "ui" }
 *   -> 200 (streaming, ui mode only) application/x-ndjson frames
 *   -> 4xx/5xx { error: string }
 *
 * The backend answers with `{ response, dialect, choices }`; the UI only needs
 * the text, so it is flattened to `{ reply }` here. In ui mode the reply is
 * the A2UI wire log and is passed through untouched — never plain-texted.
 */

import { CHAT_TIMEOUT_MS, callBackend, callBackendStream, fail } from "@/lib/api/backend";
import { extractReply } from "@/lib/api/reply";
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
  const stream = payload.stream === true && mode === "ui";

  if (stream) {
    const upstream = await callBackendStream(
      "/api/chat",
      request,
      { messages, mode, stream: true },
      CHAT_TIMEOUT_MS,
    );
    if (!upstream.ok) {
      return fail(upstream.error, upstream.status);
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
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

  // Ui mode returns the wire log as-is, so the client can restore the
  // interactive components exactly. Never convert it to plain text.
  if (mode === "ui") {
    return Response.json({ reply: rawReply, mode: "ui" });
  }

  return Response.json({ reply: toPlainText(rawReply), mode: "text" });
}
