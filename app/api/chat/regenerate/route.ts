/**
 * Regenerates the last assistant reply.
 *
 *   POST /api/chat/regenerate { collection?, top_k? }
 *   -> 200 { reply, mode: "text" }
 *
 * The backend drops the last turn and answers the same user query again with
 * the cache bypassed.
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
  const body = await readJsonObject(request, { allowEmpty: true });
  if (!body.ok) return fail(body.error, 400);

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

  const result = await callBackend("/api/chat/regenerate", request, {
    method: "POST",
    body: {
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
