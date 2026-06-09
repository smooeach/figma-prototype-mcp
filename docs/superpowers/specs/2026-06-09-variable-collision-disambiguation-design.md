# Variable name-collision disambiguation (v0.25.0)

**Date:** 2026-06-09
**Status:** Design approved, ready for implementation plan

## Problem

A variable name can exist in more than one collection in a single file. The
v0.24.0 live validation surfaced a concrete case: `count` exists in **two**
local collections (`DuMat` and `mcp_test`) in test file `MCP_test_12`
(`uxwXKX9lcuqQxAnPouWJWK`). The LLM itself flagged "`count`로 지정하면 모호".

Today `resolveVariableByName` ([src/figma-plugin/code.ts:213](../../../src/figma-plugin/code.ts#L213))
picks the **first** local match and only emits a warning — it can silently
apply the **wrong** variable. The library step is worse: it `break`s on the
first name match, so it never even detects a library-side collision. This is a
correctness gap.

## Decisions (from brainstorm)

- **Q1 — Mechanism: a separate optional `collection` field.** Input becomes
  `{ variable: "count", collection: "mcp_test" }`. Chosen because Figma variable
  names already use `/` for grouping (e.g. `corner-radius/8`), so a
  `collection/name` slash-syntax would clash. (Rejected: `mcp_test::count`
  prefix syntax; raw VariableID reference.)
- **Q2 — On collision when `collection` omitted: ERROR (reject).** Multi-match
  with no `collection` throws an error listing the colliding collections.
  Single-match is unchanged (no behavior change). This flips the current
  local multi-match `warn → use first` to `error`.
- **Q3 — Scope: BOTH local and library collisions.** The `collection` filter
  applies in both resolution steps, consistent with v0.24.0 making library vars
  first-class. **Local-wins ordering is preserved.** Forcing a library var over
  a same-name local (when the local also matches the given collection) is OUT of
  scope.
- **Implementation structure: pure-logic-first (Approach 1).** A pure
  `selectVariableMatch` + `formatAmbiguousVariableError` live in
  `variable-catalog.ts`; `resolveVariableByName` fetches descriptors and
  delegates the pick/collision/error decision. Keeps the cheap local-first
  short-circuit (library only enumerated on a local miss). Rejected: inline in
  code.ts (untestable sandbox logic); eager unified candidate list (forces
  library network enumeration on every resolve).

## Behavior — resolution decision matrix

`resolveVariableByName(name, collection?)`. **Local-first** preserved.
`collection` matching is exact, case-sensitive.

| Situation | `collection` omitted | `collection` provided |
|---|---|---|
| Local single match | ✅ use (unchanged) | ✅ if collection also matches, use; else keep searching (other local + library) |
| Local multi-match (collision) | ❌ **error** listing colliding collections | ✅ 1 in that collection → use; 0 → proceed to library; still 2+ → error |
| Local 0 → library single | ✅ import (unchanged) | ✅ import if collection matches |
| Library multi-match (collision) | ❌ **error** listing library colliding collections | ✅ filter by collection, then import |
| Nowhere | ❌ not-found error (existing) | ❌ not-found error |

Two key changes:
1. Local multi-match `warn → first` is **escalated to `error`** when `collection`
   is omitted (Q2).
2. The **library step gains the same collision detection** (Q3). The current
   first-match `break` is removed; the library step enumerates all collections,
   builds a descriptor list, then runs the same selection.

Out of scope (confirmed): forcing a library var via `collection` when a
same-name + same-collection local exists. Local-wins means a collection
mismatch on the local side does fall through to library search, but a
local same-name + same-collection always wins.

## Schema threading

One optional field, `z.string().min(1).optional()`, through four layers.

**Layer 1 — wire action schemas (src/mcp-server/tools.ts)** — code.ts handlers
read `action.collection` here:
- `ConditionInput` (184), `SetVariableActionInput` (190), `ToggleVariableActionInput` (196)

**Layer 2 — proto input schemas (src/mcp-server/protoTools.ts)** — the LLM-facing surface:
- `ProtoSetVariableEntry` (108), `ProtoToggleVariableEntry` (120),
  `ProtoConditionIf` (132), `BranchSet.set` (170)

**Layer 3 — proto compile mappers (src/mcp-server/protoTools.ts)** — pass `collection` into the action:
- `compileProtoSetVariable` (307), `compileProtoToggleVariable` (324),
  `compileBranchAction` set branch (356), `compileProtoConditional` condition (375)
- Pattern: `...(s.collection !== undefined && { collection: s.collection })` —
  mirrors the existing `resetScrollPosition` handling so an omitted field leaves
  no key (keeps `.strict()` / action-echo clean).

**Layer 4 — code.ts** — the three `resolveVariableByName` call sites (190, 283, 477)
pass `action.collection` as the second argument.

**`.describe()` text** on the `collection` field (single source of LLM steering,
per the v0.24.0 NL-steering lesson): "Only needed when the same variable name
exists in multiple collections. Use `list_variables` to find the collection
name and pass it here. Omitting it on a collision returns an error."

Side effect: the low-level `create_reactions` tool shares the action schemas, so
it also gains `collection` — consistent with the proto surface, accepted.

## Pure helper API (src/figma-plugin/variable-catalog.ts)

Added beside `filterVariables` / `formatVariableNotFoundError`. No `figma.*`
dependency → unit-testable.

```ts
export type VarSelection<T> =
  | { kind: "match"; item: T }
  | { kind: "ambiguous"; collections: string[] }   // multi-match, collection unset/unresolved
  | { kind: "none" };                               // 0 matches → proceed to next step

export function selectVariableMatch<T extends { name: string; collection: string }>(
  name: string,
  collection: string | undefined,
  candidates: T[],
): VarSelection<T>;

export function formatAmbiguousVariableError(
  name: string,
  collections: string[],
  scope: "local" | "library",
): string;
```

**`selectVariableMatch` logic:**
1. Filter candidates by `name`.
2. 0 → `{none}`.
3. If `collection` provided → re-filter by collection: 1 → `match`; 0 → `none`
   (fall through to next step); 2+ → `ambiguous` (same name in same collection —
   rare, defensive).
4. If `collection` omitted: 1 → `match`; 2+ → `ambiguous`.

**code.ts `resolveVariableByName(name, collection?)` wiring:**
- Local descriptors → `selectVariableMatch` → `match` returns; `ambiguous` throws
  `formatAmbiguousVariableError(..., "local")`; `none` proceeds to library.
- Library: remove the first-match `break`; **enumerate all collections** and
  build a descriptor array → `selectVariableMatch` → `match` imports that key
  (existing step-2b import logic); `ambiguous` throws `"library"` error; `none`
  throws the existing not-found error.
- The old multi-match `warning` return is removed (now an error). The
  single-match `warning: undefined` path is kept. The library-import
  "Imported from..." warning is kept.

## Testing

**Unit (`selectVariableMatch` + `formatAmbiguousVariableError`, pure):**
- 0 matches → `none`
- single match, no collection → `match`
- multi-match, no collection → `ambiguous` (collection list correct)
- multi-match, with collection → the single `match`
- multi-match, with collection but 0 match → `none` (library fallback)
- same name twice in one collection + collection given → `ambiguous` (defensive)
- `formatAmbiguousVariableError` local/library wording snapshots

**Compiler (protoTools):**
- Each of the 4 surfaces: `collection` provided → forwarded to the action;
  omitted → key absent (`.strict()` / echo preserved).

## Live verification

No new Figma API surface (`getLocalVariablesAsync` / teamLibrary are unchanged),
so a probe is not mandatory. Two catches to confirm:
1. End-to-end on the `count` collision fixture (`uxwXKX9lcuqQxAnPouWJWK` /
   MCP_test_12, DuMat + mcp_test): omit `collection` → error; provide it →
   applies correctly.
2. Assumption check — **collection-name uniqueness within a file.** If duplicate
   collection names exist, the `collection` filter itself becomes ambiguous.
   Low-risk; confirm once live.

## Versioning

New input capability → **v0.25.0**. Follow the v0.24.0 flow (per-task spec +
quality reviews + live-API check).
