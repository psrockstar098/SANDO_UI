# Sando Intelligent UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sando's plain-text answer bubbles with OpenUI intelligent answers that stream and render as interactive UI, without changing the existing app shell, authentication, or black-and-white design.

**Architecture:** The browser keeps talking to Next route handlers, which forward the Keycloak bearer token to the Zig backend. The Zig backend gains a `mode: "ui"` that appends the generated OpenUI Lang specification to Sando's existing system prompt, and a streaming path that emits base64-framed NDJSON deltas. The Next `/api/chat` route proxies those frames unchanged. On the client, a small `OpenUIAnswer` component renders the returned OpenUI Lang with `Renderer` and the prebuilt `openuiLibrary`, while user messages, legacy assistant messages, and errors keep the current plain-text bubbles.

**Tech Stack:** Next.js 16.4.4 (App Router, cacheComponents), React 19.3, TypeScript 5, Tailwind CSS 4, `@openuidev/react-lang@1.0.0`, `@openuidev/react-ui@0.18.1`, `zod@^4`, Zig 0.17 backend (`std.http.Server`, `std.http.Client`).

**Spec:** `docs/superpowers/specs/2026-11-14-sando-intelligent-ui.md`

## Global Constraints

- Every request except `GET /health` and `OPTIONS` requires a Keycloak bearer token. The browser sends it only to Next; Next forwards it server-side.
- No new color tokens. Every OpenUI `--openui-*` variable with chroma > 0 becomes chroma 0. No Tailwind color utility outside `black`, `white`, `neutral-*`, `transparent`, and `currentColor`.
- Assistant display names never use an email address. Use `getDisplayName()` from `lib/format.ts`.
- `toPlainText()` is applied to `mode: "text"` replies only. Never to OpenUI Lang.
- Conversations stay in `localStorage` under `sando:conversations:v1`. Old stored messages must keep working without migration.
- Backend: `127.0.0.1:22323`. UI dev server: `http://localhost:3000`.
- OpenUI packages are pinned exactly: `@openuidev/react-lang@1.0.0`, `@openuidev/react-ui@0.18.1`, `@openuidev/react-headless@0.18.8`. Do not use `^`.
- OpenUI CSS must load before `globals.css` so the generated monochrome overrides win on equal specificity.
- No `export const dynamic` or `export const runtime` in route files; `cacheComponents` rejects them. `maxDuration` is allowed but not needed here.
- The generated OpenUI spec is committed. Do not generate it during `next build`.

## Review Focus

- **Model returns prose instead of OpenUI Lang.** The user must see the prose answer, not a blank box or a parser error. `OpenUIAnswer` falls back to a plain-text bubble when the parse result has no renderable root.
- **Model returns a partial program during streaming.** The renderer must show what is valid so far and finish in place, without remounting the conversation or losing scroll position.
- **A component emits `@OpenUrl` with a `javascript:` or `data:` URL.** Only `http:` and `https:` open, in a new tab with `noopener,noreferrer`. Everything else is ignored.
- **A user submits an in-answer form, then reloads.** The form state must survive because it is persisted on the stored assistant message, not held only in React state.
- **Upstream fails before or during the stream.** Before headers, the route returns the normal JSON error shape. After headers, the client shows the partial answer plus an inline error and never leaves the composer stuck in `loading`.

---

## File Map

**Create**

- `scripts/generate-openui-prompt.mjs` — builds the OpenUI system prompt and writes the Zig spec file.
- `scripts/generate-openui-theme.mjs` — rewrites every colored `--openui-*` token to grayscale.
- `app/openui-monochrome.css` — generated grayscale token overrides (committed).
- `components/chat/OpenUIAnswer.tsx` — the only component that imports the OpenUI renderer.
- `lib/chat/openui.ts` — pure helpers: URL sanitizing, action mapping, NDJSON frame decoding.

**Modify**

- `package.json` — add the three OpenUI packages, `zod`, and two scripts.
- `app/layout.tsx` — import the OpenUI stylesheet before `globals.css`.
- `app/globals.css` — import the generated monochrome override after the OpenUI stylesheet.
- `lib/chat/store.ts` — add optional `kind` and `uiState` to `StoredMessage`.
- `app/chat/ChatView.tsx` — render OpenUI answers, keep a live streaming draft, add pre-stream error handling.
- `lib/api/api.ts` — add `mode` to `sendPrompt`, add `streamPrompt`.
- `lib/api/backend.ts` — add `callBackendStream`.
- `app/api/chat/route.ts` — pass `mode`, stream NDJSON, skip `toPlainText` for `ui`.
- Zig `/home/psrockstar/Documents/code/sando/src/server.zig` — `mode`, `format`, streaming response.
- Zig `/home/psrockstar/Documents/code/sando/src/connnector/glue.zig` — `ui_mode`, `on_token_sink`, UI prompt override, cache key.
- Zig `/home/psrockstar/Documents/code/sando/src/ai/ai.zig` — `TokenSink`, `chatStreaming`, incremental SSE parse.

**Generated / committed**

- Zig `/home/psrockstar/Documents/code/sando/src/connnector/openui_spec.zig`.

---

## Task 1: Install OpenUI and Build a Monochrome Token Theme

**Files:**
- Modify: `package.json`
- Create: `scripts/generate-openui-theme.mjs`
- Create: `app/openui-monochrome.css` (generated)
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `openuiLibrary` importable from `@openuidev/react-ui/genui-lib`; `app/openui-monochrome.css` loaded globally with all chroma at 0.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Install the pinned packages**

Run:

```bash
cd /home/psrockstar/Documents/code/sando_frontend/sando_ui
bun add --exact @openuidev/react-lang@1.0.0 @openuidev/react-ui@0.18.1 @openuidev/react-headless@0.18.8
bun add zod@^4
```

Expected: `package.json` lists the three packages with exact versions and `zod` under dependencies. `bun.lock` (or lockfile present in the repo) updates. If the repo uses a different lockfile, use the package manager that produced it.

- [ ] **Step 2: Verify the library and prompt are importable**

Run:

```bash
node -e 'import("@openuidev/react-ui/genui-lib").then(m=>{console.log(Object.keys(m.openuiLibrary.components).length, m.openuiLibrary.root)})'
```

Expected: `82 Stack`

- [ ] **Step 3: Write the theme generator**

Create `scripts/generate-openui-theme.mjs`. It must:

1. Read `node_modules/@openuidev/react-ui/dist/styles/index.css`.
2. Scan declarations in file order into a map of `--openui-<name>` → value. Later declarations overwrite earlier ones, which picks the dark-theme values (the light `:root` block comes first, then the `prefers-color-scheme: dark` block, then `:root[data-openui-theme=dark]`).
3. Keep only values that contain `oklch(`. Assert that no kept value contains `rgb(`, `hsl(`, or `#`; if one does, print `UNSUPPORTED <name> <value>` to stderr and exit non-zero. Non-color tokens (fonts, radii, spacing) are skipped.
4. For each kept `oklch(L C H / A)` or `oklch(L C H)` value, replace `C` with `0`, keeping `L`, `H`, and `A`.
5. Emit `app/openui-monochrome.css` with this exact header and selectors:

```css
/* Generated by scripts/generate-openui-theme.mjs. Do not edit by hand. */
:root,
:root:not([data-openui-theme="light"]),
:root[data-openui-theme="dark"] {
  /* one declaration per line, sorted by variable name */
}
```

6. Print `wrote app/openui-monochrome.css (<n> tokens)`.

- [ ] **Step 4: Run the generator and prove the output is grayscale**

Run:

```bash
node scripts/generate-openui-theme.mjs
node -e '
const fs=require("fs");
const css=fs.readFileSync("app/openui-monochrome.css","utf8");
const bad=[...css.matchAll(/--openui-[\w-]+\s*:\s*oklch\(\s*[\d.]+\s+([\d.]+)/g)]
  .filter((m)=>Number(m[1])!==0);
if(bad.length){console.error(bad.map((m)=>m[0]));process.exit(1)}
console.log("all chroma 0")
'
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(' app/openui-monochrome.css && exit 1 || true
```

Expected: `wrote app/openui-monochrome.css (<n> tokens)`, `all chroma 0`, and the final grep prints nothing.

- [ ] **Step 5: Load the stylesheets in the right order**

In `app/layout.tsx`, add before the existing `import "./globals.css";`:

```tsx
import "@openuidev/react-ui/styles/index.css";
```

In `app/globals.css`, after the first line `@import "tailwindcss";`, add:

```css
@import "./openui-monochrome.css";
```

- [ ] **Step 6: Verify the build still passes**

Run:

```bash
npx tsc --noEmit
npx next build
```

Expected: both exit 0. No CSS import resolution errors.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock app/layout.tsx app/globals.css scripts/generate-openui-theme.mjs app/openui-monochrome.css
git commit -m "feat(openui): add OpenUI packages and monochrome token theme"
```

---

## Task 2: Add `mode: "ui"` to the Zig Backend

**Files:**
- Create: `/home/psrockstar/Documents/code/sando/src/connnector/openui_spec.zig` (generated)
- Create: `/home/psrockstar/Documents/code/sando_frontend/sando_ui/scripts/generate-openui-prompt.mjs`
- Modify: `/home/psrockstar/Documents/code/sando/src/connnector/glue.zig`
- Modify: `/home/psrockstar/Documents/code/sando/src/server.zig`

**Interfaces:**
- Produces: `POST /api/chat` accepts `{ messages, mode?: "text" | "ui", stream?: bool }` and returns `{ response, format, dialect, source_count, is_cached, choices }` where `format` is `"text"` or `"openui"`.
- Produces: `RagOptions.ui_mode: bool = false`; `glue.ask` appends the OpenUI spec when true.
- Consumes: the existing `glue.ask`, `:system_prompt_template`, and `UserSession` from the current backend.

- [ ] **Step 1: Write the prompt generator**

Create `scripts/generate-openui-prompt.mjs` in the UI repo. It must:

1. Import `generateSystemPrompt` from `@openuidev/react-lang` and `{ openuiLibrary, openuiPromptOptions }` from `@openuidev/react-ui/genui-lib`.
2. Call `generateSystemPrompt({ library: openuiLibrary, promptOptions: openuiPromptOptions })`.
3. Assert the result is longer than 20,000 characters and contains `openui-lang`.
4. Render the Zig file:

```zig
// Generated by sando_ui/scripts/generate-openui-prompt.mjs. Do not edit by hand.
pub const spec =
    \\<each prompt line, prefixed with four spaces and two backslashes>
;
```

Every prompt line must be escaped for a Zig multiline string: prefix it with four spaces and `\\`, and double any literal backslash in the prompt. Braces do **not** need escaping, because the spec is passed to `std.fmt.allocPrint` as an `{s}` argument and is never itself used as a format string. The generator must reject any line that would end with a lone backslash. It must also convert a leading `\` in the prompt to `\\`.

5. Write to the path in `process.argv[2] ?? "../../sando/src/connnector/openui_spec.zig"`. Resolve it relative to `process.cwd()`.
6. Print `wrote <path> (<n> chars)`.

- [ ] **Step 2: Generate the spec and prove it compiles as Zig**

Run:

```bash
cd /home/psrockstar/Documents/code/sando_frontend/sando_ui
node scripts/generate-openui-prompt.mjs
head -3 ../../sando/src/connnector/openui_spec.zig
wc -c ../../sando/src/connnector/openui_spec.zig
cd ../../sando && zig build
```

Expected: `wrote /home/.../sando/src/connnector/openui_spec.zig (23310 chars)` (the exact character count may differ slightly), the head shows the generated header, and `zig build` exits 0. If `zig build` fails on the string, fix the escaping in the generator, not the generated file.

- [ ] **Step 3: Add `ui_mode` and the prompt override in `glue.zig`**

Add `@import("openui_spec.zig")` as `openui_spec` at the top of `glue.zig`.

Add to `RagOptions`:

```zig
/// Render the answer as OpenUI Lang instead of plain text.
ui_mode: bool = false,
```

Add this constant above `system_prompt_template`:

```zig
const ui_output_override =
    \\OUTPUT FORMAT OVERRIDE (takes precedence over section 13)
    \\Your reply is rendered by OpenUI, not as a chat bubble. Respond with
    \\valid openui-lang code and nothing else. Every reply must define
    \\root = Stack(...). Do not wrap the program in markdown fences. Do not
    \\write prose before or after the program. Use TextContent for short
    \\answers and the richer components when the answer benefits from them.
    \\Do not emit <<<MEMORY_UPDATE>>> tags in this mode; they would appear in
    \\the rendered answer.
    \\
    \\OPENUI-LANG SPECIFICATION
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
    const override = try std.fmt.allocPrint(alloc, ui_output_override, .{openui_spec.spec});
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
.format = if (wants_ui) "openui" else "text",
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
  -d '{"messages":[{"role":"user","content":"Show me a short greeting card in Koloqua"}],"mode":"ui"}' | jq '{format, first: (.response[0:120])}'
```

Expected: the text request reports `format: "text"` and plain prose; the UI request reports `format: "openui"` and the response starts with `root = Stack(` or another valid program declaration. If the model returns prose for the UI request, tighten the override wording and repeat. This is the model-quality gate.

- [ ] **Step 6: Commit the UI-side generator; record the backend change**

The backend is not a git repository. Commit the generator in the UI repo:

```bash
cd /home/psrockstar/Documents/code/sando_frontend/sando_ui
git add scripts/generate-openui-prompt.mjs
git commit -m "feat(openui): generate the OpenUI system prompt for the backend"
```

Note in the handoff that `glue.zig`, `server.zig`, and `openui_spec.zig` are changed outside git and must be kept with the backend deployment.

---

## Task 3: Add `mode` to the Next Chat Proxy and API Client

**Files:**
- Modify: `lib/api/backend.ts`
- Modify: `lib/api/api.ts`
- Modify: `app/api/chat/route.ts`

**Interfaces:**
- Produces: `callBackendStream(path, request, body, timeoutMs?) => Promise<BackendStreamResult>`.
- Produces: `sendPrompt({ ..., mode }) => Promise<ChatResponse>` with `ChatResponse.mode`.
- Produces: `streamPrompt({ ..., onToken }) => Promise<StreamChatResponse>` reading base64 NDJSON frames.
- Produces: `POST /api/chat` accepts `mode` and returns `{ reply, mode }`; with `stream: true` it returns `content-type: application/x-ndjson`.

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
- Parse `stream` as `payload.stream === true`.
- Non-streaming: forward `{ messages, mode, stream: false }`, then return `{ reply: mode === "ui" ? rawReply : toPlainText(rawReply), mode }`.
- Streaming: require `mode === "ui"` (otherwise return 400 `streaming is only supported for mode "ui"`). Forward `{ messages, mode, stream: true }` through `callBackendStream`. On success, return a `Response` whose body is the upstream `ReadableStream`, headers:

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

Create `lib/chat/openui.ts` with this pure export:

```ts
export type OpenUIFrame = { d?: string; done?: true; error?: string };

/**
 * Parses one NDJSON line. Returns null for blank lines.
 * Throws for malformed JSON so the caller can surface a protocol error.
 */
export function parseOpenUIFrame(line: string): OpenUIFrame | null;

/** Decodes a base64 frame payload into bytes. */
export function decodeFrameBytes(base64: string): Uint8Array;

/** True for http(s) URLs only. */
export function isSafeUrl(url: string): boolean;
```

Add to `lib/api/api.ts`:

```ts
export interface StreamPromptParams extends SendPromptParams {
  mode: "ui";
  onToken: (chunk: string) => void;
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
- For each frame: `error` → throw `ApiError` with the accumulated reply attached as `partial`; `d` → `decodeFrameBytes` and append the decoded text to the reply and pass it to `onToken`; `done` → stop.
- The caller's `signal` aborts the reader. A network failure after tokens is thrown as `ApiError` with the partial reply attached as `(err as ApiError & { partial?: string }).partial`.

- [ ] **Step 5: Verify the proxy with a hand-written upstream check**

Run `npx tsc --noEmit`, then with the dev server running:

```bash
TOKEN="$(cat /tmp/opencode/sando-token 2>/dev/null)"
curl -sS -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say hello"}],"mode":"ui"}' | head -c 200
```

Expected: a JSON object containing `"mode":"ui"` and a `reply` beginning with OpenUI Lang (no `toPlainText` cleanup).

- [ ] **Step 6: Commit**

```bash
git add lib/api/backend.ts lib/api/api.ts lib/chat/openui.ts app/api/chat/route.ts
git commit -m "feat(openui): proxy UI-mode chat through Next"
```

---

## Task 4: Render OpenUI Answers in the Existing Chat

**Files:**
- Create: `components/chat/OpenUIAnswer.tsx`
- Modify: `lib/chat/store.ts`
- Modify: `app/chat/ChatView.tsx`

**Interfaces:**
- Produces: `OpenUIAnswer` default export with:

```ts
interface OpenUIAnswerProps {
  code: string;
  isStreaming?: boolean;
  state?: Record<string, unknown>;
  onStateUpdate?: (state: Record<string, unknown>) => void;
  onFollowUp: (prompt: string) => void;
}
```

- Produces: `StoredMessage.kind?: "text" | "openui"` and `StoredMessage.uiState?: Record<string, unknown>`.
- Consumes: `sendPrompt({ mode: "ui" })` from Task 3.

- [ ] **Step 1: Extend the message schema without breaking old data**

In `lib/chat/store.ts`:

```ts
export type ChatKind = "text" | "openui";

export interface StoredMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  /** Absent means "text", so messages stored before OpenUI still load. */
  kind?: ChatKind;
  /** OpenUI form state, persisted with the message. */
  uiState?: Record<string, unknown>;
}
```

Extend `isMessage` to accept `kind` only when it is `"text"` or `"openui"`, and `uiState` only when it is a non-null object. Missing fields remain valid.

- [ ] **Step 2: Build the renderer component**

Create `components/chat/OpenUIAnswer.tsx` with `"use client"` at the top.

Rules:
- Import `Renderer`, `BuiltinActionType`, and `type LibraryActionEvent` from `@openuidev/react-lang`.
- Import `{ openuiLibrary }` from `@openuidev/react-ui/genui-lib`.
- Render inside `<div className="openui-answer min-w-0 text-sm">`.
- Pass `response={code}`, `library={openuiLibrary}`, `isStreaming`, `initialState={state}`, `onStateUpdate`, and `onError`.
- Pass a grayscale `queryLoader` so the library's default blue spinner never appears:

```tsx
queryLoader={<span className="size-4 animate-spin rounded-full border-2 border-t-transparent border-white/70" />}
```

- `onAction(event)`:
  - `event.type === BuiltinActionType.ContinueConversation` (the string `"continue_conversation"`) → `onFollowUp(event.humanFriendlyMessage.trim())` when non-empty.
  - `event.type === BuiltinActionType.OpenUrl` (the string `"open_url"`) → read `event.params.url`; when it is a string and `isSafeUrl(url)` is true, call `window.open(url, "_blank", "noopener,noreferrer")`.
  - Everything else: ignore.
- `onError(errors)`: keep rendering when every error has `severity === "warning"`. If any error has no `severity` (the library's error case) and `isStreaming` is false, set `failedCode = code` and render a plain-text fallback:

```tsx
<pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
  {code}
</pre>
```

Reset `failedCode` in a `useEffect` when `code` changes, so a corrected program renders again.
- Do not import `AgentInterface` or any of its providers.

- [ ] **Step 3: Render stored answers and follow-ups in `ChatView`**

In `app/chat/ChatView.tsx`:
- Replace the static import of the answer component with a client-only dynamic import so the OpenUI library never runs during SSR:

```tsx
const OpenUIAnswer = dynamic(() => import("@/components/chat/OpenUIAnswer"), { ssr: false });
```

- Extend `Bubble` to accept `onFollowUp` and `onStateUpdate`:

```tsx
if (message.role === "assistant" && message.kind === "openui") {
  return (
    <OpenUIAnswer
      code={message.content}
      state={message.uiState}
      onStateUpdate={(state) => onStateUpdate(message.id, state)}
      onFollowUp={onFollowUp}
    />
  );
}
```

- `onStateUpdate(id, state)` writes the updated message back with `saveConversation`, preserving all other fields.
- `onFollowUp(prompt)` calls `send(prompt)`.
- `send` gains a `mode` argument defaulting to `"ui"`. It calls `sendPrompt({ mode })`; on success it stores:

```ts
const answer: Message = {
  id: crypto.randomUUID(),
  role: "assistant",
  content: reply,
  createdAt: Date.now(),
  kind: mode === "ui" ? "openui" : "text",
};
```

- If the UI-mode response does not start with a plausible program (`/^\s*(root|[A-Za-z_][A-Za-z0-9_]*)\s*=/m` fails), store it as `kind: "text"` and render the prose, so a model that ignores the prompt never produces an empty bubble.

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
- The assistant answer renders as an OpenUI card/stack, not raw DSL.
- The sidebar still lists the conversation.
- Reloading the page restores the rendered answer.
- A response containing form inputs keeps its values after reload.

- [ ] **Step 5: Commit**

```bash
git add components/chat/OpenUIAnswer.tsx lib/chat/store.ts app/chat/ChatView.tsx
git commit -m "feat(openui): render intelligent answers in chat"
```

---

## Task 5: Stream Tokens from the Zig Backend

**Files:**
- Modify: `/home/psrockstar/Documents/code/sando/src/ai/ai.zig`
- Modify: `/home/psrockstar/Documents/code/sando/src/connnector/glue.zig`
- Modify: `/home/psrockstar/Documents/code/sando/src/server.zig`

**Interfaces:**
- Produces: `ai.TokenSink` and `ai.chatStreaming(system_prompt, user_prompt, sink) ![]const u8`.
- Produces: `RagOptions.on_token_sink: ?ai.TokenSink = null`.
- Produces: `POST /api/chat` with `{ mode: "ui", stream: true }` responds `content-type: application/x-ndjson` and frames `{"d":"<base64>"}\n`, ending with `{"done":true}\n`.

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

Expected: several `{"d":"..."}` lines arrive before the process exits, then `{"done":true}`. Decoding a few frames should produce the beginning of `root = Stack(`. If all frames arrive at once, confirm `postStreaming` reads with `readSliceShort` rather than buffering the whole body first.

- [ ] **Step 5: Record the backend change**

The backend is not a git repository. Keep `ai.zig`, `glue.zig`, `server.zig`, and `openui_spec.zig` together, rebuild, and restart before the frontend streaming task.

---

## Task 6: Stream OpenUI Answers into the Chat

**Files:**
- Modify: `app/api/chat/route.ts` (already supports streaming from Task 3; verify no change is needed)
- Modify: `lib/api/api.ts` (already has `streamPrompt` from Task 3)
- Modify: `app/chat/ChatView.tsx`

**Interfaces:**
- Consumes: `streamPrompt({ mode: "ui", onToken })`.
- Produces: a live draft rendered with `OpenUIAnswer` and persisted on completion or abort.

- [ ] **Step 1: Add the live draft state**

In `Chat`, add:

```tsx
const [draft, setDraft] = useState<{ id: string; content: string } | null>(null);
```

`draft.content` grows with every token. Do not write partial drafts to `localStorage` on every token; write once when the stream ends, is aborted, or fails after at least one token.

- [ ] **Step 2: Replace the non-streaming call with `streamPrompt`**

In `send`:
- Create `const draftId = crypto.randomUUID();`
- `setDraft({ id: draftId, content: "" });`
- Call:

```ts
const { reply } = await streamPrompt({
  prompt: content,
  history,
  token,
  mode: "ui",
  signal: controller.signal,
  onToken: (chunk) => setDraft((d) => (d ? { ...d, content: d.content + chunk } : d)),
});
```

- On success, save the final answer with `kind: "openui"` and `setDraft(null)`.
- On abort, if the draft has non-empty content, save it with `kind: "openui"`; then `setDraft(null)`.
- On error, if a partial reply was attached to the error, save it and show the error text below it; otherwise show the error as today.
- Always `setDraft(null)` in `finally`.
- If the view unmounts mid-stream (for example the user opens another conversation), the async callback still writes the final answer to the store. The live draft is component state and is intentionally not preserved; this matches the current typing indicator.

- [ ] **Step 3: Render the draft**

After the stored messages, before the typing bubble:

```tsx
{draft && (
  hasAssignment(draft.content) ? (
    <OpenUIAnswer
      code={draft.content}
      isStreaming
      onFollowUp={(prompt) => void send(prompt)}
    />
  ) : (
    <div className="flex justify-start">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5 text-sm leading-relaxed text-neutral-100 md:max-w-[70%]">
        {draft.content}
      </div>
    </div>
  )
)}
```

Define `hasAssignment(code)` next to the Task 4 heuristic as `/(^|\n)\s*(root|[A-Za-z_][A-Za-z0-9_]*)\s*=/.test(code)`. It keeps early prose visible while the model is still on its first line, then hands over to the renderer as soon as a statement appears.

Keep the typing bubble only while `loading && !draft`. Scroll-follow should depend on `draft?.content` too, so the view follows the growing answer.

- [ ] **Step 4: Guard the renderer against partial syntax**

`OpenUIAnswer` must not unmount the rendered tree between tokens. Pass the full accumulated string every time and let `Renderer` handle partial programs. If `onError` reports only `severity: "warning"`, keep rendering. If the parse result is null after a non-empty draft, render a plain `<pre className="whitespace-pre-wrap text-sm">{code}</pre>` instead of an empty box.

- [ ] **Step 5: Verify progressive rendering in the browser**

Run the dev server with the backend streaming build. Send `Plan a three-day Monrovia weekend`.

Expected:
- Text appears incrementally, not all at once.
- The rendered card appears before the stream ends and fills in.
- Stop (the square button) keeps the partial answer and re-enables the composer.
- The sidebar title is based on the user prompt, not the OpenUI Lang.
- Reload restores the completed answer.
- No console warnings about hydration or unknown components.

- [ ] **Step 6: Commit**

```bash
git add app/chat/ChatView.tsx components/chat/OpenUIAnswer.tsx lib/api/api.ts app/api/chat/route.ts
git commit -m "feat(openui): stream intelligent answers into chat"
```

---

## Task 7: Failure Paths, Design Audit, and Final Verification

**Files:**
- Modify: `components/chat/OpenUIAnswer.tsx` (only for the fallback)
- Modify: `app/chat/ChatView.tsx` (only for error placement)

**Interfaces:**
- Consumes every earlier task.
- Produces: the reviewed, shippable feature.

- [ ] **Step 1: Pin the unsafe-URL and prose-fallback behavior**

First test the pure helper directly with Bun:

```bash
bun -e '
import { isSafeUrl } from "./lib/chat/openui.ts";
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
'
```

Expected: `url policy ok`.

Then verify with a hand-written message in `localStorage`:

```js
const id = "openui-test";
localStorage.setItem("sando:conversations:v1", JSON.stringify([{
  id, title: "OpenUI test", createdAt: Date.now(), updatedAt: Date.now(),
  messages: [
    { id: "u1", role: "user", content: "open something", createdAt: Date.now() },
    { id: "a1", role: "assistant", kind: "openui", createdAt: Date.now(),
      content: 'root = Stack([Button("Open", Action([@OpenUrl("javascript:alert(1)")]))])' }
  ]
}]));
location.href = `/chat?id=${id}`;
```

Expected: the button renders, clicking it does nothing, and no new tab or dialog opens. Then replace the payload with plain prose:

```js
content: "This is a normal sentence, not OpenUI Lang."
```

Expected: the prose renders as a normal assistant bubble (the Task 4 heuristic), not an empty box or parser error. Finally, replace it with a program that parses but is not renderable (for example `root = Stack([NoSuchComponent()])`) and confirm the `<pre>` fallback shows the raw code.

- [ ] **Step 2: Verify the monochrome rule on rendered answers**

With a rendered OpenUI answer on screen, run in the browser console:

```js
[...document.querySelectorAll(".openui-answer *")].map((el) => {
  const s = getComputedStyle(el);
  return [s.color, s.backgroundColor, s.borderTopColor, s.fill, s.stroke];
}).flat().filter((v) => {
  const m = v.match(/rgba?\((\d+), (\d+), (\d+)/);
  return m && !(m[1] === m[2] && m[2] === m[3]);
});
```

Expected: `[]`. If any entry appears, find the element and add the missing token override to the theme generator, then regenerate.

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

Expected: every page returns 200. The OpenUI stylesheet must not affect these pages.

- [ ] **Step 5: Confirm auth and identity still behave**

- Sign out from the sidebar, sign in again, and confirm `/chat` loads and answers.
- Confirm the sidebar and greeting use the Keycloak `name` ("Perez Sounds"), never the email.
- Send a prompt with an expired token and confirm the existing sign-in recovery still works.

- [ ] **Step 6: Commit**

```bash
git add components/chat/OpenUIAnswer.tsx app/chat/ChatView.tsx app/openui-monochrome.css scripts/generate-openui-theme.mjs
git commit -m "fix(openui): harden fallbacks and keep answers monochrome"
```

---

## Task 8: Document the Feature for the Next Engineer

**Files:**
- Create: `docs/openui.md`
- Modify: `AGENTS.md` (only the `nextjs-agent-rules` / feedback blocks already managed by `next dev` must stay; add a new section below them)

**Interfaces:**
- Produces: a short operational note covering regeneration, streaming contract, and the one known trade-off.

- [ ] **Step 1: Write `docs/openui.md`**

It must state:
- How to regenerate the prompt: `node scripts/generate-openui-prompt.mjs` writes `../../sando/src/connnector/openui_spec.zig`; rebuild and restart the backend afterward.
- How to regenerate the theme: `node scripts/generate-openui-theme.mjs`; never hand-edit `app/openui-monochrome.css`.
- The NDJSON contract: `{"d":"<base64>"}` frames, terminal `{"done":true}`, `{"error":"..."}` on failure.
- Why `mode: "text"` still exists and when it is used (legacy messages, prompt-only fallback).
- Known trade-off: memory self-editing tags are disabled in UI mode, so facts are updated from plain-text mode only. A follow-up should move memory updates to a side channel if UI mode becomes the only mode.

- [ ] **Step 2: Add the design rule to `AGENTS.md`**

Below the generated blocks, add:

```markdown
## Design: monochrome only

Only black, white, `neutral-*`, and `currentColor` are allowed. Any new
color must be expressed as a black/white mix. OpenUI tokens are generated
to grayscale by `scripts/generate-openui-theme.mjs`; do not add colored
tokens by hand.
```

- [ ] **Step 3: Commit**

```bash
git add docs/openui.md AGENTS.md
git commit -m "docs(openui): document the intelligent UI contract"
```

---

## Self-Review Notes

- Spec coverage: dependency install (Task 1), monochrome (Tasks 1 and 7), Zig UI mode (Task 2), Next proxy and client (Task 3), renderer and persistence (Task 4), true streaming (Tasks 5 and 6), failure behavior (Task 7), documentation (Task 8).
- Type consistency: `StoredMessage.kind`/`uiState` are introduced in Task 4 and consumed in Tasks 4 and 6. `TokenSink` is introduced in Task 5 and consumed in Task 5 only. `streamPrompt` is introduced in Task 3 and consumed in Task 6. `callBackendStream` is introduced and consumed in Task 3.
- Deliberate omission: the backend is not a git repository, so backend edits are verified by `zig build`, curl, and the browser rather than commits.
