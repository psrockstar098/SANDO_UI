/**
 * Restores a memory snapshot exported by /api/session/export.
 *
 *   POST /api/session/import { persona?, human?, history? }
 *   -> 200 { status, message }
 */

import {
  callBackend,
  fail,
  optionalString,
  readJsonObject,
} from "@/lib/api/backend";

const MAX_MEMORY_LENGTH = 20_000;
const MAX_HISTORY = 5_000;

type Turn = { role: "user" | "assistant"; content: string };

function isTurn(value: unknown): value is Turn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Record<string, unknown>;
  return (
    (turn.role === "user" || turn.role === "assistant") &&
    typeof turn.content === "string"
  );
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body.ok) return fail(body.error, 400);

  const persona = optionalString(body.value.persona, MAX_MEMORY_LENGTH);
  const human = optionalString(body.value.human, MAX_MEMORY_LENGTH);
  if (persona === null || human === null) {
    return fail("persona and human must be strings.", 400);
  }

  const rawHistory = body.value.history;
  let history: Turn[] | undefined;
  if (rawHistory !== undefined) {
    if (
      !Array.isArray(rawHistory) ||
      rawHistory.length > MAX_HISTORY ||
      !rawHistory.every(isTurn)
    ) {
      return fail(
        "history must be an array of { role, content } messages.",
        400,
      );
    }
    history = rawHistory;
  }

  if (
    persona === undefined &&
    human === undefined &&
    history === undefined
  ) {
    return fail("Provide persona, human, or history.", 400);
  }

  const result = await callBackend("/api/session/import", request, {
    method: "POST",
    body: {
      ...(persona !== undefined && { persona }),
      ...(human !== undefined && { human }),
      ...(history !== undefined && { history }),
    },
  });

  if (!result.ok) return fail(result.error, result.status);

  return Response.json({
    status: "success",
    message: "Session memory restored",
  });
}
