/**
 * Removes a message and everything after it.
 *
 *   DELETE /api/session/messages { from_index }
 *   -> 200 { status, message }
 */

import { callBackend, fail, readJsonObject } from "@/lib/api/backend";

export async function DELETE(request: Request) {
  const body = await readJsonObject(request);
  if (!body.ok) return fail(body.error, 400);

  const fromIndex = body.value.from_index;
  if (
    typeof fromIndex !== "number" ||
    !Number.isInteger(fromIndex) ||
    fromIndex < 0
  ) {
    return fail("from_index must be a non-negative integer.", 400);
  }

  const result = await callBackend("/api/session/messages", request, {
    method: "DELETE",
    body: { from_index: fromIndex },
  });

  if (!result.ok) return fail(result.error, result.status);

  return Response.json({
    status: "success",
    message: "Messages removed from index downward",
  });
}
