/**
 * Server-side proxy for chat preferences.
 *
 *   PUT /api/user/dialect  { dialect, region }
 *   -> 200 { status, message }
 *
 * The backend stores these on the Keycloak user and uses them for every chat
 * request, so this is what actually changes how Sando talks back.
 */

import { callBackend, fail } from "@/lib/api/backend";

const MAX_LENGTH = 64;

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > MAX_LENGTH) return null;
  return text;
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("The request body must be valid JSON.", 400);
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const dialect = clean(payload.dialect);
  const region = clean(payload.region);

  if (!dialect || !region) {
    return fail("dialect and region must be non-empty strings.", 400);
  }

  const result = await callBackend("/api/user/dialect", request, {
    method: "PUT",
    body: { dialect, region },
  });

  if (!result.ok) return fail(result.error, result.status);

  return Response.json({
    status: "success",
    message: "Dialect and region updated",
  });
}
