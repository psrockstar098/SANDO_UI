# Sando Intelligent UI — Design Spec

**Date:** 2026-11-14
**Status:** Approved for planning
**Author:** Sando UI

## Problem

Sando answers every chat message with a plain-text bubble. The backend already produces grounded, memory-aware answers, but there is no way to express a table, a comparison, a form, a map, or a small interactive result. The `thesysdev/open-intelligent-ui` project shows a model streaming OpenUI Lang that a component library renders in place.

This spec covers adopting that model end to end in Sando while preserving the existing shell, auth, history, and monochrome design.

## Goals

1. Assistant answers render as OpenUI Lang UI when the backend is asked for `mode: "ui"`.
2. Answers appear progressively while the model is still generating.
3. The existing `AppShell`, `SiderBar`, composer, conversation storage, and Keycloak flow keep working unchanged.
4. Only black, white, and their mixes render — including every OpenUI component and chart.
5. A model that ignores the UI prompt still produces a readable answer.

## Non-Goals

- Adopting `AgentInterface`, its sidebar, its composer, or its thread storage.
- Replacing `localStorage` with backend conversation storage.
- Changing the backend's RAG, embedding, or memory model.
- Adding a second LLM provider or Thesys Cloud.
- Building a custom component library from scratch (the prebuilt `openuiLibrary` is used).

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
Client decodes frames, renders OpenUI Lang with <Renderer>
```

The backend is the only place that talks to the model. Next never holds the model API key. The browser never talks to the backend directly.

## Decisions

### D1 — Keep the shell, replace only the answer surface

`AgentInterface` would replace the sidebar, composer, routing, and storage. The integration uses `Renderer` from `@openuidev/react-lang` with `openuiLibrary` from `@openuidev/react-ui/genui-lib` instead. This keeps Sando's identity and avoids a second conversation system.

### D2 — Backend owns the UI prompt

OpenUI Lang requires a large generated system prompt. Generating it in Next and forwarding it on every request would duplicate state and let the browser influence the system prompt. Instead, the prompt is generated once into a Zig source file (`src/connnector/openui_spec.zig`) and appended by `glue.ask` when `ui_mode` is true. The browser only sends `mode`.

### D3 — Plain-text mode survives

`mode: "text"` remains the default for callers that do not opt in, and for messages stored before this feature. `toPlainText()` is applied to text replies only.

### D4 — Streaming uses base64 NDJSON frames

Model deltas can split a UTF-8 codepoint. JSON requires valid UTF-8, so raw deltas cannot be embedded directly in JSON lines. Each frame carries a base64-encoded byte chunk:

```
{"d":"cm9vdCA9IFN0YWNrKC4uLik="}
{"done":true}
{"error":"..."}   // only after headers, then close
```

The client concatenates decoded bytes and decodes with `TextDecoder({ stream: true })`.

### D5 — Monochrome by construction

OpenUI ships colored semantic and chart tokens. Rather than policing the model's output, a generator rewrites every `--openui-*` color token to the same lightness with chroma 0. The model may still say "success"; it renders gray. This satisfies the design rule without prompt fragility.

### D6 — Form state lives on the message

`Renderer` reports form state through `onStateUpdate`. The client saves it as `StoredMessage.uiState` and passes it back as `initialState`. Reloads and conversation switches restore the form.

### D7 — Memory self-editing is disabled in UI mode

The existing agent emits `<<<MEMORY_UPDATE>>>` tags that are stripped after generation. In streaming UI mode the tags would render before stripping. The UI prompt explicitly forbids them. Memory continues to update through plain-text mode. A follow-up can move memory updates to a side channel.

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
{ reply: string; mode: "text" | "ui" }            // Next
{ response: string; format: "text" | "openui"; ... } // Zig
```

Streaming response: `content-type: application/x-ndjson`, frames as in D4.

### Client storage

```ts
interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;          // plain text or OpenUI Lang
  createdAt: number;
  kind?: "text" | "openui"; // absent means "text"
  uiState?: Record<string, unknown>;
}
```

Old stored messages remain valid because both new fields are optional.

### UI component

`OpenUIAnswer` is the only module that imports the OpenUI renderer. It accepts code, streaming state, persisted form state, callbacks, and renders a fallback when the program is not renderable.

## Failure Behavior

| Failure | Behavior |
|---|---|
| Model returns prose | Stored as `kind: "text"`, rendered as a normal bubble |
| Model returns invalid program | Renderer error → plain-text fallback of the raw reply |
| Upstream errors before headers | Normal JSON error response, composer re-enabled |
| Upstream errors mid-stream | Partial answer kept, inline error below it |
| User presses Stop | Partial answer kept if non-empty |
| Unsafe `@OpenUrl` | Ignored |
| Token expired | Existing sign-in recovery runs |

## Risks

- **Model compliance.** Nemotron may not follow a 23k-character spec reliably. The plain-text fallback limits the blast radius; the prompt is testable with curl before UI work begins.
- **Bundle size.** The prebuilt library ships 82 components. It is loaded only through `next/dynamic` with `ssr: false`.
- **OpenUI CSS tokens.** Upstream versions may rename tokens. The generator fails loudly on any non-`oklch` color value, and the browser audit catches any new colored token.
- **Backend is not under git.** Backend edits are verified by `zig build`, curl, and the browser, and documented in the handoff.

## Acceptance

- A UI-mode answer renders as a card/stack in `/chat`, streams progressively, survives reload, and keeps form state.
- `npx tsc --noEmit`, `npx eslint .`, `npx next build`, and `zig build` pass.
- A computed-style audit of the rendered answer returns no non-gray color.
- Text mode and legacy conversations remain readable.
