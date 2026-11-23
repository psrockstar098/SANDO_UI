# Sando Intelligent UI — Design Spec

**Date:** 2026-11-14 (revised 2026-11-23: OpenUI replaced by A2UI)
**Status:** Approved for planning — Next-side implemented in the A2UI swap; Zig backend pending
**Author:** Sando UI

## Problem

Sando answers every chat message with a plain-text bubble. The backend already produces grounded, memory-aware answers, but there is no way to express a table, a comparison, a form, a map, or a small interactive result. A2UI (Google's open standard, [a2ui.org](https://a2ui.org/), v1.0, Apache 2.0) defines a wire format in which a model emits UI as JSON messages that a host renderer draws with its own components.

This spec covers adopting that model end to end in Sando while preserving the existing shell, auth, history, and monochrome design.

## Goals

1. Assistant answers render as A2UI surfaces when the backend is asked for `mode: "ui"`.
2. Answers appear progressively while the model is still generating.
3. The existing `AppShell`, `SiderBar`, composer, conversation storage, and Keycloak flow keep working unchanged.
4. Only black, white, and their mixes render — Sando implements every component itself, so monochrome holds by construction.
5. A model that ignores the UI prompt still produces a readable answer.

## Non-Goals

- Adopting any vendor's chat shell, sidebar, composer, or thread storage.
- Replacing `localStorage` with backend conversation storage.
- Changing the backend's RAG, embedding, or memory model.
- Adding a second LLM provider or any cloud service. A2UI is a wire format, not a service; there is no A2UI cloud.
- Building a custom component library from scratch. The Sando catalog is 9 components whose shapes follow the A2UI basic catalog, implemented by Sando in monochrome.

## Architecture

```
Browser (ChatView)
  -> POST /api/chat { messages, mode: "ui", stream: true }
Next route handler (app/api/chat/route.ts)
  -> POST http://127.0.0.1:22323/api/chat  (Authorization forwarded)
Zig backend (server.zig -> glue.ask -> ai.chatStreaming)
  -> NVIDIA OpenAI-compatible endpoint (SSE)
  <- NDJSON frames {"d":"<base64>"} ... {"done":true}
Next proxies the stream unchanged
Client decodes frames; each frame is one complete A2UI v1.0 message,
fed to processor.processMessages([message]) in order
```

The backend is the only place that talks to the model. Next never holds the model API key. The browser never talks to the backend directly.

## Decisions

### D1 — Keep the shell, replace only the answer surface

The integration uses `A2uiSurface` from `@a2ui/react` with a `MessageProcessor` from `@a2ui/web_core` fed only the Sando catalog (`lib/chat/catalog.json`). This keeps Sando's identity and avoids a second conversation system. The React renderer is the only renderer; `@a2ui/lit` is never imported.

### D2 — Backend owns the UI prompt

A2UI needs the catalog and the wire format in the system prompt. Generating it in Next and forwarding it on every request would duplicate state and let the browser influence the system prompt. Instead, the catalog JSON is generated once into a Zig source file (`src/connnector/a2ui_spec.zig`) and appended by `glue.ask` when `ui_mode` is true. The browser only sends `mode`.

### D3 — Plain-text mode survives

`mode: "text"` remains the default for callers that do not opt in, and for messages stored before this feature. `toPlainText()` is applied to text replies only.

### D4 — Streaming uses base64 NDJSON frames, one message per frame

Model deltas can split a UTF-8 codepoint. JSON requires valid UTF-8, so raw deltas cannot be embedded directly in JSON lines. Each frame carries a base64-encoded byte chunk:

```
{"d":"eyJ2ZXJzaW9uIjogIjEuMCIsICJjcmVhdGVTdXJmYWNlIjogLi4ufQ=="}
{"done":true}
{"error":"..."}   // only after headers, then close
```

The decoded bytes of one `d` frame are exactly one complete A2UI v1.0 wire message (a JSON object) — never a partial message. The client parses and validates it, appends it to the stored wire log, and feeds it to the processor.

### D5 — Monochrome by construction

Sando implements all 9 catalog components with monochrome Tailwind classes (`black`, `white`, `neutral-*`, `transparent`, `currentColor`). No basic-catalog styles are imported, so there is nothing to recolor and no token generator to maintain. The model may still say "success"; it renders gray.

### D6 — Form state lives on the message

The processor's data model reports changes through a subscription. The client saves the snapshot as `StoredMessage.uiState` and restores it on first surface via an `updateDataModel` at path `/`. Reloads and conversation switches restore the form.

### D7 — Memory self-editing is disabled in UI mode

The existing agent emits `<<<MEMORY_UPDATE>>>` tags that are stripped after generation. In streaming UI mode the tags would render before stripping. The UI prompt explicitly forbids them. Memory continues to update through plain-text mode. A follow-up can move memory updates to a side channel.

### D8 — The model can only pick from the fixed catalog

A2UI surfaces are built only from the components and functions in the Sando catalog. The model cannot inject code or invent components. `openUrl` is renderer-only, requires user activation, and opens http/https URLs only, in a new tab with `noopener,noreferrer`. Sensitive data never reaches the model beyond the prompt itself.

## Contracts

### HTTP

`POST /api/chat` (Next and Zig)

```ts
{
  messages: { role: "user" | "assistant"; content: string }[];
  mode?: "text" | "ui";      // default "text"
  stream?: boolean;          // default false; streaming requires mode "ui"
  collection?: string;       // Zig only
  top_k?: number;            // Zig only
  use_cache?: boolean;       // Zig only
}
```

Non-streaming response:

```ts
{ reply: string; mode: "text" | "ui" }        // Next
{ response: string; format: "text" | "a2ui"; ... } // Zig
```

Streaming response: `content-type: application/x-ndjson`, frames as in D4.

### A2UI wire (v1.0)

Messages are JSON objects with `version: "1.0"` plus one of `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`. `createSurface` carries `surfaceId`, `catalogId` (`https://sando.app/catalogs/chat/v1/catalog.json`), and may carry initial components + data model inline; one component must have `id: "root"`. Data bindings use `{"@path": "..."}`. ChoicePicker selection is always an array, even in mutuallyExclusive mode. Actions arrive as events (`{ event: { name, userMessage?, context? } }`) or local function calls (`{ functionCall: {...} }`); an event with `userMessage` becomes a follow-up prompt in the user's words, other events become a follow-up with a JSON envelope `{"a2ui_action": {"name", "context", "surfaceId", "sourceComponentId"}}`.

### Client storage

```ts
interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;        // plain text, or the A2UI wire log (one message per line)
  createdAt: number;
  kind?: "text" | "a2ui"; // absent means "text"
  uiState?: Record<string, unknown>;
}
```

Old stored messages remain valid because both new fields are optional.

### UI component

`A2UIAnswer` is the only module that imports the A2UI renderer. It accepts the wire log, streaming state, persisted form state, callbacks, and renders a plain-text fallback when the log is not renderable. It is loaded client-only (`next/dynamic`, `ssr: false`) because the React node layer hosts implementations as custom elements.

## Failure Behavior

| Failure | Behavior |
|---|---|
| Model returns prose | Stored as `kind: "text"`, rendered as a normal bubble |
| Model returns an invalid message | Hard error → plain-text fallback of the raw log; never a blank bubble |
| Upstream errors before headers | Normal JSON error response, composer re-enabled |
| Upstream errors mid-stream | Partial answer kept, inline error below it |
| User presses Stop | The in-flight draft is discarded; nothing is saved |
| Unsafe `openUrl` | Ignored |
| Token expired | Existing sign-in recovery runs |

## Risks

- **Model compliance.** The model may not follow the catalog reliably. The plain-text fallback limits the blast radius; the prompt is testable with curl before UI work begins.
- **A2UI 1.0 is young** (released November 11, 2026). The wire format is versioned; pin `@a2ui/react` and `@a2ui/web_core` exactly and re-check the spec before upgrading.
- **No Zig SDK.** The backend emission is hand-built against this spec and `docs/a2ui.md`; there is no upstream Zig library to lean on.
- **Backend is not under git.** Backend edits are verified by `zig build`, curl, and the browser, and documented in the handoff.

## Acceptance

- A UI-mode answer renders as an A2UI surface in `/chat`, streams progressively, survives reload, and keeps form state.
- `npx tsc --noEmit`, `npx eslint .`, `npx next build`, and `zig build` pass.
- A computed-style audit of the rendered answer returns no non-gray color.
- Text mode and legacy conversations remain readable.
