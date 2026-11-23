/**
 * Starts a new chat: clears the transcript but keeps core memory.
 *
 *   DELETE /api/session/history
 *   -> 200 { status, message }
 */

import { callBackend, fail } from "@/lib/api/backend";

export async function DELETE(request: Request) {
  const result = await callBackend("/api/session/history", request, {
    method: "DELETE",
  });

  if (!result.ok) return fail(result.error, result.status);

  return Response.json({
    status: "success",
    message: "Conversation history cleared",
  });
}
