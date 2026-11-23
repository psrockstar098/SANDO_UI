/**
 * Changes the signed-in user's language / dialect.
 *
 *   PUT /api/user/language { language }
 *   -> 200 { status, language, county }
 *
 * `language` is the collection name the backend uses (`vai`, `gio`, `koloqua`,
 * …), not the display label.
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

  const language = cleanString(body.value.language, 64);
  if (!language) {
    return fail("language must be a non-empty string.", 400);
  }

  const result = await callBackend("/api/user/language", request, {
    method: "PUT",
    body: { language },
  });

  if (!result.ok) return fail(result.error, result.status);

  const data = (result.data ?? {}) as Record<string, unknown>;
  const county =
    typeof data.county === "string" && data.county ? data.county : undefined;

  return Response.json({
    status: "success",
    language: typeof data.language === "string" ? data.language : language,
    ...(county && { county }),
  });
}
