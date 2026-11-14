/**
 * Server-side proxy for the signed-in user's profile.
 *
 *   GET    /api/user  -> 200 { id, name, username, email, dialect, region }
 *   DELETE /api/user  -> 200 { status, message }
 *
 * Identity comes from the bearer token the backend validates; nothing is
 * trusted from the browser.
 */

import { callBackend, fail } from "@/lib/api/backend";

export async function GET(request: Request) {
  const result = await callBackend("/api/user", request, { method: "GET" });

  if (!result.ok) return fail(result.error, result.status);

  const data = (result.data ?? {}) as Record<string, unknown>;
  if (typeof data.id !== "string" || !data.id) {
    return fail("Sando returned an unexpected profile.", 502);
  }

  return Response.json({
    id: data.id,
    name: typeof data.name === "string" ? data.name : "",
    username: typeof data.username === "string" ? data.username : "",
    email: typeof data.email === "string" ? data.email : "",
    dialect: typeof data.dialect === "string" ? data.dialect : "koloqua",
    region: typeof data.region === "string" ? data.region : "Liberia",
  });
}

export async function DELETE(request: Request) {
  const result = await callBackend("/api/user", request, { method: "DELETE" });

  if (!result.ok) return fail(result.error, result.status);

  return Response.json({ status: "success", message: "User account deleted" });
}
