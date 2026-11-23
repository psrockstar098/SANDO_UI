/**
 * Pins an explicit fact to the user's core memory.
 *
 *   POST /api/session/remember { fact }
 *   -> 200 { status, message }
 */

import {
  callBackend,
  cleanString,
  fail,
  readJsonObject,
} from "@/lib/api/backend";

const MAX_FACT_LENGTH = 4_000;

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body.ok) return fail(body.error, 400);

  const fact = cleanString(body.value.fact, MAX_FACT_LENGTH);
  if (!fact) {
    return fail("fact must be a non-empty string.", 400);
  }

  const result = await callBackend("/api/session/remember", request, {
    method: "POST",
    body: { fact },
  });

  if (!result.ok) return fail(result.error, result.status);

  return Response.json({
    status: "remembered",
    message: "Fact appended to Core Memory",
  });
}
