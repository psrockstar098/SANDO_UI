#!/usr/bin/env bun
/**
 * Generates lib/chat/catalog.json — the Sando A2UI catalog document.
 *
 * The catalog is a small subset of the A2UI v1.0 basic catalog: the nine
 * components Sando's chat may render, plus the standard function set
 * (validation, formatting, logic, and openUrl). It is derived from the
 * installed @a2ui/web_core basic catalog, so the document is always a valid
 * v1.0 catalog document in the layout the protocol expects.
 *
 * The generated file is committed: it is the contract the Zig backend's UI
 * prompt is written against, and the client loads it with Catalog.fromJson.
 * Re-run after upgrading @a2ui/web_core:
 *
 *   bun scripts/generate-a2ui-catalog.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { basicCatalog } from "@a2ui/web_core/catalogs/basic/v1";

export const SANDO_CATALOG_ID =
  "https://sando.app/catalogs/chat/v1/catalog.json";

export const SANDO_COMPONENTS = [
  "Text",
  "Button",
  "Card",
  "Column",
  "Row",
  "List",
  "Divider",
  "TextField",
  "ChoicePicker",
];

export const SANDO_FUNCTIONS = [
  "required",
  "regex",
  "length",
  "numeric",
  "email",
  "formatString",
  "formatNumber",
  "formatCurrency",
  "formatDate",
  "pluralize",
  "openUrl",
  "and",
  "or",
  "not",
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "lib", "chat", "catalog.json");

const sandoCatalog = basicCatalog.derive({
  catalogId: SANDO_CATALOG_ID,
  components: SANDO_COMPONENTS,
  functions: SANDO_FUNCTIONS,
  instructions:
    "Sando chat catalog. The agent may only compose the nine components " +
    "listed here, rendered by Sando's own monochrome components. " +
    "Every reply is black, white, and their mixes — never name a color.",
});

const doc = sandoCatalog.toJson();
if (doc.catalogId !== SANDO_CATALOG_ID) {
  throw new Error(`derived catalog has wrong id: ${doc.catalogId}`);
}
if (doc.protocolVersion !== "1.0") {
  throw new Error(`derived catalog has wrong version: ${doc.protocolVersion}`);
}
for (const name of SANDO_COMPONENTS) {
  if (!doc.components?.[name]) {
    throw new Error(`derived catalog is missing component: ${name}`);
  }
}

writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log(
  `wrote lib/chat/catalog.json (${SANDO_COMPONENTS.length} components, ${SANDO_FUNCTIONS.length} functions)`,
);
