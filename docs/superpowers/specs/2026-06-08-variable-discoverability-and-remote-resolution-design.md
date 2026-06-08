# Variable Discoverability & Remote/Library Variable Resolution (F2)

**Date:** 2026-06-08
**Status:** Design approved — pending spec review
**Origin:** F2 finding from the 2026-06-08 NL-steering live validation (`nl-steering-live-validation` memory). HIGH-value gap.

## Problem

Figma variables are not usable by name without guessing:

- **(A) No discoverability** — there is no tool to list variables. The LLM guesses names; `proto_set_variable` / `proto_toggle_variable` / `proto_conditional` then fail.
- **(B) Remote/library variables don't resolve** — `resolveVariableByName` ([src/figma-plugin/code.ts:204-218](../../../src/figma-plugin/code.ts#L204-L218)) only matches `figma.variables.getLocalVariablesAsync()` by exact name and throws `Variable not found` otherwise. Library-imported variables (e.g. `corner-radius/8`) never match. `isOpen` worked in validation only because it was a freshly-created local var.

**Scope:** A + remote import (the most ambitious option).

## Architecture context

Low-level read tools follow a fixed wiring (mirroring `find_nodes` / `get_canvas_overview`):

1. zod input schema in `src/mcp-server/tools.ts`
2. registration in `src/server/tools.ts` with `command: "<NAME>"` (no handler — pure dispatch)
3. `"<NAME>"` added to `CommandName` in `src/mcp-server/types.ts`
4. `Command` union arm in `src/figma-plugin/code.ts` (line ~41)
5. `case "<NAME>"` in the dispatch switch (line ~86)
6. `handle<Name>` function in `src/figma-plugin/code.ts`

`resolveVariableByName` is shared by all three variable-writing paths — set_variable, toggle, conditional ([code.ts:181,229,373](../../../src/figma-plugin/code.ts#L181)) — so one extension covers all three.

**Verified remote API path** (plugin-typings): `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` → `getVariablesInLibraryCollectionAsync(key)` → `figma.variables.importVariableByKeyAsync(key)`. **Caveat (typings line 10316): only PUBLISHED variables are importable.** Combined with the runtime-vs-typings risk (`runtime-vs-typings-mismatch` memory), the remote path is probe-gated.

## Section 1 — `list_variables` tool

Same layer as `find_nodes`. No handler; `command: "LIST_VARIABLES"`.

**Input (`ListVariablesInput`, all optional, `.strict()`):**
- `resolvedType?: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR"` — type filter
- `includeRemote?: boolean` (default `true`) — whether to enumerate library variables (can be slow)
- `nameQuery?: string` — name substring filter

**Output:**
```jsonc
{
  "local": [
    { "name": "isOpen", "id": "VariableID:...", "resolvedType": "BOOLEAN", "collection": "modes" }
  ],
  "library": [
    { "name": "corner-radius/8", "key": "abc123...", "resolvedType": "FLOAT",
      "collection": "radius", "libraryName": "Design System" }
  ],
  "remoteEnumerated": true
}
```

**`handleListVariables` (plugin):**
- Local: `getLocalVariablesAsync()` → resolve each variable's `variableCollectionId` to a collection name; apply `resolvedType` / `nameQuery` filters.
- Library: if `includeRemote`, `getAvailableLibraryVariableCollectionsAsync()` → per collection `getVariablesInLibraryCollectionAsync(key)`; apply same filters. On failure / empty / unavailable → set `remoteEnumerated: false` and return `library: []` (**never throw**).

Intent: the LLM calls this first to see real names, types, and local/remote status instead of guessing.

## Section 2 — `resolveVariableByName` extension

Replaces the immediate throw with a 3-step resolution order:

1. **Local exact match** — `getLocalVariablesAsync()`, `v.name === name`. Existing behavior, including the multiple-match warning.
2. **Library import** — if no local match: `getAvailableLibraryVariableCollectionsAsync()` → per collection `getVariablesInLibraryCollectionAsync(key)` → name match → `importVariableByKeyAsync(key)`. The imported variable returns as a local `Variable`, so downstream set/toggle/conditional logic is unchanged.
3. **Error with candidates** — if both fail, throw an error listing available names rather than a bare `Variable not found`:
   `Variable "corner-radius/9" not found. Available — local: [isOpen]; library: [corner-radius/8, brand/primary]. Use list_variables to inspect.`

**Decisions:**
- **Type safety:** post-import `resolvedType` validation stays with `validateVariableLiteralCompat` — no change.
- **Local-vs-library name collision:** local wins (step 1 first). Multiple same-name library vars → first + warning.
- **Published-only:** only published library variables are importable. Unpublished library vars are not caught in step 2 and fall through to the step-3 error (and won't appear in candidate list). Confirmed via probe.
- **No caching:** each proto command resolves exactly one variable, so library enumeration happens at most once per command. No cache needed (YAGNI).

## Section 3 — Probe gate & fallback

**Plan Task 1 = live probe BEFORE writing code.** In real file `uxwXKX9lcuqQxAnPouWJWK` / section MCP_test_12 (remote FLOAT `corner-radius/8` + local BOOLEAN `isOpen`), a one-off plugin snippet confirms:

1. `getAvailableLibraryVariableCollectionsAsync()` returns the `corner-radius` collection.
2. `getVariablesInLibraryCollectionAsync(key)` returns `corner-radius/8` with its key.
3. `importVariableByKeyAsync(key)` returns a real `Variable` with `resolvedType === "FLOAT"`.

**Branches:**
- **PASS** → implement Approach 1 in full (A + remote).
- **FAIL** (permissions / unpublished / runtime mismatch) → implement A only: `list_variables` degrades gracefully (`remoteEnumerated: false`); `resolveVariableByName` stays local + clear candidate-listing error. Record the limitation in memory.

## Testing

- **Unit:** `handleListVariables` output mapping (collection-name resolution, type/name filters, `remoteEnumerated` fallback) with mocked Figma API. `resolveVariableByName` 3-step branching (local hit / library hit / candidate-listing error) with mocks.
- **Schema:** `ListVariablesInput` `.strict()` parse + `zodToJsonSchema` exposure, matching existing tool style.
- **Live re-validation:** after build, via Claude Desktop + supergateway (`npm start` must be re-run + plugin reconnected — server dies on reboot). Scenarios: "변수 목록 보여줘" → `list_variables`; toggle/condition on `corner-radius/8` → remote resolution confirmed.

## Out of scope

- Editing a variable's STORED default value (F3 — unsupported by both MCPs; interactions only).
- Folding variables into `get_canvas_overview` (kept separate; `list_variables` is the dedicated surface).
- Variable mode management / creation.
