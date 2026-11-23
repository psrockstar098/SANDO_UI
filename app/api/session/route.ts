/**
 * Wipes the whole session, including core memory.
 *
 *   DELETE /api/session
 *   -> 200 { status, message }
 *
 * Unlike `DELETE /api/session/history`, this also removes the persona and human
 * memory blocks. There is no undo.
 */

import { callBackend, fail } from "@/lib/api/backend";

export async function DELETE(request: Request) {
  const result = await callBackend("/api/session", request, {
    method: "DELETE",
  });

  if (!result.ok) return fail(result.error, result.status);

  return Response.json({
    status: "success",
    message: "Session wiped completely",
  });
}
