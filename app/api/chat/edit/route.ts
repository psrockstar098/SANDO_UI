/**
 * Edits a message and regenerates from that point.
 *
 *   POST /api/chat/edit { index, content, collection?, top_k? }
 *   -> 200 { reply, mode: "text" }
 *
 * The backend removes the message at `index` and everything below it, then
 * answers `content` as the new user turn.
 */

import {
  CHAT_TIMEOUT_MS,
  callBackend,
  cleanString,
  fail,
  readJsonObject,
} from "@/lib/api/backend";
import { extractReply } from "@/lib/api/reply";
import { toPlainText } from "@/lib/format";

const MAX_CONTENT_LENGTH = 20_000;

function topK(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 50
  ) {
    return null;
  }
  return value;
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body.ok) return fail(body.error, 400);

  const index = body.value.index;
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0
  ) {
    return fail("index must be a non-negative integer.", 400);
  }

  const content = cleanString(body.value.content, MAX_CONTENT_LENGTH);
  if (!content) {
    return fail("content must be a non-empty string.", 400);
  }

  const collection =
    body.value.collection === undefined
      ? undefined
      : cleanString(body.value.collection, 64);
  if (collection === null) {
    return fail("collection must be a non-empty string.", 400);
  }

  const topKValue = topK(body.value.top_k);
  if (topKValue === null) {
    return fail("top_k must be an integer between 1 and 50.", 400);
  }

  const result = await callBackend("/api/chat/edit", request, {
    method: "POST",
    body: {
      index,
      content,
      ...(collection !== undefined && { collection }),
      ...(topKValue !== undefined && { top_k: topKValue }),
    },
    timeoutMs: CHAT_TIMEOUT_MS,
  });

  if (!result.ok) return fail(result.error, result.status);

  const rawReply = extractReply(result.data);
  if (!rawReply) {
    return fail("Sando returned an empty response.", 502);
  }

  return Response.json({ reply: toPlainText(rawReply), mode: "text" });
}
