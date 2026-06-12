# get_prototype_flow (Prototype Flow Read) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a low-level read tool `get_prototype_flow` that returns a page's whole prototype interaction graph (frames + every wired interaction, decoded) in one call.

**Architecture:** A pure assembler (`flow-graph.ts`) shapes the final output from already-decoded interaction records; the figma-bound plugin handler scans the page for reactive nodes and decodes each reaction by **reusing** `encodeActionForListEcho` + `echoResolvers` (the same path `list_reactions` uses). MCP wiring (schema, CommandName, tool registration) mirrors the existing `get_canvas_overview` read tool.

**Tech Stack:** TypeScript, zod, vitest, tsup (plugin bundle), Figma plugin API (`page.findAll`, `node.reactions`, `flowStartingPoints`).

**Scope:** page-scoped read (optional `pageId`), all reaction kinds, raw graph (no analytics). Spec: `docs/superpowers/specs/2026-06-12-prototype-flow-read-design.md`.

---

## File structure

- `src/figma-plugin/flow-graph.ts` — **new, pure.** `assembleFlowGraph(...)` + its types. Unit-tested.
- `src/figma-plugin/code.ts` — add `GET_PROTOTYPE_FLOW` to the `Command` union, a dispatch case, and `handleGetPrototypeFlow` (figma-bound scan + echo reuse).
- `src/mcp-server/tools.ts` — add `GetPrototypeFlowInput` zod schema + exported type.
- `src/mcp-server/types.ts` — add `"GET_PROTOTYPE_FLOW"` to the `CommandName` union.
- `src/server/tools.ts` — register the `get_prototype_flow` read tool (name/description/schema/command).
- Tests: `tests/flow-graph.test.ts` (new), `tests/tools.test.ts` (schema parse).

---

## Task 1: Pure assembler `flow-graph.ts`

**Files:**
- Create: `src/figma-plugin/flow-graph.ts`
- Test: `tests/flow-graph.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/flow-graph.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { assembleFlowGraph } from "../src/figma-plugin/flow-graph.js";

const page = { id: "1:1", name: "Flow" };
const frames = [
  { id: "1:10", name: "login", isStartFrame: true },
  { id: "1:20", name: "home", isStartFrame: false },
];

describe("assembleFlowGraph", () => {
  it("resolves frameName from frameId and passes interactions through", () => {
    const out = assembleFlowGraph({
      page, frames, limit: 500,
      interactions: [
        { frameId: "1:10", sourceNodeId: "1:11", sourceNodeName: "loginBtn", trigger: { type: "ON_CLICK" }, action: { type: "NODE", navigation: "NAVIGATE", destinationId: "1:20" } },
      ],
    });
    expect(out).toEqual({
      page, frames, truncated: false,
      interactions: [
        { frameId: "1:10", frameName: "login", sourceNodeId: "1:11", sourceNodeName: "loginBtn", trigger: { type: "ON_CLICK" }, action: { type: "NODE", navigation: "NAVIGATE", destinationId: "1:20" } },
      ],
    });
  });

  it("sets frameName null when frameId is null or unknown", () => {
    const out = assembleFlowGraph({
      page, frames, limit: 500,
      interactions: [
        { frameId: null, sourceNodeId: "1:99", sourceNodeName: "loose", trigger: {}, action: {} },
        { frameId: "9:99", sourceNodeId: "1:98", sourceNodeName: "orphan", trigger: {}, action: {} },
      ],
    });
    expect(out.interactions[0]!.frameName).toBeNull();
    expect(out.interactions[1]!.frameName).toBeNull();
  });

  it("applies limit and sets truncated", () => {
    const mk = (i: number) => ({ frameId: "1:10", sourceNodeId: `n${i}`, sourceNodeName: `n${i}`, trigger: {}, action: {} });
    const out = assembleFlowGraph({ page, frames, limit: 2, interactions: [mk(1), mk(2), mk(3)] });
    expect(out.interactions).toHaveLength(2);
    expect(out.truncated).toBe(true);
  });

  it("handles empty interactions", () => {
    const out = assembleFlowGraph({ page, frames, limit: 500, interactions: [] });
    expect(out.interactions).toEqual([]);
    expect(out.truncated).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/flow-graph.test.ts`
Expected: FAIL — `assembleFlowGraph` not found (module doesn't exist).

- [ ] **Step 3: Write minimal implementation**

Create `src/figma-plugin/flow-graph.ts`:

```typescript
// Pure assembler for get_prototype_flow output. No figma.* — the handler does the
// figma-bound scan + decode, then calls this to shape the result. Unit-testable.

export interface FlowFrame {
  id: string;
  name: string;
  isStartFrame: boolean;
}

/** An interaction record as produced by the handler (action already echo-decoded). */
export interface RawInteraction {
  frameId: string | null;
  sourceNodeId: string;
  sourceNodeName: string;
  trigger: unknown;
  action: unknown;
}

export interface FlowInteraction extends RawInteraction {
  frameName: string | null;
}

export interface FlowGraph {
  page: { id: string; name: string };
  frames: FlowFrame[];
  interactions: FlowInteraction[];
  truncated: boolean;
}

/**
 * Shape the final flow graph: resolve each interaction's frameName from the frame
 * list, cap to `limit`, and flag truncation. Pure.
 */
export function assembleFlowGraph(input: {
  page: { id: string; name: string };
  frames: FlowFrame[];
  interactions: RawInteraction[];
  limit: number;
}): FlowGraph {
  const nameById = new Map(input.frames.map((f) => [f.id, f.name]));
  const limited = input.interactions.slice(0, input.limit);
  const interactions: FlowInteraction[] = limited.map((i) => ({
    ...i,
    frameName: i.frameId !== null ? (nameById.get(i.frameId) ?? null) : null,
  }));
  return {
    page: input.page,
    frames: input.frames,
    interactions,
    truncated: input.interactions.length > input.limit,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/flow-graph.test.ts` → PASS.
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/flow-graph.ts tests/flow-graph.test.ts
git commit -m "feat(flow): pure assembleFlowGraph (frames + interactions shaper)"
```

---

## Task 2: MCP wiring — schema, CommandName, tool registration

**Files:**
- Modify: `src/mcp-server/tools.ts` (add schema near `GetCanvasOverviewInput` at line 17, and the exported type near line 299)
- Modify: `src/mcp-server/types.ts` (add to `CommandName`, lines 3-10)
- Modify: `src/server/tools.ts` (import the schema; register the tool after the `get_canvas_overview` entry)
- Test: `tests/tools.test.ts`

This task adds the MCP-facing surface only. tsc stays green because `code.ts`'s own `Command` union is separate (the plugin simply won't handle the command yet — that's Task 3).

- [ ] **Step 1: Write the failing test**

Add to `tests/tools.test.ts` (it already imports from `../src/mcp-server/tools.js`; add `GetPrototypeFlowInput` to that import):

```typescript
describe("GetPrototypeFlowInput", () => {
  it("defaults limit to 500 and allows optional pageId", () => {
    expect(GetPrototypeFlowInput.parse({})).toEqual({ limit: 500 });
    expect(GetPrototypeFlowInput.parse({ pageId: "1:2" })).toEqual({ pageId: "1:2", limit: 500 });
  });
  it("rejects a non-positive limit", () => {
    expect(() => GetPrototypeFlowInput.parse({ limit: 0 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools.test.ts`
Expected: FAIL — `GetPrototypeFlowInput` is not exported / undefined.

- [ ] **Step 3: Write minimal implementation**

(a) In `src/mcp-server/tools.ts`, right after `GetCanvasOverviewInput` (line 17-19), add:

```typescript
export const GetPrototypeFlowInput = z.object({
  pageId: z.string().optional(),
  limit: z.number().int().positive().max(2000).default(500),
});
```

And near the other type exports (around line 299, beside `export type GetCanvasOverviewInput = ...`), add:

```typescript
export type GetPrototypeFlowInput = z.infer<typeof GetPrototypeFlowInput>;
```

(b) In `src/mcp-server/types.ts`, add the new literal to the `CommandName` union (lines 3-10):

```typescript
export type CommandName =
  | "GET_CANVAS_OVERVIEW"
  | "GET_PROTOTYPE_FLOW"
  | "FIND_NODES"
  | "LIST_VARIABLES"
  | "CREATE_REACTIONS"
  | "LIST_REACTIONS"
  | "CLEAR_REACTIONS"
  | "SET_FRAME_SCROLL";
```

(c) In `src/server/tools.ts`: add `GetPrototypeFlowInput` to the existing import from `../mcp-server/tools.js` (alongside `GetCanvasOverviewInput`), then register the tool immediately after the `get_canvas_overview` entry (after its closing `},` ~line 79):

```typescript
    {
      name: "get_prototype_flow",
      description:
        "Return the whole prototype interaction graph of a page in ONE call: its frames " +
        "(each with `isStartFrame`) and every wired interaction — `{ frameId, frameName, sourceNodeId, " +
        "sourceNodeName, trigger, action }`. `action` is decoded exactly as `list_reactions` returns it " +
        "(navigate / scroll / overlay / swap / close / back / url / change_to / set_variable / " +
        "toggle_variable / conditional incl. all/any compound). Use this to see what is ALREADY wired " +
        "before adding more (avoid duplicates, check what a screen connects to); for a single node use " +
        "list_reactions. Page-scoped — optional `pageId` (defaults to current page); `limit` caps " +
        "interactions (default 500) and sets `truncated`.",
      schema: GetPrototypeFlowInput,
      command: "GET_PROTOTYPE_FLOW" as CommandName,
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools.test.ts` → PASS.
Run: `npm test` (full) and `npx tsc --noEmit` → both green. (If any existing test enumerates the tool list and breaks on the new entry, update that assertion to include `get_prototype_flow`.)

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/tools.ts src/mcp-server/types.ts src/server/tools.ts tests/tools.test.ts
git commit -m "feat(tools): register get_prototype_flow read tool (schema + CommandName)"
```

---

## Task 3: Plugin handler `handleGetPrototypeFlow`

**Files:**
- Modify: `src/figma-plugin/code.ts` — imports, `Command` union (line 53-61), dispatch switch (line ~100-105), new handler near the other read handlers (after `handleGetCanvasOverview`, ~line 417).

No new unit test (the scan + echo are figma-bound, same as the other `handle*` read functions; the pure assembler is already tested in Task 1, and the echo in action-echo tests). Verified by `tsc` + full suite + the live probe in Task 4.

- [ ] **Step 1: Add imports**

In `src/figma-plugin/code.ts`:
- Add `GetPrototypeFlowInput` to the existing import from the mcp-server tools module (the same block that imports `GetCanvasOverviewInput` — around line 40).
- Add a new import for the assembler (include `RawInteraction` so the array can be typed):

```typescript
import { assembleFlowGraph, type RawInteraction } from "./flow-graph.js";
```

`findEnclosingFrameId` is already imported (used by `handleGetCanvasOverview`); `encodeActionForListEcho` + `echoResolvers` already exist in this file.

- [ ] **Step 2: Add to the `Command` union**

In the `Command` type (lines 53-61), add after the `GET_CANVAS_OVERVIEW` line:

```typescript
  | { type: "GET_PROTOTYPE_FLOW"; params: GetPrototypeFlowInput }
```

- [ ] **Step 3: Add the dispatch case**

In the command `switch` (near line 100), after the `GET_CANVAS_OVERVIEW` case:

```typescript
      case "GET_PROTOTYPE_FLOW":   return { status: "ok", result: await handleGetPrototypeFlow(params) };
```

- [ ] **Step 4: Add the handler**

Immediately after `handleGetCanvasOverview` (ends ~line 417), add:

```typescript
async function handleGetPrototypeFlow(params: GetPrototypeFlowInput) {
  const page = await loadPage(params.pageId);
  const limit = params.limit ?? 500;

  const frames = page.children
    .filter((n) => n.type === "FRAME")
    .map((f) => ({
      id: f.id,
      name: f.name,
      isStartFrame: page.flowStartingPoints?.some((p) => p.nodeId === f.id) ?? false,
    }));

  const reactiveNodes = page.findAll(
    (n) => "reactions" in n && (((n as { reactions?: readonly unknown[] }).reactions?.length ?? 0) > 0),
  );

  const interactions: RawInteraction[] = [];
  for (const node of reactiveNodes) {
    const frameId = node.type === "FRAME" ? node.id : findEnclosingFrameId(node);
    const reactions = ((node as { reactions?: readonly any[] }).reactions ?? []) as any[];
    for (const r of reactions) {
      const firstAction = r.actions?.[0] ?? r.action ?? {};
      interactions.push({
        frameId,
        sourceNodeId: node.id,
        sourceNodeName: node.name,
        trigger: r.trigger ?? { type: "UNKNOWN" },
        action: await encodeActionForListEcho(firstAction, echoResolvers),
      });
    }
  }

  return assembleFlowGraph({ page: { id: page.id, name: page.name }, frames, interactions, limit });
}
```

Note: `findEnclosingFrameId(node)` is called the same way `handleGetCanvasOverview` calls it (figma nodes structurally satisfy `NodeLike`; no cast). The `interactions` array is typed `RawInteraction[]` (imported in Step 1) so `.push` of the record literal type-checks; if the record shape ever drifts from `RawInteraction`, `tsc` flags it here.

- [ ] **Step 5: Verify build + types**

Run: `npx tsc --noEmit` → clean.
Run: `npm test` → all pass.
Run: `npm run build:plugin` → `Build success`.

- [ ] **Step 6: Commit**

```bash
git add src/figma-plugin/code.ts
git commit -m "feat(plugin): handleGetPrototypeFlow scans reactive nodes + reuses list_reactions echo"
```

---

## Task 4: Live probe (ship gate)

**Files:** none committed (throwaway probe script; delete after).

The project's live-verify gate — confirms the figma-bound scan/echo works end-to-end against a real page (`page.findAll`, `flowStartingPoints`, enclosing-frame grouping).

- [ ] **Step 1: Build + start server**

```bash
npm run build:plugin
npm start   # background; wait for "[server] listening on http://localhost:3000"
```
Reload the plugin in Figma so it runs the new bundle. Keep Figma/Claude Desktop the SOLE SSE client (single-active newest-wins) — only one probe client at a time.

- [ ] **Step 2: Set up a page with a few wired interactions**

On a real page, ensure there are at least: one NAVIGATE (frame→frame), one CONDITIONAL (ideally an `all`/`any` compound), and one SET_VARIABLE or CHANGE_TO — wired via our `proto_*` tools (an SSE probe using `SSEClientTransport` to `http://localhost:3000/sse`, the pattern from prior probes). Note the page id (or leave default current page).

- [ ] **Step 3: Call get_prototype_flow and verify**

Call `get_prototype_flow` with `{}` (current page).

**Expected:**
- `frames` lists the page's frames; the entry/start frame has `isStartFrame: true` (matches Figma's flow start point).
- `interactions` contains one entry per wired reaction; each has the correct `frameId`/`frameName` (the screen the source node sits on) and a `trigger`.
- Each `action` is byte-for-byte what `list_reactions` returns for that same node+reaction (spot-check one navigate and the conditional by also calling `list_reactions` on that node and diffing the `action`).
- `truncated` is `false` for a small page.

- [ ] **Step 4: Edge checks**

- A frame with no interactions still appears in `frames` (a dead-end screen is visible).
- A node carrying 2 reactions produces 2 `interactions` entries.
- If anything in the echo is unexpected, it appears as `{ raw }` rather than throwing (the whole call must never fail on one odd reaction).

- [ ] **Step 5: Clean up**

Delete the throwaway probe script; stop the server if no longer needed. (No reactions were created by this read-only probe beyond the setup in Step 2 — clear those if they were scratch.)

- [ ] **Step 6 (if the probe surfaces a fix): record + adjust**

If `findAll` misses a reactive node kind, `flowStartingPoints` reads differently than expected, or grouping is wrong, fix in `code.ts` (scan/handler) or `flow-graph.ts` (shaping) with a matching unit test where the logic is pure, then re-probe.

---

## Notes for the implementer

- **Run order:** Task 1 (pure assembler) → Task 2 (MCP wiring; tsc green, plugin not yet handling) → Task 3 (plugin handler; tsc green, now handled) → Task 4 (live gate). Tasks 1 and 2 are independent; Task 3 depends on both.
- **Reuse, don't reinvent:** the per-reaction decode MUST be `encodeActionForListEcho(firstAction, echoResolvers)` — the identical call `handleListReactions` makes — so `get_prototype_flow` and `list_reactions` always agree on the `action` shape.
- **No version bump inside tasks.** Versioning/release (tag, gh release, memory) happens after the live probe passes, as a separate wrap-up — mirrors prior feature releases (this is an 18th tool → likely v0.29.0).
