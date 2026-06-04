# Echo + node-tree extraction (code.ts testability) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract two clusters of pure logic out of the Figma-sandbox file `src/figma-plugin/code.ts` into unit-testable modules — `node-tree.ts` (node traversals) and `action-echo.ts` (list_reactions echo encoding) — behind minimal seams, leaving `figma.*` lookups in `code.ts` as thin orchestration.

**Architecture:** Follows the established testability-refactor pattern (`variable-literal.ts`, `condition-codec.ts`). `node-tree.ts` exposes pure functions over a minimal structural `NodeLike` interface that Figma's `BaseNode`/`SceneNode` satisfy without casts. `action-echo.ts` keeps the structural transform + recursion pure and takes an injected `EchoResolvers` object for the two impure id→name lookups (variable name via `getVariableByIdAsync`, node name via `getNodeById`). Behavior-preserving — the wire/echo output is byte-identical.

**Tech Stack:** TypeScript (strict, no `noUnusedLocals`), vitest, tsup (bundles `src/figma-plugin/` + `src/shared/` into the plugin IIFE; the new modules must reference neither `figma.*` nor `zod`).

---

## File structure

- **Create** `src/figma-plugin/node-tree.ts` — `NodeLike` interface + pure `findEnclosingFrameId` / `hasReactions` / `findScrollableAncestor` / `pathOf`.
- **Create** `tests/node-tree.test.ts` — plain-object `NodeLike` trees.
- **Create** `src/figma-plugin/action-echo.ts` — `EchoResolvers` interface + pure `encodeActionForListEcho` / `decodeConditionForEcho`.
- **Create** `tests/action-echo.test.ts` — deterministic fake resolvers + `buildConditionExpression` to construct condition inputs.
- **Modify** `src/figma-plugin/code.ts` — delete the four node-tree functions (lines 110–135 and 339–347) and the two echo functions (lines 496–612); import them; construct figma-backed resolvers; pass them at the `handleListReactions` call site.
- **Modify** `CONTEXT.md` — add one glossary line for "Echo (list echo)".

Pre-verified facts (do not re-investigate):
- `tsconfig.json` has no `noUnusedLocals`, so orphaned code compiles silently — confirm removals by `grep`.
- Existing pure modules already imported by `code.ts`: `decodeConditionExpression`, `detectTogglePattern`, `ComparisonOperator` from `./condition-codec.js` (lines 21–26); `validateVariableLiteralCompat`, `rgbToHex` from `./variable-literal.js` (line 20).
- `decodeConditionExpression(condition)` returns `{ variableId: string | undefined; operator: string; value: ... } | { raw: unknown }` (it does NOT resolve the variable name — the caller does).
- `rgbToHex({ r:1, g:0, b:0, a:1 })` → `"#FF0000"` (alpha of 1 is dropped); uppercase hex.
- `buildConditionExpression({ variableId, resolvedType, operator, literal })` builds the EXPRESSION condition; boolean literal shape is `{ type: "BOOLEAN", resolvedType: "BOOLEAN", value: true }`.
- Node-tree call sites in `code.ts`: `findScrollableAncestor` at line 167 (result used only for a truthiness warning check); `findEnclosingFrameId` at 298 & 332; `hasReactions` at 299; `pathOf` at 333. Inputs are Figma `SceneNode` (selection) and `BaseNode` (findAll results).
- Echo call site: `handleListReactions` at line 628 (`action: await encodeActionForListEcho(firstAction)`); `decodeConditionForEcho` is called recursively from inside `encodeActionForListEcho`.

Commands: `npm test` (vitest), `npm run typecheck` (`tsc --noEmit`), `npm run build:plugin` (tsup IIFE).

---

### Task 1: Extract node traversals into `node-tree.ts`

**Files:**
- Create: `src/figma-plugin/node-tree.ts`
- Test: `tests/node-tree.test.ts`
- Modify: `src/figma-plugin/code.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/node-tree.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  findEnclosingFrameId,
  hasReactions,
  findScrollableAncestor,
  pathOf,
  type NodeLike,
} from "../src/figma-plugin/node-tree.js";

// Build a top-down chain: doc -> frame -> child
const doc: NodeLike = { id: "0", name: "Document", type: "DOCUMENT", parent: null };
const frame: NodeLike = { id: "f1", name: "Frame", type: "FRAME", parent: doc };
const child: NodeLike = { id: "c1", name: "Child", type: "TEXT", parent: frame };

describe("findEnclosingFrameId", () => {
  it("returns the nearest FRAME ancestor id", () => {
    expect(findEnclosingFrameId(child)).toBe("f1");
  });
  it("returns null when no FRAME ancestor exists", () => {
    expect(findEnclosingFrameId(frame)).toBe(null); // frame's only ancestor is the DOCUMENT
  });
});

describe("hasReactions", () => {
  it("is true for a non-empty reactions array", () => {
    expect(hasReactions({ id: "a", name: "a", type: "TEXT", parent: null, reactions: [{}] })).toBe(true);
  });
  it("is false for an empty reactions array", () => {
    expect(hasReactions({ id: "a", name: "a", type: "TEXT", parent: null, reactions: [] })).toBe(false);
  });
  it("is false when reactions is absent", () => {
    expect(hasReactions({ id: "a", name: "a", type: "TEXT", parent: null })).toBe(false);
  });
});

describe("findScrollableAncestor", () => {
  it("returns the nearest ancestor whose overflowDirection is not NONE", () => {
    const scroll: NodeLike = { id: "s1", name: "Scroll", type: "FRAME", parent: doc, overflowDirection: "VERTICAL" };
    const leaf: NodeLike = { id: "l1", name: "Leaf", type: "TEXT", parent: scroll };
    expect(findScrollableAncestor(leaf)).toBe(scroll);
  });
  it("skips ancestors with overflowDirection NONE and returns null when none scroll", () => {
    const noscroll: NodeLike = { id: "n1", name: "NoScroll", type: "FRAME", parent: doc, overflowDirection: "NONE" };
    const leaf: NodeLike = { id: "l2", name: "Leaf", type: "TEXT", parent: noscroll };
    expect(findScrollableAncestor(leaf)).toBe(null);
  });
});

describe("pathOf", () => {
  it("joins names from the node up to (but excluding) the DOCUMENT", () => {
    expect(pathOf(child)).toBe("Frame > Child");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- node-tree`
Expected: FAIL — cannot resolve `../src/figma-plugin/node-tree.js` (module does not exist yet).

- [ ] **Step 3: Create the module**

Create `src/figma-plugin/node-tree.ts`:

```ts
// Pure node-tree traversals over a minimal structural node shape.
// NodeLike is a structural supertype of Figma's BaseNode/SceneNode for the
// fields these helpers read, so real Figma nodes are assignable without casts.
// No figma.* / zod references — safe inside the plugin bundle.

export interface NodeLike {
  id: string;
  name: string;
  type: string;
  parent: NodeLike | null;
  reactions?: readonly unknown[];
  overflowDirection?: string;
}

/** Nearest FRAME ancestor's id, or null. (Starts at node.parent — excludes the node itself.) */
export function findEnclosingFrameId(node: NodeLike): string | null {
  let cur: NodeLike | null = node.parent;
  while (cur) {
    if (cur.type === "FRAME") return cur.id;
    cur = cur.parent;
  }
  return null;
}

/** Whether the node carries at least one reaction. */
export function hasReactions(node: NodeLike): boolean {
  return Array.isArray(node.reactions) && node.reactions.length > 0;
}

/** Nearest ancestor with a scrollable overflowDirection (not "NONE"), or null. */
export function findScrollableAncestor(node: NodeLike): NodeLike | null {
  let cur: NodeLike | null = node.parent;
  while (cur) {
    if (cur.overflowDirection !== undefined && cur.overflowDirection !== "NONE") {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

/** Breadcrumb of names from the node up to (excluding) the DOCUMENT, joined by " > ". */
export function pathOf(node: NodeLike): string {
  const parts: string[] = [];
  let cur: NodeLike | null = node;
  while (cur && cur.type !== "DOCUMENT") {
    parts.unshift(cur.name);
    cur = cur.parent;
  }
  return parts.join(" > ");
}
```

(Behavior note: the original `hasReactions` used `"reactions" in node && Array.isArray(...)`; `Array.isArray(undefined)` is `false`, so the `in` check is redundant and dropped. The original loops used `(cur as any).parent`; with `NodeLike.parent` typed `NodeLike | null` the casts are no longer needed.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- node-tree`
Expected: PASS (all node-tree tests green).

- [ ] **Step 5: Wire `code.ts` to the module**

In `src/figma-plugin/code.ts`:

1. Add the import near the other `./`-sibling imports (after the `./variable-literal.js` import on line 20):

```ts
import { findEnclosingFrameId, hasReactions, findScrollableAncestor, pathOf } from "./node-tree.js";
```

2. Delete the four now-duplicated function definitions:
   - `findEnclosingFrameId` (was lines 110–117)
   - `hasReactions` (was lines 119–121)
   - `findScrollableAncestor` (was lines 123–135)
   - `pathOf` (was lines 339–347)

Leave the four call sites (167, 298, 299, 332, 333) unchanged — they now resolve to the imported functions.

- [ ] **Step 6: Typecheck (the assignability gate)**

Run: `npm run typecheck`
Expected: clean. This proves Figma's `SceneNode`/`BaseNode` are assignable to `NodeLike` at the call sites.

If `tsc` reports a node-assignability error at a call site, FIRST try to fix it by adjusting `NodeLike` to faithfully match Figma's variance (e.g. the `readonly`/optional fields). Only if a clean structural definition is impossible, apply a single localized `as NodeLike` at the failing call site (do NOT cast inside `node-tree.ts`, and do NOT widen `NodeLike` to `any`). If neither resolves it, STOP and report BLOCKED with the exact `tsc` error.

- [ ] **Step 7: Verify removals + full suite + build**

Run: `git grep -n 'function findEnclosingFrameId\|function hasReactions\|function findScrollableAncestor\|function pathOf' src/figma-plugin/code.ts`
Expected: NO matches (all four moved out).

Run: `git grep -n 'figma\.\|zod' src/figma-plugin/node-tree.ts`
Expected: NO matches (module is pure).

Run: `npm test`
Expected: all pass (existing 389 + new node-tree tests).

Run: `npm run build:plugin`
Expected: builds successfully.

- [ ] **Step 8: Commit**

```bash
git add src/figma-plugin/node-tree.ts tests/node-tree.test.ts src/figma-plugin/code.ts
git commit -m "refactor(plugin): extract pure node traversals into node-tree.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Extract list-echo encoding into `action-echo.ts`

**Files:**
- Create: `src/figma-plugin/action-echo.ts`
- Test: `tests/action-echo.test.ts`
- Modify: `src/figma-plugin/code.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/action-echo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  encodeActionForListEcho,
  decodeConditionForEcho,
  type EchoResolvers,
} from "../src/figma-plugin/action-echo.js";
import { buildConditionExpression } from "../src/figma-plugin/condition-codec.js";

// Deterministic fake resolvers: undefined => "missing/deleted".
const make = (vars: Record<string, string> = {}, nodes: Record<string, string> = {}): EchoResolvers => ({
  variableName: async (id) => vars[id],
  nodeName: (id) => nodes[id],
});

describe("encodeActionForListEcho — passthrough actions", () => {
  it("encodes a NODE/navigate action and resolves the destination name", async () => {
    const out = await encodeActionForListEcho(
      { type: "NODE", navigation: "NAVIGATE", destinationId: "d1", transition: { type: "DISSOLVE" }, resetScrollPosition: false },
      make({}, { d1: "Home" }),
    );
    expect(out).toEqual({
      type: "NODE", navigation: "NAVIGATE", url: undefined, openInNewTab: undefined,
      destinationId: "d1", destinationName: "Home", transition: { type: "DISSOLVE" }, resetScrollPosition: false,
    });
  });

  it("encodes a CLOSE action with no destination", async () => {
    const out = await encodeActionForListEcho({ type: "CLOSE" }, make());
    expect(out).toEqual({
      type: "CLOSE", navigation: undefined, url: undefined, openInNewTab: undefined,
      destinationId: undefined, destinationName: undefined, transition: undefined, resetScrollPosition: undefined,
    });
  });

  it("returns { type: UNKNOWN } for a non-object action", async () => {
    expect(await encodeActionForListEcho(null, make())).toEqual({ type: "UNKNOWN" });
  });
});

describe("encodeActionForListEcho — SET_VARIABLE", () => {
  it("resolves the variable name and passes a scalar value through", async () => {
    const out = await encodeActionForListEcho(
      { type: "SET_VARIABLE", variableId: "v1", variableValue: { type: "BOOLEAN", value: true } },
      make({ v1: "isOpen" }),
    );
    expect(out).toEqual({ type: "set_variable", variable: "isOpen", value: true });
  });

  it("converts a COLOR variableValue to a hex string via rgbToHex", async () => {
    const out = await encodeActionForListEcho(
      { type: "SET_VARIABLE", variableId: "v2", variableValue: { type: "COLOR", value: { r: 1, g: 0, b: 0, a: 1 } } },
      make({ v2: "brand" }),
    );
    expect(out).toEqual({ type: "set_variable", variable: "brand", value: "#FF0000" });
  });

  it("falls back to <id:..> when the variable was deleted", async () => {
    const out = await encodeActionForListEcho(
      { type: "SET_VARIABLE", variableId: "gone", variableValue: { type: "BOOLEAN", value: false } },
      make({}),
    );
    expect(out).toEqual({ type: "set_variable", variable: "<id:gone>", value: false });
  });
});

describe("encodeActionForListEcho — CONDITIONAL", () => {
  const condition = buildConditionExpression({
    variableId: "v1", resolvedType: "BOOLEAN", operator: "==",
    literal: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true },
  });

  it("encodes a standard then/else conditional recursively", async () => {
    const action = {
      type: "CONDITIONAL",
      conditionalBlocks: [
        { condition, actions: [{ type: "CLOSE" }] },
        { actions: [{ type: "BACK" }] }, // else block: no condition
      ],
    };
    const out: any = await encodeActionForListEcho(action, make({ v1: "isOpen" }));
    expect(out.type).toBe("CONDITIONAL");
    expect(out.condition).toEqual({ variable: "isOpen", operator: "==", value: true, raw: undefined });
    expect(out.then).toHaveLength(1);
    expect((out.then[0] as any).type).toBe("CLOSE");
    expect(out.else).toHaveLength(1);
    expect((out.else[0] as any).type).toBe("BACK");
  });

  it("returns { type: CONDITIONAL, raw } for a non-standard block shape", async () => {
    const action = { type: "CONDITIONAL", conditionalBlocks: [{ actions: [] }] }; // block[0] has no condition
    const out: any = await encodeActionForListEcho(action, make());
    expect(out).toEqual({ type: "CONDITIONAL", raw: [{ actions: [] }] });
  });

  it("detects the toggle_variable desugar pattern", async () => {
    // A toggle desugar: block0 = (var == true -> set var false), block1 = (else -> set var true)
    const toggleCondition = buildConditionExpression({
      variableId: "vt", resolvedType: "BOOLEAN", operator: "==",
      literal: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true },
    });
    const action = {
      type: "CONDITIONAL",
      conditionalBlocks: [
        { condition: toggleCondition, actions: [{ type: "SET_VARIABLE", variableId: "vt", variableValue: { type: "BOOLEAN", value: false } }] },
        { actions: [{ type: "SET_VARIABLE", variableId: "vt", variableValue: { type: "BOOLEAN", value: true } }] },
      ],
    };
    const out: any = await encodeActionForListEcho(action, make({ vt: "darkMode" }));
    expect(out).toEqual({ type: "toggle_variable", variable: "darkMode" });
  });
});

describe("decodeConditionForEcho", () => {
  it("decodes a standard expression and resolves the variable name", async () => {
    const condition = buildConditionExpression({
      variableId: "v9", resolvedType: "FLOAT", operator: "<=",
      literal: { type: "FLOAT", resolvedType: "FLOAT", value: 5 },
    });
    const out = await decodeConditionForEcho(condition, make({ v9: "count" }));
    expect(out).toEqual({ variable: "count", operator: "<=", value: 5, raw: undefined });
  });

  it("returns { raw } for a non-expression condition", async () => {
    const out = await decodeConditionForEcho({ type: "BOOLEAN", value: true }, make());
    expect(out).toEqual({ raw: { type: "BOOLEAN", value: true } });
  });

  it("keeps the raw condition when the variable name is lost", async () => {
    const condition = buildConditionExpression({
      variableId: "deleted", resolvedType: "BOOLEAN", operator: "==",
      literal: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true },
    });
    const out: any = await decodeConditionForEcho(condition, make({}));
    expect(out.variable).toBe("<id:deleted>");
    expect(out.raw).toEqual(condition);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- action-echo`
Expected: FAIL — cannot resolve `../src/figma-plugin/action-echo.js`.

- [ ] **Step 3: Create the module**

Create `src/figma-plugin/action-echo.ts` (the structural transform + recursion moved verbatim from `code.ts`, with the two impure lookups replaced by injected resolvers; the variable-name try/catch moves into the resolver, supplied by the caller):

```ts
import { detectTogglePattern, decodeConditionExpression } from "./condition-codec.js";
import { rgbToHex } from "./variable-literal.js";

/**
 * The two impure id->name lookups the echo encoder needs. The caller supplies
 * figma-backed implementations (swallowing deleted-id errors); tests supply
 * deterministic fakes. No figma.* / zod here — safe inside the plugin bundle.
 */
export interface EchoResolvers {
  /** Variable id -> name; resolves undefined for a missing/deleted variable. */
  variableName(id: string): Promise<string | undefined>;
  /** Node id -> name; undefined for a missing node. */
  nodeName(id: string): string | undefined;
}

/** Re-encode a built reaction action into the list_reactions wire/echo shape. */
export async function encodeActionForListEcho(action: any, resolvers: EchoResolvers): Promise<unknown> {
  if (!action || typeof action !== "object") return { type: "UNKNOWN" };

  if (action.type === "CONDITIONAL") {
    const blocks = Array.isArray(action.conditionalBlocks) ? action.conditionalBlocks : [];

    // 1) Toggle_variable desugar pattern first.
    const toggleVarId = detectTogglePattern(blocks);
    if (toggleVarId) {
      const varName = await resolvers.variableName(toggleVarId);
      return { type: "toggle_variable", variable: varName ?? `<id:${toggleVarId}>` };
    }

    // 2) Standard 1–2 block conditional (block[0] has a condition; optional else has none).
    const standardPattern = blocks.length >= 1 && blocks.length <= 2 &&
      blocks[0].condition !== undefined &&
      (blocks.length === 1 || blocks[1].condition === undefined);
    if (!standardPattern) {
      return { type: "CONDITIONAL", raw: blocks };
    }

    const decodedCondition = await decodeConditionForEcho(blocks[0].condition, resolvers);
    const thenActions = await Promise.all(
      (blocks[0].actions ?? []).map((a: any) => encodeActionForListEcho(a, resolvers)),
    );
    const elseActions = blocks.length === 2
      ? await Promise.all((blocks[1].actions ?? []).map((a: any) => encodeActionForListEcho(a, resolvers)))
      : undefined;

    return { type: "CONDITIONAL", condition: decodedCondition, then: thenActions, else: elseActions };
  }

  if (action.type === "SET_VARIABLE") {
    let varName: string | undefined;
    if (action.variableId) varName = await resolvers.variableName(action.variableId);
    const vd = action.variableValue;
    let value: unknown;
    if (
      vd?.type === "COLOR" && vd?.value && typeof vd.value === "object" &&
      "r" in vd.value && "g" in vd.value && "b" in vd.value
    ) {
      value = rgbToHex(vd.value as { r: number; g: number; b: number; a?: number });
    } else {
      value = vd?.value;
    }
    return { type: "set_variable", variable: varName ?? `<id:${action.variableId}>`, value };
  }

  // NODE / CLOSE / BACK / URL / unknown passthrough — identical shape as before.
  const destId = action.destinationId;
  const destName = destId ? resolvers.nodeName(destId) : undefined;
  return {
    type: action.type ?? "UNKNOWN",
    navigation: action.navigation,
    url: action.url,
    openInNewTab: action.openInNewTab,
    destinationId: destId,
    destinationName: destName,
    transition: action.transition,
    resetScrollPosition: action.resetScrollPosition,
  };
}

/**
 * Decode an EXPRESSION condition back to { variable, operator, value }. Returns
 * { raw } if the shape isn't a recognized single comparison; keeps the raw
 * condition when the variable name can't be resolved.
 */
export async function decodeConditionForEcho(condition: any, resolvers: EchoResolvers): Promise<unknown> {
  const decoded = decodeConditionExpression(condition);
  if ("raw" in decoded) return { raw: decoded.raw };

  let variableName: string | undefined;
  if (decoded.variableId) variableName = await resolvers.variableName(decoded.variableId);

  return {
    variable: variableName ?? `<id:${decoded.variableId}>`,
    operator: decoded.operator,
    value: decoded.value,
    raw: variableName === undefined ? condition : undefined, // keep raw if we lost the name
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- action-echo`
Expected: PASS (all action-echo tests green).

- [ ] **Step 5: Wire `code.ts` to the module**

In `src/figma-plugin/code.ts`:

1. Add the import near the other `./`-sibling imports (after the `./node-tree.js` import added in Task 1):

```ts
import { encodeActionForListEcho, type EchoResolvers } from "./action-echo.js";
```

(`decodeConditionForEcho` is no longer referenced directly by `code.ts` — it is called internally by `encodeActionForListEcho` — so it does NOT need importing.)

2. Delete the two now-duplicated function definitions from `code.ts`:
   - `encodeActionForListEcho` (was lines 496–584)
   - `decodeConditionForEcho` (was lines 591–612)

3. Add the figma-backed resolvers as a module-level const (place it immediately above `handleListReactions`). This is where the impure lookups + deleted-id try/catch now live:

```ts
const echoResolvers: EchoResolvers = {
  variableName: async (id) => {
    try {
      return (await figma.variables.getVariableByIdAsync(id))?.name;
    } catch {
      return undefined; // variable was deleted
    }
  },
  nodeName: (id) => figma.getNodeById(id)?.name ?? undefined,
};
```

4. Update the call site inside `handleListReactions` (was line 628) to pass the resolvers:

```ts
        action: await encodeActionForListEcho(firstAction, echoResolvers),
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean. If `decodeConditionExpression`/`rgbToHex`/`detectTogglePattern` imports in the new module report any signature mismatch, reconcile minimally at the import — do NOT change those source modules. If unresolvable, STOP and report BLOCKED with the exact error.

- [ ] **Step 7: Verify removals + purity + full suite + build**

Run: `git grep -n 'async function encodeActionForListEcho\|async function decodeConditionForEcho' src/figma-plugin/code.ts`
Expected: NO matches (both moved out).

Run: `git grep -n 'figma\.\|"zod"\| zod' src/figma-plugin/action-echo.ts`
Expected: NO matches (module is pure).

Run: `npm test`
Expected: all pass (existing 389 + node-tree + action-echo tests).

Run: `npm run build:plugin`
Expected: builds successfully (IIFE; no zod pulled in).

- [ ] **Step 8: Commit**

```bash
git add src/figma-plugin/action-echo.ts tests/action-echo.test.ts src/figma-plugin/code.ts
git commit -m "refactor(plugin): extract list-echo encoding into action-echo.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Glossary + final verification

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Add the glossary entry**

In `CONTEXT.md`, add one line to the domain glossary (alongside the existing "Variable literal" / "Condition expression" terms):

```markdown
- **Echo (list echo)** — re-encoding a built reaction back into the wire format returned by `list_reactions` (the inverse of the build path; see `action-echo.ts`).
```

- [ ] **Step 2: Final whole-change verification**

Run: `npm run typecheck`
Expected: clean.

Run: `npm test`
Expected: all pass.

Run: `npm run build:plugin`
Expected: builds successfully.

Run: `wc -l src/figma-plugin/code.ts`
Expected: ~560–580 lines (down from 703).

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: add Echo glossary term to CONTEXT.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Behavior-preserving:** Both extractions move logic verbatim; only the seam changes (impure lookups injected, Figma node accepted as a structural `NodeLike`). The wire/echo output and the find/scroll behavior must be byte-identical. The existing 389-test suite is the regression guard alongside the new tests.
- **Purity is load-bearing:** `node-tree.ts` and `action-echo.ts` are bundled into the plugin IIFE. They must reference neither `figma.*` nor `zod` (the `grep` checks in Steps 7 enforce this). All Figma access stays in `code.ts`.
- **The `NodeLike` assignability is the one real risk** (Task 1, Step 6). It is expected to work via structural typing; the `readonly unknown[]` and optional fields are deliberate to match Figma's variance. A localized cast is the documented fallback — do not weaken `NodeLike` to `any`.
- **Do not change** `condition-codec.ts`, `variable-literal.ts`, `reaction-builder.ts`, `wire-vocabulary.ts`, or `tools.ts` — this plan only moves logic out of `code.ts` and adds the two new modules + tests.
