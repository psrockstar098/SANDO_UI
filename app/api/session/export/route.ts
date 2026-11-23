/**
 * Downloads the user's full memory snapshot.
 *
 *   GET /api/session/export
 *   -> 200 { persona, human, history, ... } as a JSON attachment
 */

import { callBackend, fail } from "@/lib/api/backend";

export async function GET(request: Request) {
  const result = await callBackend("/api/session/export", request, {
    method: "GET",
  });

  if (!result.ok) return fail(result.error, result.status);

  if (
    !result.data ||
    typeof result.data !== "object" ||
    Array.isArray(result.data)
  ) {
    return fail("Sando returned an unexpected memory snapshot.", 502);
  }

  return Response.json(result.data, {
    headers: {
      "Content-Disposition": 'attachment; filename="sando-memory.json"',
      "Cache-Control": "no-store",
    },
  });
}
