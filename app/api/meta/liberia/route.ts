/**
 * Public metadata for Liberia.
 *
 *   GET /api/meta/liberia
 *   -> 200 { counties: string[], languages: string[] }
 *
 * This is the only route that does not require a bearer token: the sign-up and
 * settings forms need the county and language lists before the user signs in.
 */

import { callBackend, fail } from "@/lib/api/backend";

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

export async function GET(request: Request) {
  const result = await callBackend("/api/meta/liberia", request, {
    method: "GET",
  });

  if (!result.ok) return fail(result.error, result.status);

  const data = (result.data ?? {}) as Record<string, unknown>;
  const counties = strings(data.counties);
  const languages = strings(data.languages);

  if (counties.length === 0 || languages.length === 0) {
    return fail("Sando returned unexpected Liberia metadata.", 502);
  }

  return Response.json({ counties, languages });
}
