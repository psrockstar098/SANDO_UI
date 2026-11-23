# Sando Intelligent UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sando's plain-text answer bubbles with A2UI intelligent answers that stream and render as interactive UI, without changing the existing app shell, authentication, or black-and-white design.

**Architecture:** The browser keeps talking to Next route handlers, which forward the Keycloak bearer token to the Zig backend. The Zig backend gains a `mode: "ui"` that appends the generated A2UI catalog and wire-format instructions to Sando's existing system prompt, and a streaming path that emits base64-framed NDJSON deltas, one complete A2UI v1.0 message per frame. The Next `/api/chat` route proxies those frames unchanged. On the client, a small `A2UIAnswer` component renders the returned messages with `A2uiSurface` from `@a2ui/react` and a `MessageProcessor` from `@a2ui/web_core` fed only the Sando catalog, while user messages, legacy assistant messages, and errors keep the current plain-text bubbles.

**Tech Stack:** Next.js 16.4.4 (App Router, cacheComponents), React 19.3, TypeScript 5, Tailwind CSS 4, `@a2ui/react@0.15.0`, `@a2ui/web_core@0.15.0`, `zod@3.25.76`, Zig 0.17 backend (`std.http.Server`, `std.http.Client`).

**Spec:** `docs/superpowers/specs/2026-11-14-sando-intelligent-ui.md`
**Contract doc:** `docs/a2ui.md`

**Status (2026-11-23, A2UI swap):** Tasks 1, 3, 4, 6, 7 (Next-side parts), and 8 are implemented in this repo. Tasks 2 and 5 — the Zig backend `mode: "ui"` emission and streaming — are still open and live on Dominic's laptop in `/home/psrockstar/Documents/code/sando`. Live checks needing the backend + Keycloak cannot run on this VM.

## Global Constraints

- Every request except `GET /health` and `OPTIONS` requires a Keycloak bearer token. The browser sends it only to Next; Next forwards it server-side.
- No new color tokens. A2UI components are implemented with monochrome Tailwind classes only: `black`, `white`, `neutral-*`, `transparent`, `currentColor`. Never import basic-catalog styles (`injectBasicCatalogStyles`); there is no theme generator.
- Assistant display names never use an email address. Use `getDisplayName()` from `lib/format.ts`.
- `toPlainText()` is applied to `mode: "text"` replies only. Never to the A2UI wire log.
- Conversations stay in `localStorage` under `sando:conversations:v1`. Old stored messages must keep working without migration.
- Backend: `127.0.0.1:22323`. UI dev server: `http://localhost:3000`.
- A2UI packages are pinned exactly: `@a2ui/react@0.15.0`, `@a2ui/web_core@0.15.0`, `zod@3.25.76`. Do not use `^`.
- No `export const dynamic` or `export const runtime` in route files; `cacheComponents` rejects them. `maxDuration` is allowed but not needed here.
- The generated catalog JSON is committed. Do not generate it during `next build`.
- The React renderer is the only renderer. Never import `@a2ui/lit` as a renderer.

## Review Focus

- **Model returns prose instead of A2UI messages.** The user must see the prose answer, not a blank box or a parser error. `A2UIAnswer` falls back to plain text when the wire log has no renderable surface, and `ChatView` stores prose as `kind: "text"`.
- **Model returns a partial message during streaming.** Each frame is one complete message, so the renderer only ever sees whole messages; it shows what is valid so far and finishes in place, without remounting the conversation or losing scroll position.
- **A component emits `openUrl` with a `javascript:` or `data:` URL.** Only `http:` and `https:` open, in a new tab with `noopener,noreferrer`. Everything else is ignored.
- **A user submits an in-answer form, then reloads.** The form state must survive because it is persisted on the stored assistant message (`uiState`), not held only in React state.
- **Upstream fails before or during the stream.** Before headers, the route returns the normal JSON error shape. After headers, the client shows the partial answer plus an inline error and never leaves the composer stuck in `loading`.
- **A surface module is imported during SSR.** `@a2ui/react` hosts implementations as custom elements, which need a DOM. `A2UIAnswer` is always loaded with `next/dynamic(..., { ssr: false })`; importing it statically breaks the prerender with `ReferenceError: HTMLElement is not defined`.

---

## File Map

**Create**

- `scripts/generate-a2ui-catalog.mjs` — builds the Sando catalog JSON from the basic catalog's component/function shapes.
- `lib/chat/catalog.json` — generated Sando catalog (committed).
- `components/chat/A2UIAnswer.tsx` — the only component that imports the A2UI renderer.
- `lib/chat/a2ui.ts` — pure helpers: URL sanitizing, wire-message parsing, NDJSON frame decoding, catalog loading.
- `docs/a2ui.md` — the contract doc (replaces the old `docs/openui.md`).

**Modify**

- `package.json` — add the two A2UI packages and `zod`, plus the catalog script.
- `lib/chat/store.ts` — add optional `kind` and `uiState` to `StoredMessage`.
- `app/chat/ChatView.tsx` — render A2UI answers, keep a live streaming draft, add pre-stream error handling.
- `lib/api/api.ts` — add `mode` to `sendPrompt`, add `streamPrompt`.
- `lib/api/backend.ts` — add `callBackendStream`.
- `app/api/chat/route.ts` — pass `mode`, stream NDJSON, skip `toPlainText` for `ui`.
- `AGENTS.md` — the monochrome rule, with A2UI wording.
- Zig `/home/psrockstar/Documents/code/sando/src/server.zig` — `mode`, `format`, streaming response.
- Zig `/home/psrockstar/Documents/code/sando/src/connnector/glue.zig` — `ui_mode`, `on_token_sink`, UI prompt override, cache key.
- Zig `/home/psrockstar/Documents/code/sando/src/ai/ai.zig` — `TokenSink`, `chatStreaming`, incremental SSE parse.

**Generated / committed**

- `lib/chat/catalog.json`.
- Zig `/home/psrockstar/Documents/code/sando/src/connnector/a2ui_spec.zig`.

---

## Task 1: Install A2UI and Build the Sando Catalog

**Status:** Done in the A2UI swap.

**Files:**
- Modify: `package.json`
- Create: `scripts/generate-a2ui-catalog.mjs`
- Create: `lib/chat/catalog.json` (generated)
- Create: `lib/chat/a2ui.ts`

**Interfaces:**
- Produces: `lib/chat/catalog.json` with id `https://sando.app/catalogs/chat/v1/catalog.json`, protocolVersion `1.0`, 9 components (Text, Button, Card, Column, Row, List, Divider, TextField, ChoicePicker) and 14 functions.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Install the pinned packages**

Run:

```bash
bun add --exact @a2ui/react@0.15.0 @a2ui/web_core@0.15.0 zod@3.25.76
```

Expected: `package.json` lists the three packages with exact versions under dependencies. `bun.lock` updates.

- [ ] **Step 2: Write the catalog generator**

Create `scripts/generate-a2ui-catalog.mjs`. It must:

1. Import `basicCatalog` from `@a2ui/web_core/catalogs/basic/v1`.
2. Derive the Sando catalog with `basicCatalog.derive({ catalogId: "https://sando.app/catalogs/chat/v1/catalog.json", components: ["Text", "Button", "Card", "Column", "Row", "List", "Divider", "TextField", "ChoicePicker"], functions: [the 14 basic functions] })`.
3. Write the derived catalog's JSON to `lib/chat/catalog.json`.
4. Print the component and function counts.

The derived catalog carries the component/function shapes only; Sando implements the components itself in `A2UIAnswer.tsx`, so no basic-catalog styling is ever loaded.

- [ ] **Step 3: Run the generator and prove the output**

Run:

```bash
node scripts/generate-a2ui-catalog.mjs
node -e '
const c = require("./lib/chat/catalog.json");
console.log(c.id, c.protocolVersion, Object.keys(c.components).length, Object.keys(c.functions).length);
'
```

Expected: id `https://sando.app/catalogs/chat/v1/catalog.json`, protocolVersion `1.0`, 9 components, 14 functions.

- [ ] **Step 4: Write the pure helpers**

Create `lib/chat/a2ui.ts` with these pure exports:

```ts
export type A2UIFrame = { d?: string; done?: true; error?: string };

/**
 * Parses one NDJSON line. Returns null for blank lines.
 * Throws for malformed JSON so the caller can surface a protocol error.
 */
export function parseA2UIFrame(line: string): A2UIFrame | null;

/** Decodes a base64 frame payload into bytes. */
export function decodeFrameBytes(base64: string): Uint8Array;

/** True for http(s) URLs only. */
export function isSafeUrl(url: string): boolean;

/** True when the value is a v1.0 A2UI agent-to-renderer message. */
export function isA2UIMessage(value: unknown): value is AgentToRendererMessage;

/** Parses one wire-log line; throws when it is not a v1.0 A2UI message. */
export function parseA2UIMessage(line: string): AgentToRendererMessage;

/** True when the wire log holds at least one A2UI message. */
export function looksLikeA2UI(content: string): boolean;

/** Splits a wire log into its messages, skipping blank/invalid lines. */
export function splitA2UIMessages(content: string): AgentToRendererMessage[];

/** Loads the Sando catalog from catalog.json. */
export function loadSandoCatalog(): Catalog;

/** The openUrl function implementation: rendererOnly, requires user activation, http/https only. */
export function createSandoOpenUrl(): FunctionImplementation;
```

- [ ] **Step 5: Verify the build still passes**

Run:

```bash
npx tsc --noEmit
npx next build
```

Expected: both exit 0.

---

## Task 2: Add `mode: "ui"` to the Zig Backend

**Status:** Open — lives on Dominic's laptop; not built yet.

**Files:**
- Create: `/home/psrockstar/Documents/code/sando/src/connnector/a2ui_spec.zig` (generated)
- Create: `/home/psrockstar/Documents/code/sando_frontend/sando_ui/scripts/generate-a2ui-prompt.mjs`
- Modify: `/home/psrockstar/Documents/code/sando/src/connnector/glue.zig`
- Modify: `/home/psrockstar/Documents/code/sando/src/server.zig`

**Interfaces:**
- Produces: `POST /api/chat` accepts `{ messages, mode?: "text" | "ui", stream?: bool }` and returns `{ response, format, dialect, source_count, is_cached, choices }` where `format` is `"text"` or `"a2ui"`.
- Produces: `RagOptions.ui_mode: bool = false`; `glue.ask` appends the A2UI spec when true.
- Consumes: the existing `glue.ask`, `:system_prompt_template`, and `UserSession` from the current backend.

- [ ] **Step 1: Write the prompt generator**

Create `scripts/generate-a2ui-prompt.mjs` in the UI repo. It must:

1. Read `lib/chat/catalog.json` and render it as the catalog section of the prompt.
2. Append the wire-format instructions: the reply is a sequence of A2UI v1.0 JSON messages, one object per line, each with `version: "1.0"` and one of `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`; `createSurface` carries `surfaceId`, `catalogId` `https://sando.app/catalogs/chat/v1/catalog.json`, and initial components + data model; one component must have `id: "root"`; data bindings use `{"@path": "..."}`; ChoicePicker selection is always an array, even in mutuallyExclusive mode.
3. Assert the result is longer than 2,000 characters and contains `a2ui`.
4. Render the Zig file:

```zig
// Generated by sando_ui/scripts/generate-a2ui-prompt.mjs. Do not edit by hand.
pub const spec =
    \\<each prompt line, prefixed with four spaces and two backslashes>
;
```

Every prompt line must be escaped for a Zig multiline string: prefix it with four spaces and `\\`, and double any literal backslash in the prompt. Braces do **not** need escaping, because the spec is passed to `std.fmt.allocPrint` as an `{s}` argument and is never itself used as a format string. The generator must reject any line that would end with a lone backslash. It must also convert a leading `\` in the prompt to `\\`.

5. Write to the path in `process.argv[2] ?? "../../sando/src/connnector/a2ui_spec.zig"`. Resolve it relative to `process.cwd()`.
6. Print `wrote <path> (<n> chars)`.

- [ ] **Step 2: Generate the spec and prove it compiles as Zig**

Run:

```bash
cd /home/psrockstar/Documents/code/sando_frontend/sando_ui
node scripts/generate-a2ui-prompt.mjs
head -3 ../../sando/src/connnector/a2ui_spec.zig
wc -c ../../sando/src/connnector/a2ui_spec.zig
cd ../../sando && zig build
```

Expected: `wrote /home/.../sando/src/connnector/a2ui_spec.zig (<n> chars)`, the head shows the generated header, and `zig build` exits 0. If `zig build` fails on the string, fix the escaping in the generator, not the generated file.

- [ ] **Step 3: Add `ui_mode` and the prompt override in `glue.zig`**

Add `@import("a2ui_spec.zig")` as `a2ui_spec` at the top of `glue.zig`.

Add to `RagOptions`:

```zig
/// Render the answer as A2UI v1.0 messages instead of plain text.
ui_mode: bool = false,
```

Add this constant above `system_prompt_template`:

```zig
const ui_output_override =
    \\OUTPUT FORMAT OVERRIDE (takes precedence over section 13)
    \\Your reply is rendered by A2UI, not as a chat bubble. Respond with
    \\A2UI v1.0 messages and nothing else: one JSON object per line, each
    \\with "version": "1.0" and one of createSurface, updateComponents,
    \\updateDataModel, deleteSurface. The first message must be a
    \\createSurface with a "root" component. Do not wrap the reply in
    \\markdown fences. Do not write prose before or after the messages.
    \\Use Text for short answers and the richer components when the answer
    \\benefits from them. Do not emit <<<MEMORY_UPDATE>>> tags in this
    \\mode; they would appear in the rendered answer.
    \\
    \\A2UI CATALOG AND WIRE FORMAT
    \\{s}
;
```

In `ask`, replace the single `system_prompt` expression with:

```zig
const base_prompt = try std.fmt.allocPrint(alloc, system_prompt_template, .{
    memory_block,
    if (kb_context.len > 0) kb_context else "No relevant knowledge-base entries were retrieved. Do not pretend that missing evidence exists.",
});

const system_prompt = if (options.ui_mode) blk: {
    const override = try std.fmt.allocPrint(alloc, ui_output_override, .{a2ui_spec.spec});
    break :blk try std.fmt.allocPrint(alloc, "{s}\n\n{s}", .{ base_prompt, override });
} else base_prompt;
```

Then include the mode in the cache key:

```zig
const cache_key = try std.fmt.allocPrint(alloc, "{s}\x1f{s}\x1f{s}\x1f{s}", .{
    if (options.ui_mode) "ui" else "text",
    user_id,
    options.collection orelse dialect,
    user_query,
});
```

- [ ] **Step 4: Read `mode` and report `format` in `server.zig`**

Extend `ChatRequest`:

```zig
mode: ?[]const u8 = null,
```

Define `const wants_ui = parsed.mode != null and std.mem.eql(u8, parsed.mode.?, "ui");` and add `.ui_mode = wants_ui` to the `RagOptions` literal.

Add `format: []const u8` to `ChatResponsePayload` and set it:

```zig
.format = if (wants_ui) "a2ui" else "text",
```

- [ ] **Step 5: Verify the backend serves both modes**

Build and restart the backend, then run with a valid token. Get the token from a signed-in browser session: open DevTools → Network, send one chat message, find the response from Keycloak's `token` endpoint, and copy `access_token` from the JSON. Store it with `printf %s "$TOKEN" > /tmp/opencode/sando-token`. The file must contain only the token.

```bash
cd /home/psrockstar/Documents/code/sando && zig build
TOKEN="$(cat /tmp/opencode/sando-token 2>/dev/null)"
curl -sS -X POST http://127.0.0.1:22323/api/chat \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say hello in Koloqua"}],"mode":"text"}' | jq '{format, first: (.response[0:40])}'
curl -sS -X POST http://127.0.0.1:22323/api/chat \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Show me a short greeting card in Koloqua"}],"mode":"ui"}' | jq '{format, first: (.response[0:200])}'
```

Expected: the text request reports `format: "text"` and plain prose; the UI request reports `format: "a2ui"` and the response starts with a `createSurface` message. If the model returns prose for the UI request, tighten the override wording and repeat. This is the model-quality gate.

- [ ] **Step 6: Commit the UI-side generator; record the backend change**

The backend is not a git repository. Commit the generator in the UI repo:

```bash
cd /home/psrockstar/Documents/code/sando_frontend/sando_ui
git add scripts/generate-a2ui-prompt.mjs
git commit -m "feat(a2ui): generate the A2UI system prompt for the backend"
```

Note in the handoff that `glue.zig`, `server.zig`, and `a2ui_spec.zig` are changed outside git and must be kept with the backend deployment.

---

## Task 3: Add `mode` to the Next Chat Proxy and API Client

**Status:** Done in the A2UI swap.

**Files:**
- Modify: `lib/api/backend.ts`
- Modify: `lib/api/api.ts`
- Modify: `app/api/chat/route.ts`

**Interfaces:**
- Produces: `callBackendStream(path, request, body, timeoutMs?) => Promise<BackendStreamResult>`.
- Produces: `sendPrompt({ ..., mode }) => Promise<ChatResponse>` with `ChatResponse.mode`.
- Produces: `streamPrompt({ ..., onMessage }) => Promise<StreamChatResponse>` reading base64 NDJSON frames, one complete A2UI message per frame.
- Produces: `POST /api/chat` accepts `mode` and returns `{ reply, mode }`; with `stream: true` and `mode: "ui"` it returns `content-type: application/x-ndjson`.

- [ ] **Step 1: Add the streaming backend helper**

In `lib/api/backend.ts`:

```ts
export type BackendStreamResult =
  | { ok: true; body: ReadableStream<Uint8Array> }
  | { ok: false; status: number; error: string };

export async function callBackendStream(
  path: string,
  request: Request,
  body: unknown,
  timeoutMs = CHAT_TIMEOUT_MS,
): Promise<BackendStreamResult>;
```

Implementation notes:
- Forward the caller's `Authorization` header exactly as `callBackend` does.
- Start a timer that aborts the `fetch` if headers do not arrive in `timeoutMs`; clear it once `fetch` resolves, because aborting after headers would kill the stream.
- `cache: "no-store"`.
- On non-OK, read the JSON body and reuse `errorMessage`, mapping 4xx through and everything else to 502.
- On network failure, return the same 502 message as `callBackend`.

- [ ] **Step 2: Update the route for `mode` and streaming**

In `app/api/chat/route.ts`:
- Parse `mode` as `payload.mode === "ui" ? "ui" : "text"`.
- Parse `stream` as `payload.stream === true && mode === "ui"` (streaming is only for ui mode; a text-mode request with `stream: true` answers non-streaming).
- Non-streaming: forward `{ messages, mode, stream: false }`, then return `{ reply: mode === "ui" ? rawReply : toPlainText(rawReply), mode }`. The ui reply is the wire log, passed through untouched.
- Streaming: forward `{ messages, mode, stream: true }` through `callBackendStream`. On success, return a `Response` whose body is the upstream `ReadableStream`, headers:

```ts
{
  "content-type": "application/x-ndjson; charset=utf-8",
  "cache-control": "no-store",
  "x-accel-buffering": "no",
}
```

- On failure, return `fail(result.error, result.status)` before any stream starts.

- [ ] **Step 3: Add `mode` to `sendPrompt`**

Change `SendPromptParams` to include `mode?: "text" | "ui"`, default `"text"`. Change `ChatResponse` to `{ reply: string; mode: "text" | "ui" }`. Send `{ messages, mode, stream: false }` and return the mode from the response (falling back to the requested mode).

- [ ] **Step 4: Add `streamPrompt` and the frame decoder**

`lib/chat/a2ui.ts` (Task 1) holds `parseA2UIFrame` and `decodeFrameBytes`. Add to `lib/api/api.ts`:

```ts
export interface StreamPromptParams extends SendPromptParams {
  mode: "ui";
  /** One complete A2UI wire message per call, in stream order. */
  onMessage: (message: AgentToRendererMessage) => void;
}
export interface StreamChatResponse { reply: string; mode: "ui" }
export async function streamPrompt(params: StreamPromptParams): Promise<StreamChatResponse>;
```

Implementation:
- `fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json", accept: "application/x-ndjson", Authorization } , body: JSON.stringify({ messages, mode: "ui", stream: true }), signal })`.
- If `!res.ok`, read JSON and throw `ApiError` exactly like `request()`.
- If `res.body` is null, throw `ApiError("The server did not return a stream.", 502)`.
- Create **one** `TextDecoder("utf-8")` for the wire bytes and **one** `TextDecoder("utf-8")` for frame payloads. Both are used with `{ stream: true }` so a codepoint split across frames survives.
- Read with `res.body.getReader()`, decode each wire chunk, split on `\n`, and keep the remainder between reads.
- For each frame: `error` → throw `ApiError` with the accumulated reply attached as `partial`; `d` → decode the base64 payload, `JSON.parse` it, validate with `isA2UIMessage` (a malformed or non-A2UI frame throws `ApiError` with `partial`), append `JSON.stringify(message)` to the reply, and pass the message to `onMessage`; `done` → stop.
- The caller's `signal` aborts the reader. A network failure after messages is thrown as `ApiError` with the partial reply attached as `(err as ApiError & { partial?: string }).partial`.

- [ ] **Step 5: Verify the proxy with a hand-written upstream check**

Run `npx tsc --noEmit`, then with the dev server running:

```bash
TOKEN="$(cat /tmp/opencode/sando-token 2>/dev/null)"
curl -sS -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say hello"}],"mode":"ui"}' | head -c 200
```

Expected: a JSON object containing `"mode":"ui"` and a `reply` holding the A2UI wire log (no `toPlainText` cleanup).

---

## Task 4: Render A2UI Answers in the Existing Chat

**Status:** Done in the A2UI swap.

**Files:**
- Create: `components/chat/A2UIAnswer.tsx`
- Modify: `lib/chat/store.ts`
- Modify: `app/chat/ChatView.tsx`

**Interfaces:**
- Produces: `A2UIAnswer` default export with:

```ts
interface A2UIAnswerProps {
  /** A2UI wire messages, one JSON object per line. */
  messages: string;
  isStreaming?: boolean;
  state?: Record<string, unknown>;
  onStateUpdate?: (state: Record<string, unknown>) => void;
  onFollowUp: (prompt: string) => void;
}
```

- Produces: `StoredMessage.kind?: "text" | "a2ui"` and `StoredMessage.uiState?: Record<string, unknown>`.
- Consumes: `streamPrompt({ mode: "ui" })` from Task 3.

- [ ] **Step 1: Extend the message schema without breaking old data**

In `lib/chat/store.ts`:

```ts
export type ChatKind = "text" | "a2ui";

export interface StoredMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  /** Absent means "text", so messages stored before A2UI still load. */
  kind?: ChatKind;
  /** A2UI data-model snapshot (form state), persisted with the message. */
  uiState?: Record<string, unknown>;
}
```

Extend `isMessage` to accept `kind` only when it is `"text"` or `"a2ui"`, and `uiState` only when it is a non-null object. Missing fields remain valid.

- [ ] **Step 2: Build the renderer component**

Create `components/chat/A2UIAnswer.tsx` with `"use client"` at the top.

Rules:
- Import `A2uiSurface`, `createComponentImplementation`, `useNodeView`, `useSignalValue` from `@a2ui/react`; `Catalog`, `MessageProcessor`, `createFunctionImplementation`, `BASIC_FUNCTIONS` from `@a2ui/web_core`; `basicCatalog` from `@a2ui/web_core/catalogs/basic/v1` only to derive the Sando catalog's shapes in the generator — the component itself loads the Sando catalog with `loadSandoCatalog()`.
- Build the `MessageProcessor` with ONLY the Sando catalog and `{ version: "1.0" }` (the default is v0.9). Never pass the basic catalog to the processor.
- Implement the 9 catalog components with monochrome Tailwind classes (Text, Button, Card, Column, Row, List, Divider, TextField, ChoicePicker). Use `createComponentImplementation`; resolve dynamic props through the generic binder (actions become callables, `ChildList` becomes ids, dynamic values come with `setX` setters).
- Replace the stock `openUrl` with Sando's own (`createSandoOpenUrl`): rendererOnly, requires user activation, `isSafeUrl` (http/https only) before `window.open(url, "_blank", "noopener,noreferrer")`.
- Action handling: an event with `userMessage` → `onFollowUp(userMessage)`; any other event → `onFollowUp` with the JSON envelope `{"a2ui_action": {"name", "context", "surfaceId", "sourceComponentId"}}`. A function call named `openUrl` is handled by the implementation itself. ChoicePicker reports selection as an array even in mutuallyExclusive mode — expect an array.
- Form state: subscribe to the data model at `/`; report every change through `onStateUpdate`. On first surface, restore a passed `state` with an `updateDataModel` at path `/`.
- Errors: `processMessagesWithErrors` returns hard errors. While streaming, a
  failed message is tolerated (a later message may fix the surface). Once
  streaming stops, a failed message renders the plain-text fallback:

```tsx
<pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
  {content}
</pre>
```

A stream that ends with no surface at all shows the raw log the same way,
derived during render — never a blank bubble. Content that parses as no A2UI
message at all is not an error — it renders as prose, never a blank bubble.
- Render inside `<div className="a2ui-answer min-w-0 text-sm">`.
- Do not import `@a2ui/lit` or any vendor chat shell.

- [ ] **Step 3: Render stored answers and follow-ups in `ChatView`**

In `app/chat/ChatView.tsx`:
- Replace the static import of the answer component with a client-only dynamic import so the A2UI custom elements never run during SSR:

```tsx
const A2UIAnswer = dynamic(() => import("@/components/chat/A2UIAnswer"), { ssr: false });
```

- Extend `Bubble` to accept `onFollowUp` and `onStateUpdate`:

```tsx
if (message.role === "assistant" && message.kind === "a2ui") {
  return (
    <A2UIAnswer
      content={message.content}
      state={message.uiState}
      onStateUpdate={(state) => onStateUpdate(message.id, state)}
      onFollowUp={onFollowUp}
    />
  );
}
```

- `onStateUpdate(id, state)` writes the updated message back with `saveConversation`, preserving all other fields.
- `onFollowUp(prompt)` calls `send(prompt)`.
- `send` streams in `mode: "ui"` (see Task 6). On success it stores:

```ts
const answer: Message = {
  id: crypto.randomUUID(),
  role: "assistant",
  content: reply,
  createdAt: Date.now(),
  kind: looksLikeA2UI(reply) ? "a2ui" : "text",
  uiState: draftState.current,
};
```

- If the UI-mode response holds no A2UI message (`looksLikeA2UI` fails), it is stored as `kind: "text"` and rendered as prose, so a model that ignores the prompt never produces an empty bubble.

- [ ] **Step 4: Verify end-to-end rendering**

Run:

```bash
npx tsc --noEmit
npx eslint .
npx next build
```

Then in the browser at `http://localhost:3000/chat`, send `Show me a short greeting card in Koloqua`.

Expected:
- The user bubble is unchanged.
- The assistant answer renders as an A2UI card/stack, not raw JSON.
- The sidebar still lists the conversation.
- Reloading the page restores the rendered answer.
- A response containing form inputs keeps its values after reload.

---

## Task 5: Stream A2UI Messages from the Zig Backend

**Status:** Open — lives on Dominic's laptop; not built yet.

**Files:**
- Modify: `/home/psrockstar/Documents/code/sando/src/ai/ai.zig`
- Modify: `/home/psrockstar/Documents/code/sando/src/connnector/glue.zig`
- Modify: `/home/psrockstar/Documents/code/sando/src/server.zig`

**Interfaces:**
- Produces: `ai.TokenSink` and `ai.chatStreaming(system_prompt, user_prompt, sink) ![]const u8`.
- Produces: `RagOptions.on_token_sink: ?ai.TokenSink = null`.
- Produces: `POST /api/chat` with `{ mode: "ui", stream: true }` responds `content-type: application/x-ndjson` and frames `{"d":"<base64>"}\n`, ending with `{"done":true}\n`. Each decoded `d` frame is exactly one complete A2UI v1.0 message.

- [ ] **Step 1: Add the token sink and incremental SSE reader**

In `ai.zig`:

```zig
pub const TokenSink = struct {
    ctx: *anyopaque,
    writeFn: *const fn (ctx: *anyopaque, token: []const u8) anyerror!void,

    pub fn write(self: TokenSink, token: []const u8) !void {
        return self.writeFn(self.ctx, token);
    }
};

/// Streams the model response and forwards each content delta to `sink`.
/// Tokens are forwarded as they arrive; the complete answer is returned.
pub fn chatStreaming(
    self: *AI,
    system_prompt: []const u8,
    user_prompt: []const u8,
    sink: TokenSink,
) ![]const u8;
```

`chatStreaming` builds the same JSON payload as `chat` with `stream = true`, then calls a new `postStreaming(payload_json, auth, sink)`. Do not wrap it in `postWithRetry`: once bytes have been forwarded to the sink, a retry would duplicate them. Move the existing `SseChunk` struct from inside `parseSseStream` to file scope so both parsers use the same shape.

`postStreaming`:
- `const uri = try std.Uri.parse(self.config.endpoint);`
- `self.http_client.request(.POST, uri, .{ .headers = .{ .content_type = .override = "application/json" }, .extra_headers = extra_headers })`, then immediately `defer req.deinit()`.
- `req.sendBodyComplete(@constCast(payload))`.
- `var redirect_buf: [8 * 1024]u8; var res = try req.receiveHead(&redirect_buf);` and map non-`.ok` statuses through the same switch as `postOnce`.
- `var transfer_buf: [16 * 1024]u8; var reader = res.reader(&transfer_buf);`
- Read with `reader.interface.readSliceShort(&chunk_buf)` in a loop until it returns 0.
- Accumulate bytes into an `std.ArrayList(u8)` line buffer; on each `\n`, trim ` \r`, ignore lines not starting with `data:`, stop on `[DONE]`, parse with `SseChunk`, append `delta.content` to the answer, and call `sink.write(chunk)`.
- If the answer is empty, return `error.EmptyResponse`.

- [ ] **Step 2: Route `glue.ask` through the streaming call**

Add `on_token_sink: ?ai_brian.TokenSink = null` to `RagOptions`.

Replace the `self.ai.chat(...)` call with:

```zig
const raw_reply = if (options.on_token_sink) |sink|
    try self.ai.chatStreaming(system_prompt, user_query, sink)
else
    try self.ai.chat(system_prompt, user_query, options.stream, options.on_token);
```

Cached answers must still reach the sink once. In the cache-hit branch, after `if (options.on_token) cb(cached)`, add `if (options.on_token_sink) |sink| try sink.write(cached)`.

- [ ] **Step 3: Write NDJSON frames from `server.zig`**

Add a `StreamCtx` in `server.zig`:

```zig
const StreamCtx = struct {
    body: *std.http.BodyWriter,

    fn write(ctx_ptr: *anyopaque, token: []const u8) anyerror!void {
        const self: *StreamCtx = @ptrCast(@alignCast(ctx_ptr));
        var out_buf: [4096]u8 = undefined;
        var i: usize = 0;
        while (i < token.len) {
            const end = @min(i + 2048, token.len);
            const chunk = token[i..end];
            const encoded_len = std.base64.standard.Encoder.calcSize(chunk.len);
            if (encoded_len + 16 > out_buf.len) return error.TokenTooLarge;
            const encoded = std.base64.standard.Encoder.encode(out_buf[0..encoded_len], chunk);
            try self.body.writer.writeAll("{\"d\":\"");
            try self.body.writer.writeAll(encoded);
            try self.body.writer.writeAll("\"}\n");
            i = end;
        }
        try self.body.flush();
    }
};
```

In the `/api/chat` handler, before calling `glue.ask`:

```zig
const wants_stream = parsed.stream and wants_ui;
```

Define the NDJSON headers:

```zig
const ndjson_headers = [_]std.http.Header{
    .{ .name = "content-type", .value = "application/x-ndjson; charset=utf-8" },
    .{ .name = "cache-control", .value = "no-store" },
    .{ .name = "access-control-allow-origin", .value = "http://localhost:3000" },
};
```

When `wants_stream`:
- `var stream_buf: [32 * 1024]u8 = undefined;`
- `var body = try req.respondStreaming(&stream_buf, .{ .respond_options = .{ .status = .ok, .keep_alive = false, .extra_headers = &ndjson_headers } });`
- `var ctx = StreamCtx{ .body = &body };`
- Call `glue.ask(user_query, .{ ..., .stream = true, .ui_mode = true, .on_token_sink = .{ .ctx = &ctx, .writeFn = StreamCtx.write } })`.
- On success write `{"done":true}\n` and `try body.end()`.
- On failure write the fixed frame `{"error":"AI generation failed"}\n` and `try body.end()`. Log the real error with `log.err`. Never call `sendError` after headers.

When `wants_stream` is false, keep the existing JSON path unchanged.

**Framing note:** the model emits A2UI messages as lines; `glue.ask` must forward whole lines to the sink (buffer deltas until `\n`), because the client treats each decoded `d` frame as one complete message. A frame that splits a message mid-object fails validation on the client.

- [ ] **Step 4: Verify the stream with curl**

Build and restart the backend, then:

```bash
cd /home/psrockstar/Documents/code/sando && zig build
TOKEN="$(cat /tmp/opencode/sando-token 2>/dev/null)"
curl -sS -N -X POST http://127.0.0.1:22323/api/chat \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Show a short greeting card in Koloqua"}],"mode":"ui","stream":true}' \
  | head -8
```

Expected: several `{"d":"..."}` lines arrive before the process exits, then `{"done":true}`. Decoding a few frames should produce complete A2UI v1.0 messages, the first a `createSurface`. If all frames arrive at once, confirm `postStreaming` reads with `readSliceShort` rather than buffering the whole body first.

- [ ] **Step 5: Record the backend change**

The backend is not a git repository. Keep `ai.zig`, `glue.zig`, `server.zig`, and `a2ui_spec.zig` together, rebuild, and restart before the frontend streaming task.

---

## Task 6: Stream A2UI Answers into the Chat

**Status:** Done in the A2UI swap.

**Files:**
- Modify: `app/api/chat/route.ts` (already supports streaming from Task 3; verify no change is needed)
- Modify: `lib/api/api.ts` (already has `streamPrompt` from Task 3)
- Modify: `app/chat/ChatView.tsx`

**Interfaces:**
- Consumes: `streamPrompt({ mode: "ui", onMessage })`.
- Produces: a live draft rendered with `A2UIAnswer` and persisted on completion or error (not on user abort).

- [ ] **Step 1: Add the live draft state**

In `Chat`, add:

```tsx
const [draft, setDraft] = useState<string | null>(null);
/** Latest form state of the streaming reply, attached when it is saved. */
const draftState = useRef<Record<string, unknown> | undefined>(undefined);
```

`draft` is the wire log growing with every message. Do not write partial drafts to `localStorage` on every message; write once when the stream ends or fails after at least one message.

- [ ] **Step 2: Replace the non-streaming call with `streamPrompt`**

In `send`:
- `setDraft("")` and `draftState.current = undefined` when the send starts.
- Call:

```ts
let log = "";
const { reply } = await streamPrompt({
  prompt: content,
  history,
  token,
  mode: "ui",
  signal: controller.signal,
  onMessage: (message) => {
    log += `${JSON.stringify(message)}\n`;
    setDraft(log);
  },
});
```

- On success, save the final answer with `kind: looksLikeA2UI(reply) ? "a2ui" : "text"` and `uiState: draftState.current`; then `setDraft(null)`.
- On abort, discard the draft and save nothing; then `setDraft(null)`.
- On error, if a partial reply was attached to the error, save it (with the same `kind` rule) and show the error text below it; otherwise show the error as today.
- Always `setDraft(null)` and `draftState.current = undefined` in `finally`.
- If the view unmounts mid-stream (for example the user opens another conversation), the async callback still writes the final answer to the store. The live draft is component state and is intentionally not preserved; this matches the current typing indicator.

- [ ] **Step 3: Render the draft**

After the stored messages, before the typing bubble:

```tsx
{draft !== null && draft.length > 0 ? (
  looksLikeA2UI(draft) ? (
    <A2UIAnswer
      content={draft}
      isStreaming
      onStateUpdate={(state) => { draftState.current = state; }}
      onFollowUp={send}
    />
  ) : (
    <div className="flex justify-start">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5 text-sm leading-relaxed text-neutral-100 md:max-w-[70%]">
        {toPlainText(draft)}
      </div>
    </div>
  )
) : (
  loading && <TypingBubble />
)}
```

`looksLikeA2UI` keeps early prose visible as a text bubble while the first message is still arriving, then hands over to the renderer as soon as a message parses. Keep the typing bubble only while `loading && !draft`. Scroll-follow should depend on `draft` too, so the view follows the growing answer.

- [ ] **Step 4: Guard the renderer against partial surfaces**

`A2UIAnswer` must not unmount the rendered tree between messages. Pass the full accumulated log every time and let the processor apply messages in order. A failed message while streaming is tolerated; once streaming stops it falls back to the raw log as plain text. If the log parses to no message at all after a non-empty draft, ChatView renders the prose as a text bubble instead of an empty box (the `looksLikeA2UI` branch above).

- [ ] **Step 5: Verify progressive rendering in the browser**

Run the dev server with the backend streaming build. Send `Plan a three-day Monrovia weekend`.

Expected:
- Text appears incrementally, not all at once.
- The rendered card appears before the stream ends and fills in.
- Stop (the square button) discards the draft and re-enables the composer.
- The sidebar title is based on the user prompt, not the A2UI wire log.
- Reload restores the completed answer.
- No console warnings about hydration or unknown components.

---

## Task 7: Failure Paths, Design Audit, and Final Verification

**Status:** Next-side parts done in the A2UI swap (helpers + build gate verified); browser checks still open, pending the backend.

**Files:**
- Modify: `components/chat/A2UIAnswer.tsx` (only for the fallback)
- Modify: `app/chat/ChatView.tsx` (only for error placement)

**Interfaces:**
- Consumes every earlier task.
- Produces: the reviewed, shippable feature.

- [ ] **Step 1: Pin the unsafe-URL and prose-fallback behavior**

First test the pure helpers directly with Bun:

```bash
bun -e '
import { isSafeUrl, looksLikeA2UI } from "./lib/chat/a2ui.ts";
const cases = [
  ["https://example.com", true],
  ["http://example.com/a", true],
  ["javascript:alert(1)", false],
  ["data:text/html,hi", false],
  ["//example.com", false],
];
for (const [url, want] of cases) {
  const got = isSafeUrl(url);
  if (got !== want) { console.error("FAIL", url, got, "want", want); process.exit(1); }
}
console.log("url policy ok");
console.log("prose is not a2ui:", looksLikeA2UI("This is a normal sentence, not A2UI.") === false);
'
```

Expected: `url policy ok` and `prose is not a2ui: true`.

Then verify with a hand-written message in `localStorage`:

```js
const id = "a2ui-test";
const surface = JSON.stringify({ version: "1.0", createSurface: { surfaceId: "s1", catalogId: "https://sando.app/catalogs/chat/v1/catalog.json", components: [{ id: "root", component: "Column", children: ["b1"] }, { id: "b1", component: "Button", child: "t1", action: { functionCall: { name: "openUrl", arguments: { url: "javascript:alert(1)" } } } }, { id: "t1", component: "Text", text: "Open" }] } });
localStorage.setItem("sando:conversations:v1", JSON.stringify([{
  id, title: "A2UI test", createdAt: Date.now(), updatedAt: Date.now(),
  messages: [
    { id: "u1", role: "user", content: "open something", createdAt: Date.now() },
    { id: "a1", role: "assistant", kind: "a2ui", createdAt: Date.now(), content: surface }
  ]
}]));
location.href = `/chat?id=${id}`;
```

Expected: the button renders, clicking it does nothing, and no new tab or dialog opens. Then replace the payload with plain prose:

```js
content: "This is a normal sentence, not A2UI."
```

Expected: the prose renders as a plain-text fallback, not an empty box or parser error. Finally, replace it with a message that parses but references an unknown component (for example a component named `NoSuchComponent`) and confirm the plain-text fallback shows the raw log.

- [ ] **Step 2: Verify the monochrome rule on rendered answers**

With a rendered A2UI answer on screen, run in the browser console:

```js
[...document.querySelectorAll(".a2ui-answer *")].map((el) => {
  const s = getComputedStyle(el);
  return [s.color, s.backgroundColor, s.borderTopColor, s.fill, s.stroke];
}).flat().filter((v) => {
  const m = v.match(/rgba?\((\d+), (\d+), (\d+)/);
  return m && !(m[1] === m[2] && m[2] === m[3]);
});
```

Expected: `[]`. If any entry appears, find the element and fix the component implementation in `A2UIAnswer.tsx` — there is no token file to regenerate.

- [ ] **Step 3: Run the full automated gate**

```bash
cd /home/psrockstar/Documents/code/sando_frontend/sando_ui
npx tsc --noEmit
npx eslint .
npx next build
cd ../sando && zig build
```

Expected: TypeScript clean, ESLint reports only the pre-existing unused `MobileNav` warning, the Next build exits 0, and `zig build` exits 0.

- [ ] **Step 4: Check the pages that share the shell**

```bash
for p in / /chat /chat/settings /plan /help /chat/connect /chat/plugin; do
  echo "$p -> $(curl -sS -m 20 -o /dev/null -w '%{http_code}' http://localhost:3000$p)"
done
```

Expected: every page returns 200.

- [ ] **Step 5: Confirm auth and identity still behave**

- Sign out from the sidebar, sign in again, and confirm `/chat` loads and answers.
- Confirm the sidebar and greeting use the Keycloak `name` ("Perez Sounds"), never the email.
- Send a prompt with an expired token and confirm the existing sign-in recovery still works.

---

## Task 8: Document the Feature for the Next Engineer

**Status:** Done in the A2UI swap (`docs/a2ui.md` + the AGENTS.md rule).

**Files:**
- Create: `docs/a2ui.md`
- Modify: `AGENTS.md` (only the `nextjs-agent-rules` / feedback blocks already managed by `next dev` must stay; add a new section below them)

**Interfaces:**
- Produces: a short operational note covering regeneration, streaming contract, and the one known trade-off.

- [ ] **Step 1: Write `docs/a2ui.md`**

It must state:
- How to regenerate the catalog: `node scripts/generate-a2ui-catalog.mjs` writes `lib/chat/catalog.json`; never hand-edit the catalog.
- How to regenerate the backend prompt: `node scripts/generate-a2ui-prompt.mjs` writes `../../sando/src/connnector/a2ui_spec.zig`; rebuild and restart the backend afterward.
- The NDJSON contract: `{"d":"<base64>"}` frames, one complete A2UI v1.0 message per decoded frame, terminal `{"done":true}`, `{"error":"..."}` on failure.
- Why `mode: "text"` still exists and when it is used (legacy messages, prompt-only fallback).
- The client→agent action contract: events with `userMessage` become follow-up prompts; other events become follow-ups carrying `{"a2ui_action": {...}}`.
- Known trade-off: memory self-editing tags are disabled in UI mode, so facts are updated from plain-text mode only. A follow-up should move memory updates to a side channel if UI mode becomes the only mode.

- [ ] **Step 2: Add the design rule to `AGENTS.md`**

Below the generated blocks, add:

```markdown
## Monochrome only

Only black, white, `neutral-*`, and `currentColor` are allowed. Any new color
must be expressed as a black/white mix. A2UI components are implemented with
monochrome Tailwind classes in `components/chat/A2UIAnswer.tsx`; do not add
colored tokens by hand, and never import basic-catalog styles
(`injectBasicCatalogStyles`) — the Sando catalog carries its own components.
```

---

## Self-Review Notes

- Spec coverage: dependency install + catalog (Task 1), monochrome (Tasks 1 and 7), Zig UI mode (Task 2), Next proxy and client (Task 3), renderer and persistence (Task 4), true streaming (Tasks 5 and 6), failure behavior (Task 7), documentation (Task 8).
- Type consistency: `StoredMessage.kind`/`uiState` are introduced in Task 4 and consumed in Tasks 4 and 6. `TokenSink` is introduced in Task 5 and consumed in Task 5 only. `streamPrompt` is introduced in Task 3 and consumed in Task 6. `callBackendStream` is introduced and consumed in Task 3.
- Deliberate omission: the backend is not a git repository, so backend edits are verified by `zig build`, curl, and the browser rather than commits.
- The OpenUI integration this plan replaces is fully removed: no `@openuidev/*` package, no `openui-monochrome.css`, no `docs/openui.md`, no `generate-openui-*` script remains in the tree.
