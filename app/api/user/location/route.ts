/**
 * Changes the signed-in user's county.
 *
 *   PUT /api/user/location { county }
 *   -> 200 { status, county, dialect }
 *
 * The backend stores this on the Keycloak user and mirrors it into core memory,
 * so it changes how Sando answers.
 */

import {
  callBackend,
  cleanString,
  fail,
  readJsonObject,
} from "@/lib/api/backend";

export async function PUT(request: Request) {
  const body = await readJsonObject(request);
  if (!body.ok) return fail(body.error, 400);

  const county = cleanString(body.value.county, 64);
  if (!county) {
    return fail("county must be a non-empty string.", 400);
  }

  const result = await callBackend("/api/user/location", request, {
    method: "PUT",
    body: { county },
  });

  if (!result.ok) return fail(result.error, result.status);

  const data = (result.data ?? {}) as Record<string, unknown>;
  const dialect =
    typeof data.dialect === "string" && data.dialect ? data.dialect : undefined;

  return Response.json({
    status: "success",
    county: typeof data.county === "string" ? data.county : county,
    ...(dialect && { dialect }),
  });
}
