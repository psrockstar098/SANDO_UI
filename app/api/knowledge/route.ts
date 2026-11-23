/**
 * Teaches Sando a new dialect entry.
 *
 *   POST /api/knowledge { collection, id, input, response, ... }
 *   -> 201 { status, message }
 *
 * The backend embeds the entry and upserts it into Qdrant.
 */

import {
  callBackend,
  cleanString,
  fail,
  optionalString,
  readJsonObject,
} from "@/lib/api/backend";

const MAX_TEXT_LENGTH = 20_000;

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body.ok) return fail(body.error, 400);

  const collection = cleanString(body.value.collection, 64);
  const id = cleanString(body.value.id, 128);
  const input = cleanString(body.value.input, MAX_TEXT_LENGTH);
  const response = cleanString(body.value.response, MAX_TEXT_LENGTH);

  if (!collection || !id || !input || !response) {
    return fail(
      "collection, id, input, and response must be non-empty strings.",
      400,
    );
  }

  const types = optionalString(body.value.types, 64);
  const region = optionalString(body.value.region, 64);
  const register = optionalString(body.value.register, 64);
  const standardEnglish = optionalString(
    body.value.standard_english,
    MAX_TEXT_LENGTH,
  );
  const notes = optionalString(body.value.notes, MAX_TEXT_LENGTH);

  if (
    types === null ||
    region === null ||
    register === null ||
    standardEnglish === null ||
    notes === null
  ) {
    return fail("Optional knowledge fields must be strings.", 400);
  }

  const result = await callBackend("/api/knowledge", request, {
    method: "POST",
    body: {
      collection,
      id,
      input,
      response,
      ...(types !== undefined && { types }),
      ...(region !== undefined && { region }),
      ...(register !== undefined && { register }),
      ...(standardEnglish !== undefined && {
        standard_english: standardEnglish,
      }),
      ...(notes !== undefined && { notes }),
    },
  });

  if (!result.ok) return fail(result.error, result.status);

  return Response.json(
    { status: "created", message: "Knowledge indexed into Qdrant" },
    { status: 201 },
  );
}
