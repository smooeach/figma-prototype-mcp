# Design: Command envelope + handlers derive from zod (reaction-shape de-mirror)

**Date:** 2026-06-02
**Type:** Internal refactor (behavior-preserving, no version bump)
**Status:** Approved — ready for implementation plan

## Problem

The Candidate C follow-up. The full prototype **reaction shape** (and every other
command's params) is hand-maintained as TypeScript in three places that drift
independently of the zod schemas in `src/mcp-server/tools.ts`:

1. `src/mcp-server/types.ts` — `ReactionAction` + `ReactionConnectionInput`.
2. `src/figma-plugin/code.ts` — the `Command` discriminated union's per-command
   `params` shapes (all six commands).
3. `src/figma-plugin/code.ts` — each handler's inline parameter type
   (`handleCreateReactions`, `handleFindNodes`, …).

Exploration findings that shape the fix:

- `ReactionConnectionInput` is **referenced nowhere** (grep across `src/` + `tests/`);
  `ReactionAction` is used only inside that unused type. The whole block is **dead
  documentation** that drifts from the real schema.
- `code.ts`'s `Command` union is consumed only as `Command["type"]` (the command-name
  union); `dispatch(command, params: any)` passes params untyped. So the `Command`
  union's per-command `params` shapes are **documentation only** — never type-checked
  against real values.
- Only the **handler parameter types** are load-bearing (they type the handler bodies).

The genuine single source already exists: the zod schemas in `mcp-server/tools.ts`,
which both validate input and export `z.infer` types. All six are already exported:
`GetCanvasOverviewInput`, `FindNodesInput`, `CreateReactionsInput`,
`ListReactionsInput`, `ClearReactionsInput`, `SetFrameScrollInput`.

## Goal

Make `code.ts`'s `Command` envelope and all six handler signatures derive their param
types from the zod-inferred types via a **type-only import**, and delete the dead
reaction-shape types in `types.ts`. After this, the reaction shape (and every command
param shape) lives once — in the zod schema. Behavior unchanged; the param shapes were
`any`-consumed, so there is no runtime effect.

## Approach (chosen)

**Derive from zod via `import type`** (the user-selected approach), applied to **all
six commands** (the user-selected scope).

A type-only import is erased by tsup/esbuild before bundling, so importing from
`mcp-server/tools.ts` (which imports zod) pulls **no zod** into the plugin sandbox
bundle. The inferred *output* types already match what the plugin receives: the server
`.parse()`s input (applying `.default()`s) and forwards the parsed result, so defaulted
fields (`trigger`, `transition`, `replaceExisting`, `scope`, `limit`) are present —
exactly what the `z.infer` output type declares.

Rejected alternative (from brainstorming): delete-dead + dedupe-within-`code.ts` only,
keeping the plugin's receive-type hand-written locally. Lower coupling but leaves the
plugin shape drifting from the schema; the type-only import erases at build, so the
coupling cost is purely compile-time and the single-source benefit is worth it.

## Changes

### `src/mcp-server/types.ts`
- Delete `ReactionAction` and `ReactionConnectionInput` (zero references — dead code).
- Keep the live envelope types: `CommandName`, `CommandRequest`, `CommandResponse`, and
  the node-info type(s).
- The wire-vocabulary `import type { … }` block added in the prior Candidate C task
  (Task 6) existed only to feed those two deleted types. After deletion it is unused —
  **remove it**, returning `types.ts` to (near) import-free.

### `src/figma-plugin/code.ts`
- Add a type-only import:
  ```ts
  import type {
    GetCanvasOverviewInput,
    FindNodesInput,
    CreateReactionsInput,
    ListReactionsInput,
    ClearReactionsInput,
    SetFrameScrollInput,
  } from "../mcp-server/tools.js";
  ```
- `Command` union — replace each member's inline `params` shape with the import:
  | command | params type |
  |---|---|
  | `GET_CANVAS_OVERVIEW` | `GetCanvasOverviewInput` |
  | `FIND_NODES` | `FindNodesInput` |
  | `CREATE_REACTIONS` | `CreateReactionsInput` |
  | `LIST_REACTIONS` | `ListReactionsInput` |
  | `CLEAR_REACTIONS` | `ClearReactionsInput` |
  | `SET_FRAME_SCROLL` | `SetFrameScrollInput` |
- Replace each of the six handler signatures' inline param type with the matching
  imported type.
- Clean up local types orphaned by the replacement:
  - `NonConditionalActionShape` — if used only inside the deleted `Command`
    `CREATE_REACTIONS` inline block, delete it; if also used in a handler body, keep it.
  - The `import type { OverflowDirection } from "../shared/wire-vocabulary.js"` — if
    `SetFrameScrollInput` now covers its only use site, remove it; if `OverflowDirection`
    is still referenced elsewhere in `code.ts`, keep it.
  - Remove any other import left unused by the change (verified via typecheck).

### Risk reconciliation
The one real risk: `handleCreateReactions`'s body passes `connection.trigger` /
`connection.transition` to `reaction-builder`'s `build*` functions, which accept
`reaction-builder`'s own `TriggerInput` / `TransitionInput`. After this change those
arguments are typed as the **zod-inferred** `CreateReactionsInput["connections"][number]`
fields. Post-Candidate-C both sides derive their member literals from the same shared
vocabulary, so the shapes are expected to be structurally identical and assignment
should type-check. If `tsc` surfaces a structural mismatch, reconcile minimally (narrow
or adapt at the call site) — do **not** change the zod schema or the shared vocabulary
to paper over it. The full test suite + typecheck is the gate.

## Testing & verification

- `npm test` stays green (389 tests). `npm run typecheck` stays clean. No new behavior —
  the `Command` param shapes were `any`-consumed, so no runtime change.
- Greps confirm de-mirroring:
  - `git grep -n 'ReactionConnectionInput\|ReactionAction' src` → no matches.
  - The `Command` union members and handler signatures in `code.ts` reference the
    imported `*Input` types, with no inline `{ sourceNodeId … trigger … transition … }`
    reaction-shape literals remaining.

## Out of scope

- Action-intent type names (`navigate`/`scroll`/…) ↔ Figma shape names
  (`NODE`/`NAVIGATE`/`CLOSE`/…) — a deliberate translation in the builder, not
  duplication.
- `reaction-builder`'s `build*` input/output types (`BuiltAction`, etc.).
- No version bump — same internal-refactor policy as the prior Candidate C work.
