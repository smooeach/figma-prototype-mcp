# Echo + node-tree extraction (code.ts testability) — Design

**Date:** 2026-06-04
**Status:** Approved (brainstorming)

## Goal

Continue deepening `src/figma-plugin/code.ts` (the Figma plugin sandbox — not unit-testable directly, only live-verifiable) by extracting two more clusters of pure logic into testable modules behind minimal seams, following the established testability-refactor pattern (`variable-literal.ts`, `condition-codec.ts`, `reaction-builder.ts`, `wire-vocabulary.ts`):

1. **Echo extraction (1.4)** — `encodeActionForListEcho` + `decodeConditionForEcho`, the inverse of the build path that re-encodes a runtime Figma reaction action into the `list_reactions` wire/echo format. Currently has zero unit coverage; only live-verifiable.
2. **node-tree extraction (1.5)** — `findEnclosingFrameId` / `hasReactions` / `findScrollableAncestor` / `pathOf`, pure node-tree traversals.

This closes the two remaining structural candidates from the prior `improve-codebase-architecture` exploration. Behavior-preserving — no wire-format change.

## Pattern

Identify pure logic in `code.ts`, give it a minimal seam (descriptors / ids / a structural interface, NOT Figma objects), and leave the `figma.*` lookups in `code.ts` as thin orchestration calling the pure module. The new modules reference neither `figma.*` nor `zod`, so they remain safe inside the tsup-bundled plugin IIFE.

---

## Module 1: `src/figma-plugin/action-echo.ts`

The inverse of the build path: takes a built Figma reaction action (the runtime shape stored on `node.reactions[].actions[]`) and re-encodes it to the wire/echo format that `list_reactions` returns. The structural transform + recursion is pure; all impurity is injected via a `resolvers` object (**Approach A — resolver injection**, chosen over id-collection or id-return-then-postresolve because it keeps the recursion in ONE place and introduces no lockstep-drift risk).

### Exports

```ts
export interface EchoResolvers {
  /** Resolve a variable id to its name; undefined if missing/deleted. */
  variableName(id: string): Promise<string | undefined>;
  /** Resolve a node id to its name; undefined if missing. */
  nodeName(id: string): string | undefined;
}

export async function encodeActionForListEcho(
  action: unknown,
  resolvers: EchoResolvers,
): Promise<unknown>;

export async function decodeConditionForEcho(
  condition: unknown,
  resolvers: EchoResolvers,
): Promise<unknown>;
```

`action` / `condition` stay loosely typed (`unknown`/`any` internally) — the input is arbitrary Figma runtime data and the functions already carry `UNKNOWN`/`raw` fallbacks.

### Behavior (preserved exactly from current `code.ts`)

`encodeActionForListEcho`:
- `CONDITIONAL`:
  - First try toggle_variable pattern via `detectTogglePattern(blocks)` → `{ type: "toggle_variable", variable: <name|`<id:..>`> }` (name via `resolvers.variableName`).
  - Else, if standard pattern (1–2 blocks, `blocks[0].condition` set, second block has no condition): decode condition via `decodeConditionForEcho`, recurse over `blocks[0].actions` (then) and optional `blocks[1].actions` (else) → `{ type: "CONDITIONAL", condition, then, else }`.
  - Else non-standard → `{ type: "CONDITIONAL", raw: blocks }`.
- `SET_VARIABLE`: resolve `variableId` → name via `resolvers.variableName`; if `variableValue` is a COLOR shape (`type==="COLOR"` with r/g/b), convert via `rgbToHex`, else pass `variableValue.value` → `{ type: "set_variable", variable, value }`.
- Default (`NODE`/`CLOSE`/`BACK`/`URL`/unknown): resolve `destinationId` → `destinationName` via `resolvers.nodeName`; passthrough `navigation`/`url`/`openInNewTab`/`destinationId`/`transition`/`resetScrollPosition`.

`decodeConditionForEcho`:
- `decodeConditionExpression(condition)` (existing pure decoder, returns variable **id**); if `raw` → `{ raw }`.
- Else resolve `decoded.variableId` → name via `resolvers.variableName` → `{ variable, operator, value, raw: <condition if name lost> }`.

### Imports (all already-pure modules)
- `detectTogglePattern`, `decodeConditionExpression` from `./condition-codec.js`
- `rgbToHex` from `./variable-literal.js`

### `code.ts` orchestration after extraction

```ts
const echoResolvers: EchoResolvers = {
  variableName: async (id) => {
    try { return (await figma.variables.getVariableByIdAsync(id))?.name; }
    catch { return undefined; }   // deleted variable
  },
  nodeName: (id) => figma.getNodeById(id)?.name ?? undefined,
};
```
`handleListReactions` calls `encodeActionForListEcho(firstAction, echoResolvers)`. The recursive `decodeConditionForEcho` call inside `encodeActionForListEcho` threads the same `resolvers` through.

---

## Module 2: `src/figma-plugin/node-tree.ts`

Minimal structural node interface + pure traversals.

```ts
export interface NodeLike {
  id: string;
  name: string;
  type: string;
  parent: NodeLike | null;
  reactions?: readonly unknown[];
  overflowDirection?: string;
}

export function findEnclosingFrameId(node: NodeLike): string | null;
export function hasReactions(node: NodeLike): boolean;
export function findScrollableAncestor(node: NodeLike): NodeLike | null;
export function pathOf(node: NodeLike): string;
```

Behavior preserved exactly:
- `findEnclosingFrameId` — walk `.parent` chain, return first `type === "FRAME"` id, else null.
- `hasReactions` — `"reactions" in node && Array.isArray(node.reactions) && node.reactions.length > 0`.
- `findScrollableAncestor` — walk `.parent` chain, return first ancestor with `"overflowDirection" in cur && cur.overflowDirection !== "NONE"`, else null.
- `pathOf` — unshift `.name` walking up until `type === "DOCUMENT"`, join with `" > "`.

**Critical constraint:** `NodeLike` MUST be defined so Figma's `BaseNode`/`SceneNode` are assignable to it **without casts** at the call sites in `code.ts`. This is the main friction risk:
- `reactions?: readonly unknown[]` (Figma's `reactions` is a `readonly` array — a mutable `unknown[]` field would reject it).
- `reactions` and `overflowDirection` optional (only some node types have them).
- `parent: NodeLike | null` must accept Figma's `(BaseNode & ChildrenMixin) | null` structurally.

`typecheck` is the gate. If a cast proves unavoidable at a boundary call site despite a faithful structural definition, a single localized `as NodeLike` at the call site is acceptable — but a clean structural fit is strongly preferred and should be attempted first.

`loadPage` stays in `code.ts` (impure: `figma.loadAllPagesAsync` + `getNodeById`).

### Call sites (signatures unchanged)
- `findScrollableAncestor` result is used only for a truthiness warning check (`buildNonConditionalAction`, ~line 167) — returning `NodeLike | null` is sufficient.
- `findEnclosingFrameId` / `hasReactions` / `pathOf` results are consumed as `string` / `boolean` / `string` — no dependence on a rich Figma return type.

---

## Tests

### `tests/action-echo.test.ts`
Fake resolvers injected as deterministic maps (`variableName: async (id) => map[id]`, `nodeName: (id) => map[id]`):
- NODE / CLOSE / BACK / URL passthrough (incl. `destinationName` via `nodeName`)
- SET_VARIABLE with COLOR (`rgbToHex`) and with a non-color scalar value
- CONDITIONAL standard pattern with then + else, recursively encoded
- toggle_variable pattern (via `detectTogglePattern`)
- non-standard CONDITIONAL → `{ type: "CONDITIONAL", raw }`
- deleted variable → `<id:...>` fallback (resolver returns undefined)
- `decodeConditionForEcho`: standard expression → `{ variable, operator, value }`; raw fallback; name-lost → keeps `raw`

### `tests/node-tree.test.ts`
Fake `NodeLike` trees built as plain objects:
- `findEnclosingFrameId`: nested → frame id; no FRAME → null
- `findScrollableAncestor`: ancestor with `overflowDirection !== "NONE"` → that node; none → null
- `hasReactions`: present / absent / empty array
- `pathOf`: builds `"A > B > C"`, stops at DOCUMENT

---

## Verification gates

- `npm run typecheck` — clean (especially `NodeLike` assignability and echo resolver types)
- `npm test` — existing 389 + new tests pass
- `npm run build:plugin` — succeeds; no zod in bundle; `grep` confirms the two new modules reference neither `figma.` nor `zod`
- `code.ts` LOC: 703 → ~570

## Documentation

Add a one-line glossary entry to `CONTEXT.md`: **Echo (list echo)** — re-encoding a built reaction back into the wire format returned by `list_reactions`.

## Out of scope

- `loadPage` (impure, stays).
- Any wire-format / behavior change (this is a pure extraction).
- Further `code.ts` decomposition beyond these two clusters.
