# Sando Intelligent UI

Sando's chat answers can render as interactive UI (cards, tables, charts,
forms, maps) instead of plain-text bubbles. The model answers in
[OpenUI Lang](https://openui.com) and the browser renders the program with
the prebuilt `openuiLibrary` from `@openuidev/react-ui`. The app shell,
auth, history, and black-and-white design are unchanged.

## How it works

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

- The backend owns the UI prompt and is the only place that talks to the
  model. Next never holds the model API key. The browser never talks to the
  backend directly.
- `components/chat/OpenUIAnswer.tsx` is the only module that imports the
  OpenUI renderer. It is loaded with `next/dynamic` (`ssr: false`), so the
  82-component library never runs during SSR.
- Form state lives on the stored message (`StoredMessage.uiState`) and is
  passed back as `initialState`, so reloads and conversation switches
  restore in-answer forms.

## Regenerating the prompt

The backend needs the OpenUI system prompt as a Zig source file:

```bash
node scripts/generate-openui-prompt.mjs
```

That writes `../../sando/src/connnector/openui_spec.zig` (relative to this
repo). If the backend lives elsewhere, pass an explicit out path:

```bash
node scripts/generate-openui-prompt.mjs /path/to/sando/src/connnector/openui_spec.zig
```

Rebuild and restart the backend afterward. The generated file is committed
with the backend deployment; do not generate it during `next build`.

## Regenerating the theme

OpenUI ships colored tokens. A generator rewrites every `--openui-*` color
token to the same lightness with chroma 0:

```bash
node scripts/generate-openui-theme.mjs
```

Never hand-edit `app/openui-monochrome.css` — it is generated. The OpenUI
stylesheet loads before `globals.css` in `app/layout.tsx` so the monochrome
overrides win on equal specificity.

## Streaming contract (NDJSON)

`POST /api/chat` with `{ mode: "ui", stream: true }` returns
`content-type: application/x-ndjson` with one JSON object per line:

```json
{"d":"cm9vdCA9IFN0YWNrKC4uLik="}
{"done":true}
{"error":"..."}
```

- Each `d` frame carries a base64-encoded byte chunk of the answer. Deltas
  can split a UTF-8 codepoint, so the client concatenates decoded bytes and
  decodes with `TextDecoder({ stream: true })` (see `lib/chat/openui.ts`).
- `{"done":true}` ends the stream.
- `{"error":"..."}` appears only after headers, then the stream closes; the
  client keeps the partial answer and shows the error below it.
- Streaming requires `mode: "ui"`; a streaming request with `mode: "text"`
  is rejected with 400.

## Why `mode: "text"` still exists

- Messages stored before this feature have no `kind` and render as text.
- A model that ignores the UI prompt returns prose; the chat stores it as
  `kind: "text"` and renders a normal bubble instead of an empty box.
- Any caller that does not opt in gets text mode, and `toPlainText()` is
  applied to text replies only — never to OpenUI Lang.

## Failure behavior

| Failure | Behavior |
|---|---|
| Model returns prose | Stored as `kind: "text"`, rendered as a normal bubble |
| Model returns invalid program | Renderer error → plain-text fallback of the raw reply |
| Upstream errors before headers | Normal JSON error response, composer re-enabled |
| Upstream errors mid-stream | Partial answer kept, inline error below it |
| User presses Stop | Partial answer kept if non-empty |
| Unsafe `@OpenUrl` | Ignored (only `http:`/`https:` open, see `isSafeUrl`) |
| Token expired | Existing sign-in recovery runs |

## Known trade-off

Memory self-editing tags (`<<<MEMORY_UPDATE>>>`) are disabled in UI mode:
in a stream they would render before they could be stripped, so the UI
prompt forbids them. Facts are updated from plain-text mode only. If UI
mode becomes the only mode, a follow-up should move memory updates to a
side channel.
