/**
 * Server-side proxy for chat.
 *
 *   POST /api/chat  { messages: [{ role, content }] }
 *   -> 200 { reply: string }
 *   -> 4xx/5xx { error: string }
 *
 * The backend answers with `{ response, dialect, choices }`; the UI only needs
 * the text, so it is flattened to `{ reply }` here.
 */

import { CHAT_TIMEOUT_MS, callBackend, fail } from "@/lib/api/backend";
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

  const result = await callBackend("/api/chat", request, {
    method: "POST",
    body: { messages, stream: false },
    timeoutMs: CHAT_TIMEOUT_MS,
  });

  if (!result.ok) {
    return fail(result.error, result.status);
  }

  const rawReply = extractReply(result.data);
  if (!rawReply) {
    return fail("Sando returned an empty response.", 502);
  }

  return Response.json({ reply: toPlainText(rawReply) });
}
