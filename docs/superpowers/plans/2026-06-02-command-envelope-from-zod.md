# Command envelope + handlers derive from zod Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De-mirror the prototype reaction shape — delete the dead reaction-shape types in `mcp-server/types.ts`, and make `figma-plugin/code.ts`'s `Command` envelope + all six handler signatures derive their param types from the zod-inferred `*Input` types via a type-only import (single source = the zod schemas).

**Architecture:** The zod schemas in `mcp-server/tools.ts` already export `z.infer` types for all six commands. `code.ts` imports them with `import type` (erased by tsup before bundling — no zod enters the plugin sandbox). The `Command` union's per-command `params` shapes were `any`-consumed (only `Command["type"]` is read), so this is purely a compile-time/documentation change with no runtime effect.

**Tech Stack:** TypeScript (strict, no `noUnusedLocals`), zod ^3.25, vitest, tsup (bundles `code.ts`; `import type` is erased).

---

## File structure

- **Modify** `src/mcp-server/types.ts` — delete dead `ReactionAction` + `ReactionConnectionInput`; remove the now-orphaned wire-vocabulary `import type` block.
- **Modify** `src/figma-plugin/code.ts` — add a type-only import of the six `*Input` types from `../mcp-server/tools.js`; replace the six `Command` union `params` shapes and the six handler signatures with those types; remove the now-orphaned wire-vocabulary `import type` block.

No new files, no test files (behavior-preserving; the existing 389-test suite + `tsc --noEmit` are the guards). The `Command` param shapes are `any`-consumed, so no runtime path changes.

Pre-verified facts (do not re-investigate):
- `mcp-server/tools.ts` exports all six: `GetCanvasOverviewInput`, `FindNodesInput`, `CreateReactionsInput`, `ListReactionsInput`, `ClearReactionsInput`, `SetFrameScrollInput` (as `z.infer<...>` types, lines 248–253).
- In `code.ts`, `ComparisonOperator` (imported from `./condition-codec.js`) is also used by `buildCondition` (~line 332) → KEEP it. `NonConditionalActionShape` (local type ~line 45) is also used by `buildNonConditionalAction` (~line 225) → KEEP it.
- The wire-vocabulary `import type { OverflowDirection, TriggerName, … Direction }` block (~lines 27–39) is used ONLY inside the two reaction-shape blocks being replaced → it becomes fully orphaned and must be removed.
- `tsconfig.json` has no `noUnusedLocals`, so orphaned imports compile silently — they must be removed by hand and confirmed by grep.

Commands: `npm test` (vitest, 389 tests), `npm run typecheck` (`tsc --noEmit`).

---

### Task 1: Delete dead reaction-shape types in `types.ts`

**Files:**
- Modify: `src/mcp-server/types.ts`

`ReactionAction` and `ReactionConnectionInput` are exported but referenced nowhere (confirmed by `git grep` across `src/` + `tests/`). They are dead documentation that duplicates the zod schema. Deleting them also orphans the wire-vocabulary import that Task 6 of the previous refactor added to feed them.

- [ ] **Step 1: Delete the two dead type declarations**

In `src/mcp-server/types.ts`, delete the entire `export type ReactionAction = …` block (the discriminated union ending with the `conditional` member whose `then`/`else` use `Exclude<ReactionAction, …>`) AND the entire `export interface ReactionConnectionInput { … }` block (the interface with `sourceNodeId` / `trigger?` / `afterTimeoutSeconds?` / `transition?` / `action: ReactionAction`).

Keep everything else: `CommandName`, `CommandRequest`, `CommandResponse`, and the node-info type(s).

- [ ] **Step 2: Remove the now-orphaned wire-vocabulary import**

The `import type { … } from "../shared/wire-vocabulary.js"` block at the top of `types.ts` (added in the prior Candidate C Task 6) was used only by the two deleted types. Delete that entire `import type { … }` block.

- [ ] **Step 3: Verify the deletions and that nothing else referenced them**

Run: `git grep -n 'ReactionConnectionInput\|ReactionAction' src tests`
Expected: NO matches.

Run: `git grep -n 'wire-vocabulary' src/mcp-server/types.ts`
Expected: NO matches.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean (no output). Confirms nothing depended on the deleted types or import.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: 389 passed.

- [ ] **Step 6: Commit**

```bash
git add src/mcp-server/types.ts
git commit -m "refactor(server): delete dead ReactionAction/ReactionConnectionInput from types.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Derive `code.ts` Command union + handlers from zod

**Files:**
- Modify: `src/figma-plugin/code.ts`

Replace the inline param shapes (six `Command` union members + six handler signatures) with the zod-inferred `*Input` types, then remove the orphaned wire-vocabulary import.

- [ ] **Step 1: Add the type-only import of the six `*Input` types**

In `src/figma-plugin/code.ts`, add this near the other imports (e.g. immediately after the `} from "./condition-codec.js";` import, before the wire-vocabulary import that will be deleted in Step 5):

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

(Type-only — erased by tsup, so no zod enters the plugin bundle.)

- [ ] **Step 2: Replace the six `Command` union member `params` shapes**

In the `type Command = …` union, replace each member's inline `params` object type with the imported type. The result must read exactly:

```ts
type Command =
  | { type: "GET_CANVAS_OVERVIEW"; params: GetCanvasOverviewInput }
  | { type: "FIND_NODES"; params: FindNodesInput }
  | { type: "CREATE_REACTIONS"; params: CreateReactionsInput }
  | { type: "LIST_REACTIONS"; params: ListReactionsInput }
  | { type: "CLEAR_REACTIONS"; params: ClearReactionsInput }
  | { type: "SET_FRAME_SCROLL"; params: SetFrameScrollInput };
```

This deletes the large inline `CREATE_REACTIONS` block (the `connections: Array<{ sourceNodeId … trigger … transition … action … }>; replaceExisting: boolean` shape) and the smaller inline shapes for the other five commands.

- [ ] **Step 3: Replace the six handler signatures**

Replace each handler's inline parameter type with the matching imported type. Keep each function body unchanged.

```ts
async function handleGetCanvasOverview(params: GetCanvasOverviewInput) {
```
```ts
async function handleFindNodes(params: FindNodesInput) {
```
```ts
async function handleCreateReactions(params: CreateReactionsInput) {
```
```ts
async function handleListReactions(params: ListReactionsInput) {
```
```ts
async function handleClearReactions(params: ClearReactionsInput) {
```
```ts
async function handleSetFrameScroll(params: SetFrameScrollInput) {
```

For `handleCreateReactions` and `handleSetFrameScroll`, this replaces a multi-line inline param type with the single named type; delete the now-removed inline object-type lines entirely (down to and including the closing `}) {` of the old param, replaced by `params: <Type>) {`).

- [ ] **Step 4: Run typecheck and reconcile any handler-body friction**

Run: `npm run typecheck`

Expected: clean. If `tsc` reports an error inside a handler body (most likely in `handleCreateReactions`, where `connection.trigger` / `connection.transition` are passed to `buildNonConditionalAction(… trigger: TriggerInput, … transition: TransitionInput)`, or `connection.action`'s `then`/`else` items are passed where `NonConditionalActionShape` is expected):

- These shapes are expected to be structurally identical post-Candidate-C (both derive their member literals from the shared wire vocabulary), so most likely there is NO error.
- If there IS an error, reconcile MINIMALLY at the call site — e.g. confirm the field is structurally assignable; if a discriminated-union inference quirk blocks it, narrow with an explicit annotation at the call site. Do NOT change the zod schema in `tools.ts`, the shared `wire-vocabulary.ts`, or the `reaction-builder` types to work around it.
- If the friction cannot be resolved with a minimal local change, STOP and report BLOCKED with the exact `tsc` error.

- [ ] **Step 5: Remove the orphaned wire-vocabulary import block**

After Steps 2–3, the `import type { OverflowDirection, TriggerName, TriggerNoParamType, MouseClickType, MouseHoverType, KeyboardDevice, TransitionName, SimpleTransitionType, DirectionalTransitionType, NamedEasingName, Direction } from "../shared/wire-vocabulary.js";` block is fully unused (its only use sites were the two replaced reaction-shape blocks). Delete the entire `import type { … } from "../shared/wire-vocabulary.js";` block.

Do NOT touch:
- the `import type { ComparisonOperator } …`-style import from `./condition-codec.js` (still used by `buildCondition`),
- the local `type NonConditionalActionShape = …` declaration (still used by `buildNonConditionalAction`),
- any `reaction-builder.js` import (`TriggerInput`, `TransitionInput`, `BuiltAction`, etc. still used by handler bodies).

- [ ] **Step 6: Verify the de-mirroring via grep**

Run: `git grep -n 'from "../shared/wire-vocabulary.js"' src/figma-plugin/code.ts`
Expected: NO matches (the block is gone).

Run: `git grep -n 'sourceNodeId: string;' src/figma-plugin/code.ts`
Expected: NO matches — the inline reaction-shape literals (which were the only places this appeared) are gone.

Run: `git grep -n 'ComparisonOperator\|NonConditionalActionShape' src/figma-plugin/code.ts`
Expected: STILL present (these are kept — `ComparisonOperator` in `buildCondition`, `NonConditionalActionShape` in `buildNonConditionalAction`).

- [ ] **Step 7: Typecheck + full suite**

Run: `npm run typecheck`
Expected: clean.

Run: `npm test`
Expected: 389 passed (no behavior change — `Command` params were `any`-consumed).

- [ ] **Step 8: Build the plugin bundle to confirm no zod leaked in**

Run: `npm run build:plugin`
Expected: builds successfully. (Sanity check that the type-only import from `mcp-server/tools.ts` did not pull zod into the IIFE bundle — `import type` is erased, so the build must still succeed with `noExternal: [/.*/]`.)

- [ ] **Step 9: Commit**

```bash
git add src/figma-plugin/code.ts
git commit -m "refactor(plugin): derive code.ts Command + handler params from zod *Input types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Why type-only import is safe for the plugin bundle:** `code.ts` is bundled by tsup with `noExternal: [/.*/]`. A `import type { … }` is stripped by esbuild before bundling, so importing from `mcp-server/tools.ts` (which `import`s zod) brings in zero runtime code. Step 8 confirms this empirically.
- **Why no runtime change:** `dispatch(command, params: any)` passes params untyped, and `msg.envelope as { … params: any }` reads only `Command["type"]`. The `Command` union's `params` shapes were never type-checked against real values — pure documentation that now stays in sync with the schema for free.
- **The `find_nodes` redundancy is expected:** `FindNodesInput` (z.infer output) makes `scope` and `limit` required (they have `.default()`s, applied by the server before the plugin receives them). The handler body's `params.scope ?? "page"` becomes harmlessly redundant — leave it; it is still correct and changing it is out of scope.
