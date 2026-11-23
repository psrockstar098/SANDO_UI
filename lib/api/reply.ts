/**
 * Reads the assistant text out of a backend chat payload.
 *
 * The Zig backend answers `{ response, dialect, choices }`; older or alternate
 * shapes use `reply`, `answer`, `content`, or `message`.
 */
export function extractReply(data: unknown): string | null {
  if (typeof data === "string") return data.trim() || null;
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, unknown>;
  for (const key of ["response", "reply", "answer", "content", "message"]) {
    const v = d[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const choices = d.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    const content = message?.content ?? first?.text;
    if (typeof content === "string" && content.trim()) return content.trim();
  }

  return null;
}
