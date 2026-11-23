/**
 * Edits the session's system persona and human memory block.
 *
 *   PUT /api/session/prompt { persona?, human? }
 *   -> 200 { status, message }
 *
 * Both fields are optional, but at least one must be present. An empty string
 * clears that block.
 */

import {
  callBackend,
  fail,
  optionalString,
  readJsonObject,
} from "@/lib/api/backend";

const MAX_MEMORY_LENGTH = 20_000;

export async function PUT(request: Request) {
  const body = await readJsonObject(request);
  if (!body.ok) return fail(body.error, 400);

  const persona = optionalString(body.value.persona, MAX_MEMORY_LENGTH);
  const human = optionalString(body.value.human, MAX_MEMORY_LENGTH);

  if (persona === null || human === null) {
    return fail("persona and human must be strings.", 400);
  }
  if (persona === undefined && human === undefined) {
    return fail("Provide persona, human, or both.", 400);
  }

  const result = await callBackend("/api/session/prompt", request, {
    method: "PUT",
    body: {
      ...(persona !== undefined && { persona }),
      ...(human !== undefined && { human }),
    },
  });

  if (!result.ok) return fail(result.error, result.status);

  return Response.json({
    status: "success",
    message: "Session prompt and memory saved",
  });
}
