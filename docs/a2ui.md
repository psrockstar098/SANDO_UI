# A2UI in Sando

Sando's chat renders interactive answers with [A2UI](https://a2ui.org/) v1.0
(Google's open standard, Apache 2.0). The model emits UI as JSON wire
messages; Sando draws them with its own monochrome React components. A2UI is
a wire format, not a service — there is no A2UI cloud, and no model key ever
lives in Next.

## Packages (pinned exactly)

- `@a2ui/react@0.15.0` — the React renderer (`A2uiSurface`,
  `createComponentImplementation`).
- `@a2ui/web_core@0.15.0` — the wire layer (`Catalog`, `MessageProcessor`,
  `createFunctionImplementation`, `BASIC_FUNCTIONS`).
- `zod@3.25.76`.

Never import `@a2ui/lit` as a renderer. The React node layer hosts
implementations as custom elements, so the surface module is always loaded
client-only: `next/dynamic(() => import("@/components/chat/A2UIAnswer"),
{ ssr: false })`. A static import breaks the prerender with
`ReferenceError: HTMLElement is not defined`.

## The Sando catalog

`lib/chat/catalog.json` is the only catalog the processor ever sees. It is
generated, never hand-edited:

```bash
node scripts/generate-a2ui-catalog.mjs
```

- id: `https://sando.app/catalogs/chat/v1/catalog.json`
- protocolVersion: `1.0`
- 9 components: Text, Button, Card, Column, Row, List, Divider, TextField,
  ChoicePicker
- 14 functions: required, regex, length, numeric, email, formatString,
  formatNumber, formatCurrency, formatDate, pluralize, openUrl, and, or, not

The generator derives the shapes from the A2UI basic catalog
(`@a2ui/web_core/catalogs/basic/v1`); Sando implements the components itself
in `components/chat/A2UIAnswer.tsx`. No basic-catalog styles are imported, so
monochrome holds by construction — every component uses only `black`, `white`,
`neutral-*`, `transparent`, and `currentColor`.

The backend prompt is generated from the same catalog:

```bash
# In the sando backend checkout
node src/connnector/generate-a2ui-prompt.mjs
```

It writes `src/connnector/a2ui_spec.zig`. The generated text also states the
two rules the processor enforces outside the JSON Schema: component ids must
be UAX #31 identifiers (camelCase; no hyphens), and a `Button.action` is
either `{"event": {...}}` or `{"functionCall": {"@call": ...}}`. Rebuild and
restart the Zig backend afterward.

## Wire format (v1.0)

A message is a JSON object with `version: "1.0"` plus one of:

- `createSurface` — `surfaceId`, `catalogId`, optional initial `components` +
  `dataModel`; one component must have `id: "root"`.
- `updateComponents` — `surfaceId`, `components`.
- `updateDataModel` — `surfaceId`, `path`, `value`.
- `deleteSurface` — `surfaceId`.

Data bindings use `{"@path": "..."}`. ChoicePicker selection is always an
array, even in mutuallyExclusive mode. The `MessageProcessor` is built with
`{ version: "1.0" }` — the default is v0.9, so omitting it breaks parsing.

## HTTP + streaming contract

`POST /api/chat` (Next and Zig):

```ts
{
  messages: { role: "user" | "assistant"; content: string }[];
  mode?: "text" | "ui";   // default "text"
  stream?: boolean;       // default false; streaming requires mode "ui"
}
```

- Non-streaming: `{ reply: string; mode: "text" | "ui" }`. In ui mode the
  reply is the wire log (one message per line), passed through untouched —
  never `toPlainText`ed.
- Streaming (ui mode only): `content-type: application/x-ndjson`, frames
  `{"d":"<base64>"}`, terminal `{"done":true}`, `{"error":"..."}` on failure.
  Each decoded `d` frame is exactly one complete A2UI message. The backend
  only forwards lines that are valid v1.0 envelopes; prose and
  `<<<MEMORY_...>>>` tags are dropped. If the model produced no usable
  message, the backend synthesizes one `createSurface` with a plain `Text`
  component carrying the prose, so the answer still reaches the user. The
  client parses and validates each message (`isA2UIMessage`), appends it to
  the stored wire log, and feeds it to `processor.processMessages([message])`
  in order. Stray non-JSON lines from an older backend are skipped; a reply
  with no usable UI is stored as `kind: "text"`.

## Client storage

```ts
interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;        // plain text, or the A2UI wire log (one message per line)
  createdAt: number;
  kind?: "text" | "a2ui"; // absent means "text"
  uiState?: Record<string, unknown>; // A2UI data-model snapshot (form state)
}
```

A reply with no parseable A2UI message is stored as `kind: "text"` and
rendered as a normal bubble. Form state is restored on first surface via an
`updateDataModel` at path `/`.

## Client → agent action contract

- An event with `userMessage` becomes a follow-up prompt in the user's words.
- Any other event becomes a follow-up carrying a JSON envelope:
  `{"a2ui_action": {"name", "context", "surfaceId", "sourceComponentId"}}`.
- `openUrl` is a local function call, handled by Sando's own implementation:
  rendererOnly, requires user activation, http/https URLs only, opened with
  `window.open(url, "_blank", "noopener,noreferrer")`. Anything else is
  ignored.

## Safety

- The model can only pick components and functions from the fixed Sando
  catalog. It cannot inject code or invent components.
- The backend owns the UI prompt; the browser only sends `mode`.
- `<<<MEMORY_UPDATE>>>` tags are forbidden in ui mode; memory updates happen
  through plain-text mode. A follow-up should move memory updates to a side
  channel if ui mode becomes the only mode.
- The avatar tab is untouched by this feature.

## Known limits

- Markdown inside a Text component renders as plain text (a documented v1
  limitation); Sando's chat bubbles are plain text too.
- The Zig backend emission is hand-built against this doc; there is no Zig
  SDK for A2UI.
- Live checks need the Zig backend and Keycloak, which cannot run on this VM.
