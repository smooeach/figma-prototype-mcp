# NL Steering Hardening R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `proto_wire`'s default SMART_ANIMATE motion degrade to a fallback transition when two frames share no matching layers, expose directional transitions via natural-language spatial cues, and make `proto_back` search for a back-affordance node before falling back to a gesture.

**Architecture:** Three independent strands. **A1** (deterministic) adds pure plugin-side helpers — layer-name comparison (`node-tree.ts`), transition degrading (`reaction-builder.ts`), and a composition module (`motion-degrade.ts`) — then wires them into the CREATE_REACTIONS navigate path in `code.ts`, with a new `degradeTo` field threaded from `proto_wire`/`proto_conditional` through the schema. **A3 + B** are pure `.describe()`/description metadata changes. **A2** (DISSOLVE `matchLayers`) is gated on a live Figma probe whose outcome decides the schema change.

**Tech Stack:** TypeScript, Zod, Vitest, Figma Plugin API. Source files compile to a plugin bundle (`code.ts`, no zod) + an MCP server (`tools.ts`, `protoTools.ts`).

---

## File Structure

- `src/figma-plugin/node-tree.ts` — extend `NodeLike` with `children`; add `findTopLevelFrameNode`, `collectDescendantLayerNames`, `framesShareLayer`. Pure traversals.
- `src/figma-plugin/reaction-builder.ts` — add `isSmartAnimate`, `degradeTransition`. Pure transition helpers.
- `src/figma-plugin/motion-degrade.ts` — **new** — `resolveNavigateTransition`, composing the above. Pure (no `figma.*`), unit-testable.
- `src/figma-plugin/code.ts` — call `resolveNavigateTransition` in the navigate branch of `buildNonConditionalAction`; thread `source` + `degradeTo` from `handleCreateReactions`.
- `src/mcp-server/tools.ts` — add optional `degradeTo` to `ConnectionInput`; update `proto_wire` + `proto_back` tool descriptions.
- `src/mcp-server/protoTools.ts` — add `degradeTo` to `ProtoWireEntry` + `ProtoConditionalEntry`; thread through `compileProtoWire` + `compileProtoConditional`; extend `MotionInputSchema.describe()` with spatial cues.
- `docs/dictionaries/tool-disambiguation-matrix.md` — add Part 1/2/3 rows for the new cues.
- Tests: `tests/node-tree.test.ts`, `tests/reaction-builder.test.ts`, `tests/motion-degrade.test.ts` (new), `tests/protoTools-compile.test.ts`.

---

## Task 1: Layer-name traversal helpers (`node-tree.ts`)

**Files:**
- Modify: `src/figma-plugin/node-tree.ts`
- Test: `tests/node-tree.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/node-tree.test.ts`:

```typescript
import {
  findTopLevelFrameNode,
  collectDescendantLayerNames,
  framesShareLayer,
} from "../src/figma-plugin/node-tree.js";

describe("findTopLevelFrameNode", () => {
  const page: NodeLike = { id: "p", name: "Page", type: "PAGE", parent: null };
  const screen: NodeLike = { id: "s", name: "Screen", type: "FRAME", parent: page };
  const inner: NodeLike = { id: "i", name: "Inner", type: "FRAME", parent: screen };
  const btn: NodeLike = { id: "b", name: "Btn", type: "INSTANCE", parent: inner };

  it("returns the frame whose parent is a PAGE", () => {
    expect(findTopLevelFrameNode(btn)).toBe(screen);
  });
  it("treats a SECTION parent as top-level too", () => {
    const section: NodeLike = { id: "sec", name: "Sec", type: "SECTION", parent: page };
    const f: NodeLike = { id: "f", name: "F", type: "FRAME", parent: section };
    const leaf: NodeLike = { id: "l", name: "L", type: "TEXT", parent: f };
    expect(findTopLevelFrameNode(leaf)).toBe(f);
  });
  it("returns null when no frame has a PAGE/SECTION parent", () => {
    const orphan: NodeLike = { id: "o", name: "O", type: "TEXT", parent: null };
    expect(findTopLevelFrameNode(orphan)).toBe(null);
  });
});

describe("collectDescendantLayerNames", () => {
  it("gathers all descendant names, excluding the node itself", () => {
    const leafA: NodeLike = { id: "a", name: "Title", type: "TEXT", parent: null };
    const leafB: NodeLike = { id: "b", name: "CTA", type: "TEXT", parent: null };
    const frame: NodeLike = { id: "f", name: "Frame", type: "FRAME", parent: null, children: [leafA, leafB] };
    expect(collectDescendantLayerNames(frame)).toEqual(new Set(["Title", "CTA"]));
  });
  it("recurses into nested children", () => {
    const deep: NodeLike = { id: "d", name: "Deep", type: "TEXT", parent: null };
    const mid: NodeLike = { id: "m", name: "Mid", type: "GROUP", parent: null, children: [deep] };
    const frame: NodeLike = { id: "f", name: "Frame", type: "FRAME", parent: null, children: [mid] };
    expect(collectDescendantLayerNames(frame)).toEqual(new Set(["Mid", "Deep"]));
  });
  it("returns an empty set for a childless node", () => {
    expect(collectDescendantLayerNames({ id: "x", name: "X", type: "FRAME", parent: null })).toEqual(new Set());
  });
});

describe("framesShareLayer", () => {
  const mk = (names: string[]): NodeLike => ({
    id: "f", name: "F", type: "FRAME", parent: null,
    children: names.map((n, i) => ({ id: `c${i}`, name: n, type: "TEXT", parent: null })),
  });
  it("is true when a descendant name is shared", () => {
    expect(framesShareLayer(mk(["Header", "Body"]), mk(["Header", "Footer"]))).toBe(true);
  });
  it("is false when no descendant name is shared", () => {
    expect(framesShareLayer(mk(["A", "B"]), mk(["C", "D"]))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/node-tree.test.ts`
Expected: FAIL — `findTopLevelFrameNode is not a function` (and the other two new imports).

- [ ] **Step 3: Implement the helpers**

In `src/figma-plugin/node-tree.ts`, add `children` to the `NodeLike` interface (after the `parent` line):

```typescript
  parent: NodeLike | null;
  children?: readonly NodeLike[];
```

Then append the three functions:

```typescript
/**
 * The top-level frame containing `node`: the FRAME ancestor (or `node` itself)
 * whose parent is a PAGE or SECTION (or null). This is the screen Figma uses as
 * the SMART_ANIMATE source. Null when no such frame exists in the chain.
 */
export function findTopLevelFrameNode(node: NodeLike): NodeLike | null {
  let cur: NodeLike | null = node;
  let top: NodeLike | null = null;
  while (cur) {
    if (cur.type === "FRAME") {
      const p = cur.parent;
      if (!p || p.type === "PAGE" || p.type === "SECTION") top = cur;
    }
    cur = cur.parent;
  }
  return top;
}

/** Names of every descendant of `node` (recursive; excludes `node` itself). */
export function collectDescendantLayerNames(node: NodeLike): Set<string> {
  const names = new Set<string>();
  const visit = (n: NodeLike): void => {
    for (const child of n.children ?? []) {
      names.add(child.name);
      visit(child);
    }
  };
  visit(node);
  return names;
}

/** True if `a` and `b` share at least one descendant layer name. */
export function framesShareLayer(a: NodeLike, b: NodeLike): boolean {
  const namesA = collectDescendantLayerNames(a);
  for (const name of collectDescendantLayerNames(b)) {
    if (namesA.has(name)) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/node-tree.test.ts`
Expected: PASS (all suites, old and new).

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/node-tree.ts tests/node-tree.test.ts
git commit -m "feat(plugin): layer-name traversal helpers for SMART_ANIMATE degrade"
```

---

## Task 2: Transition degrade helpers (`reaction-builder.ts`)

**Files:**
- Modify: `src/figma-plugin/reaction-builder.ts`
- Test: `tests/reaction-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/reaction-builder.test.ts`:

```typescript
import { isSmartAnimate, degradeTransition } from "../src/figma-plugin/reaction-builder.js";

describe("isSmartAnimate", () => {
  it("is true for the string form", () => {
    expect(isSmartAnimate("SMART_ANIMATE")).toBe(true);
  });
  it("is true for the object form", () => {
    expect(isSmartAnimate({ type: "SMART_ANIMATE", duration: 0.5 })).toBe(true);
  });
  it("is false for other transitions", () => {
    expect(isSmartAnimate("DISSOLVE")).toBe(false);
    expect(isSmartAnimate({ type: "PUSH", direction: "LEFT" })).toBe(false);
  });
});

describe("degradeTransition", () => {
  it("leaves non-SMART_ANIMATE input unchanged", () => {
    expect(degradeTransition("DISSOLVE", "INSTANT")).toBe("DISSOLVE");
  });
  it("degrades the string form to DISSOLVE", () => {
    expect(degradeTransition("SMART_ANIMATE", "DISSOLVE")).toBe("DISSOLVE");
  });
  it("degrades the string form to INSTANT", () => {
    expect(degradeTransition("SMART_ANIMATE", "INSTANT")).toBe("INSTANT");
  });
  it("preserves duration/easing when degrading the object form to DISSOLVE", () => {
    const easing = { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 } as const;
    expect(degradeTransition({ type: "SMART_ANIMATE", duration: 0.5, easing }, "DISSOLVE")).toEqual({
      type: "DISSOLVE", duration: 0.5, easing,
    });
  });
  it("drops duration/easing when degrading to INSTANT", () => {
    expect(degradeTransition({ type: "SMART_ANIMATE", duration: 0.5 }, "INSTANT")).toBe("INSTANT");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/reaction-builder.test.ts`
Expected: FAIL — `isSmartAnimate is not a function`.

- [ ] **Step 3: Implement the helpers**

In `src/figma-plugin/reaction-builder.ts`, immediately after `buildTransition` (ends at the line with `}` after the SimpleTransitionInput return), add:

```typescript
/** Whether a transition resolves to SMART_ANIMATE (string or object form). */
export function isSmartAnimate(input: TransitionInput): boolean {
  if (input === "SMART_ANIMATE") return true;
  return typeof input !== "string" && input.type === "SMART_ANIMATE";
}

/**
 * Degrade a SMART_ANIMATE transition to a fallback. Used when the source and
 * destination frames share no matching layers, so SMART_ANIMATE has nothing to
 * morph. Non-SMART_ANIMATE input is returned unchanged.
 * - "INSTANT": a hard cut (no duration/easing).
 * - "DISSOLVE": a soft fade, preserving the SMART_ANIMATE duration/easing.
 */
export function degradeTransition(
  input: TransitionInput,
  degradeTo: "DISSOLVE" | "INSTANT",
): TransitionInput {
  if (!isSmartAnimate(input)) return input;
  if (degradeTo === "INSTANT") return "INSTANT";
  if (input === "SMART_ANIMATE") return "DISSOLVE";
  return { type: "DISSOLVE", duration: input.duration, easing: input.easing };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/reaction-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/reaction-builder.ts tests/reaction-builder.test.ts
git commit -m "feat(plugin): isSmartAnimate + degradeTransition helpers"
```

---

## Task 3: Navigate-transition composition (`motion-degrade.ts`)

**Files:**
- Create: `src/figma-plugin/motion-degrade.ts`
- Test: `tests/motion-degrade.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/motion-degrade.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveNavigateTransition } from "../src/figma-plugin/motion-degrade.js";
import type { NodeLike } from "../src/figma-plugin/node-tree.js";

const page: NodeLike = { id: "p", name: "Page", type: "PAGE", parent: null };
function screen(name: string, layers: string[]): NodeLike {
  const frame: NodeLike = { id: name, name, type: "FRAME", parent: page, children: [] };
  (frame as { children: NodeLike[] }).children = layers.map((n, i) => ({
    id: `${name}-${i}`, name: n, type: "TEXT", parent: frame,
  }));
  return frame;
}

describe("resolveNavigateTransition", () => {
  it("degrades SMART_ANIMATE to DISSOLVE when frames share no layers", () => {
    const home = screen("home", ["HomeTitle", "HomeList"]);
    const detail = screen("detail", ["DetailHeader", "DetailBody"]);
    const btn: NodeLike = { id: "btn", name: "Btn", type: "INSTANCE", parent: home };
    const r = resolveNavigateTransition({ source: btn, destFrame: detail, transition: "SMART_ANIMATE", degradeTo: undefined });
    expect(r.transition).toBe("DISSOLVE");
    expect(r.warning).toContain("no matching layers");
  });
  it("honours degradeTo INSTANT", () => {
    const a = screen("a", ["X"]);
    const b = screen("b", ["Y"]);
    const btn: NodeLike = { id: "btn", name: "Btn", type: "INSTANCE", parent: a };
    expect(resolveNavigateTransition({ source: btn, destFrame: b, transition: "SMART_ANIMATE", degradeTo: "INSTANT" }).transition).toBe("INSTANT");
  });
  it("keeps SMART_ANIMATE when frames share a layer", () => {
    const a = screen("a", ["NavBar", "BodyA"]);
    const b = screen("b", ["NavBar", "BodyB"]);
    const btn: NodeLike = { id: "btn", name: "Btn", type: "INSTANCE", parent: a };
    const r = resolveNavigateTransition({ source: btn, destFrame: b, transition: "SMART_ANIMATE", degradeTo: undefined });
    expect(r.transition).toBe("SMART_ANIMATE");
    expect(r.warning).toBeUndefined();
  });
  it("leaves non-SMART_ANIMATE transitions untouched", () => {
    const a = screen("a", ["X"]);
    const b = screen("b", ["Y"]);
    const btn: NodeLike = { id: "btn", name: "Btn", type: "INSTANCE", parent: a };
    expect(resolveNavigateTransition({ source: btn, destFrame: b, transition: "DISSOLVE", degradeTo: undefined }).transition).toBe("DISSOLVE");
  });
  it("does not degrade when the source has no top-level frame", () => {
    const orphan: NodeLike = { id: "o", name: "O", type: "TEXT", parent: null };
    const b = screen("b", ["Y"]);
    const r = resolveNavigateTransition({ source: orphan, destFrame: b, transition: "SMART_ANIMATE", degradeTo: undefined });
    expect(r.transition).toBe("SMART_ANIMATE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/motion-degrade.test.ts`
Expected: FAIL — cannot find module `motion-degrade.js`.

- [ ] **Step 3: Implement the module**

Create `src/figma-plugin/motion-degrade.ts`:

```typescript
// Pure composition of node-tree layer matching + transition degrading.
// No figma.* references — safe inside the plugin bundle and unit-testable.

import { framesShareLayer, findTopLevelFrameNode, type NodeLike } from "./node-tree.js";
import { isSmartAnimate, degradeTransition, type TransitionInput } from "./reaction-builder.js";

/**
 * Decide the transition to actually use for a navigate reaction. When the
 * motion is SMART_ANIMATE and the source's top-level frame shares no matching
 * layer names with the destination frame, degrade to `degradeTo` (default
 * DISSOLVE) since there is nothing to morph. Otherwise return it unchanged.
 */
export function resolveNavigateTransition(args: {
  source: NodeLike;
  destFrame: NodeLike;
  transition: TransitionInput;
  degradeTo: "DISSOLVE" | "INSTANT" | undefined;
}): { transition: TransitionInput; warning?: string } {
  const { source, destFrame, transition, degradeTo } = args;
  if (!isSmartAnimate(transition)) return { transition };
  const srcTop = findTopLevelFrameNode(source);
  if (!srcTop) return { transition };
  if (framesShareLayer(srcTop, destFrame)) return { transition };
  const to = degradeTo ?? "DISSOLVE";
  return {
    transition: degradeTransition(transition, to),
    warning: `SMART_ANIMATE has no matching layers between "${srcTop.name}" and "${destFrame.name}"; degraded to ${to}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/motion-degrade.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/motion-degrade.ts tests/motion-degrade.test.ts
git commit -m "feat(plugin): resolveNavigateTransition composition module"
```

---

## Task 4: `degradeTo` field on the wire protocol (`tools.ts`)

**Files:**
- Modify: `src/mcp-server/tools.ts:238-247` (ConnectionInput)
- Test: `tests/tools.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/tools.test.ts` (import `CreateReactionsInput` if not already imported at the top of the file):

```typescript
describe("ConnectionInput.degradeTo", () => {
  it("accepts DISSOLVE and INSTANT", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "a", action: { type: "navigate", targetFrameId: "f" }, degradeTo: "INSTANT" }],
    });
    expect(parsed.connections[0].degradeTo).toBe("INSTANT");
  });
  it("rejects an unknown degradeTo value", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "a", action: { type: "navigate", targetFrameId: "f" }, degradeTo: "FADE" }],
    })).toThrow();
  });
  it("leaves degradeTo undefined when omitted", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "a", action: { type: "navigate", targetFrameId: "f" } }],
    });
    expect(parsed.connections[0].degradeTo).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools.test.ts`
Expected: FAIL — `degradeTo` is stripped (undefined) on the first test, so `toBe("INSTANT")` fails.

- [ ] **Step 3: Add the field**

In `src/mcp-server/tools.ts`, inside `ConnectionInput` (between the `transition` and `action` lines):

```typescript
  transition: TransitionInput.default("INSTANT"),
  degradeTo: z.enum(["DISSOLVE", "INSTANT"]).optional(),
  action: ActionInput,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/tools.ts tests/tools.test.ts
git commit -m "feat(schema): optional degradeTo on ConnectionInput"
```

---

## Task 5: Thread `degradeTo` through proto compilers (`protoTools.ts`)

**Files:**
- Modify: `src/mcp-server/protoTools.ts` (ProtoWireEntry ~21-27, ProtoConditionalEntry ~194-201, compileProtoWire ~255-263, compileProtoConditional ~385-413)
- Test: `tests/protoTools-compile.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/protoTools-compile.test.ts`:

```typescript
describe("degradeTo threading", () => {
  it("compileProtoWire carries degradeTo onto the connection", () => {
    const out = compileProtoWire(ProtoWireInput.parse({
      wires: [{ from: "a", to: "b", degradeTo: "INSTANT" }],
    }));
    expect(out.connections[0].degradeTo).toBe("INSTANT");
  });
  it("compileProtoWire omits degradeTo when not given", () => {
    const out = compileProtoWire(ProtoWireInput.parse({ wires: [{ from: "a", to: "b" }] }));
    expect(out.connections[0].degradeTo).toBeUndefined();
  });
  it("compileProtoConditional carries degradeTo onto the connection", () => {
    const out = compileProtoConditional(ProtoConditionalInput.parse({
      conditions: [{
        from: "a", degradeTo: "DISSOLVE",
        if: { variable: "v", value: true },
        then: { navigate: "b" },
      }],
    }));
    expect(out.connections[0].degradeTo).toBe("DISSOLVE");
  });
});
```

(Ensure `compileProtoWire`, `compileProtoConditional`, `ProtoWireInput`, `ProtoConditionalInput` are imported at the top of the file — match the existing imports.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/protoTools-compile.test.ts`
Expected: FAIL — `degradeTo` is `undefined` in the first/third tests (field not parsed, not threaded).

- [ ] **Step 3: Implement**

In `src/mcp-server/protoTools.ts`, add this shared field constant near `COLLECTION_FIELD` (after line 114):

```typescript
const DEGRADE_TO_FIELD = z
  .enum(["DISSOLVE", "INSTANT"])
  .optional()
  .describe(
    "Fallback transition used ONLY when a SMART_ANIMATE motion (the default, and " +
      "every M3/HIG preset) connects two frames that share no matching layer names — " +
      "there is nothing to morph, so it degrades. DISSOLVE (default) keeps a soft fade; " +
      "INSTANT cuts immediately. Ignored for non-SMART_ANIMATE motion.",
  );
```

Add `degradeTo: DEGRADE_TO_FIELD,` to `ProtoWireEntry` (after the `motion` line) and to `ProtoConditionalEntry` (after the `motion` line).

In `compileProtoWire`, change the `.map` body to spread `degradeTo` onto the connection:

```typescript
  const connections: Connection[] = input.wires.map((w) => {
    const action: Connection["action"] = w.resetScrollPosition === undefined
      ? { type: "navigate", targetFrameId: w.to }
      : { type: "navigate", targetFrameId: w.to, resetScrollPosition: w.resetScrollPosition };
    return {
      ...buildConnection(w.from, w.trigger, w.motion, action),
      ...(w.degradeTo !== undefined && { degradeTo: w.degradeTo }),
    };
  });
```

In `compileProtoConditional`, add `degradeTo` to the returned connection object (after the `transition,` line):

```typescript
    return {
      sourceNodeId: c.from,
      trigger: c.trigger ?? DEFAULT_TRIGGER,
      transition,
      ...(c.degradeTo !== undefined && { degradeTo: c.degradeTo }),
      action,
    } as Connection;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/protoTools-compile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/protoTools.ts tests/protoTools-compile.test.ts
git commit -m "feat(proto): thread degradeTo through proto_wire + proto_conditional"
```

---

## Task 6: Wire the degrade into the plugin navigate path (`code.ts`)

**Files:**
- Modify: `src/figma-plugin/code.ts` (imports ~29; `buildNonConditionalAction` signature ~129-134 and navigate branch ~135-147; three call sites ~478, ~487, ~547)

No new unit test — the pure decision is covered by `tests/motion-degrade.test.ts`; this task is integration glue verified by `npx vitest run` (no regressions) and the live round in Task 10. The `code.ts` plugin module is not unit-tested in this repo (it depends on `figma.*`).

- [ ] **Step 1: Add imports**

In `src/figma-plugin/code.ts`, extend the `node-tree.js` import (line 29):

```typescript
import { findEnclosingFrameId, hasReactions, findScrollableAncestor, pathOf, findTopLevelFrameNode } from "./node-tree.js";
```

Add a new import below the `action-echo` import (after line 30):

```typescript
import { resolveNavigateTransition } from "./motion-degrade.js";
```

- [ ] **Step 2: Extend `buildNonConditionalAction` signature**

Change its parameter list to add `sourceNode` and `degradeTo`:

```typescript
async function buildNonConditionalAction(
  action: NonConditionalActionInput,
  trigger: TriggerInput,
  afterTimeoutSeconds: number | undefined,
  transition: TransitionInput,
  sourceNode: BaseNode,
  degradeTo: "DISSOLVE" | "INSTANT" | undefined,
): Promise<{ built: BuiltAction; warning?: string }> {
```

- [ ] **Step 3: Apply the degrade in the navigate branch**

Replace the existing `if (action.type === "navigate") { ... }` block (lines 135-147) with:

```typescript
  if (action.type === "navigate") {
    const target = figma.getNodeById(action.targetFrameId);
    if (!target) throw new Error(`Target frame not found: ${action.targetFrameId}`);
    if (target.type !== "FRAME") {
      throw new Error(`Target must be a frame: ${action.targetFrameId} (got ${target.type})`);
    }
    const { transition: effectiveTransition, warning } = resolveNavigateTransition({
      source: sourceNode,
      destFrame: target,
      transition,
      degradeTo,
    });
    const reaction = buildNavigateReaction({
      targetFrameId: action.targetFrameId,
      trigger, afterTimeoutSeconds, transition: effectiveTransition,
      resetScrollPosition: action.resetScrollPosition,
    });
    return { built: reaction.actions[0]!, warning };
  }
```

(`sourceNode`/`target` are real Figma nodes passed where `NodeLike` is expected — structurally assignable, matching the existing `findScrollableAncestor(target)` call at the old line 151, no cast needed.)

- [ ] **Step 4: Update the three call sites**

In `handleCreateReactions`, pass `source` and `conn.degradeTo` to all three `buildNonConditionalAction` calls. The conditional `then` loop:

```typescript
        for (const a of conn.action.then) {
          const r = await buildNonConditionalAction(a, conn.trigger, conn.afterTimeoutSeconds, conn.transition, source, conn.degradeTo);
          thenBuilt.push(r.built);
          if (r.warning && !warning) warning = r.warning;
        }
```

The conditional `else` loop:

```typescript
          for (const a of conn.action.else) {
            const r = await buildNonConditionalAction(a, conn.trigger, conn.afterTimeoutSeconds, conn.transition, source, conn.degradeTo);
            elseBuilt.push(r.built);
            if (r.warning && !warning) warning = r.warning;
          }
```

The non-conditional branch:

```typescript
        const { built, warning: branchWarning } = await buildNonConditionalAction(
          conn.action,
          conn.trigger,
          conn.afterTimeoutSeconds,
          conn.transition,
          source,
          conn.degradeTo,
        );
```

- [ ] **Step 5: Typecheck + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — no type errors, all suites green.

- [ ] **Step 6: Commit**

```bash
git add src/figma-plugin/code.ts
git commit -m "feat(plugin): degrade SMART_ANIMATE on no-layer-match navigate"
```

---

## Task 7: Spatial-cue + degrade describe() steering (A3)

**Files:**
- Modify: `src/mcp-server/protoTools.ts` (`MotionInputSchema.describe()` ~9-19)
- Modify: `src/mcp-server/tools.ts` (`proto_wire` description ~131-137)
- Modify: `docs/dictionaries/tool-disambiguation-matrix.md`

Pure metadata — no unit test; verified by `npx vitest run` (schemas still parse) and the live round.

- [ ] **Step 1: Extend `MotionInputSchema.describe()`**

In `src/mcp-server/protoTools.ts`, append to the describe string (before the closing `"Full vocabulary: docs/dictionaries/."` line):

```typescript
    "Spatial cues map to a directional TransitionInput, not a preset: 밀고 들어오는/들어와 → {type:'MOVE_IN', direction}; " +
    "밀어내며/나가며/내보내며 → {type:'MOVE_OUT', direction}; 올라오는/올라와 → {type:'MOVE_IN', direction:'BOTTOM'}; " +
    "내려오는 → {type:'MOVE_IN', direction:'TOP'}. " +
```

- [ ] **Step 2: Extend the `proto_wire` description**

In `src/mcp-server/tools.ts`, replace the `proto_wire` description's defaults line with one that names the degrade and directional behavior:

```typescript
        "Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED (a SMART_ANIMATE preset). " +
        "SMART_ANIMATE only morphs layers shared by name between the two frames; when they share none " +
        "it auto-degrades to the connection's `degradeTo` (DISSOLVE by default). For a spatial 'slides/pushes in' " +
        "feel between distinct screens, pass a directional TransitionInput (PUSH/MOVE_IN/MOVE_OUT) as `motion`. " +
        "Compiles to create_reactions internally.",
```

- [ ] **Step 3: Add matrix-doc rows**

In `docs/dictionaries/tool-disambiguation-matrix.md`, under Part 3 (Motion cues), add rows:

```markdown
| 밀고 들어오는 / 들어와 | `{type:'MOVE_IN', direction}` | spatial entry, not a preset |
| 밀어내며 / 나가며 | `{type:'MOVE_OUT', direction}` | spatial exit |
| 올라오는 / 올라와 | `{type:'MOVE_IN', direction:'BOTTOM'}` | bottom-sheet-like rise |
| (default, distinct screens) | SMART_ANIMATE → degrades to DISSOLVE | no shared layer names → nothing to morph |
```

- [ ] **Step 4: Verify schemas still parse**

Run: `npx vitest run`
Expected: PASS (no test asserts on describe text; this confirms no syntax break).

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/protoTools.ts src/mcp-server/tools.ts docs/dictionaries/tool-disambiguation-matrix.md
git commit -m "feat(steering): spatial-cue directional transitions + degrade note (A3)"
```

---

## Task 8: Back-affordance discovery describe() (B)

**Files:**
- Modify: `src/mcp-server/tools.ts` (`proto_back` description ~187-197)
- Modify: `docs/dictionaries/tool-disambiguation-matrix.md`

Pure metadata — no unit test.

- [ ] **Step 1: Extend the `proto_back` description**

In `src/mcp-server/tools.ts`, insert this guidance into the `proto_back` description (after the "To navigate to a SPECIFIC previous frame..." sentence, before the overlay-ambiguity ⚠️ block):

```typescript
        "Choosing the source node: for an abstract request ('뒤로가기 달아줘/add back to each screen') FIRST look for a " +
        "visible back affordance in the frame — a small top-left icon, or a node whose name contains back/arrow/chevron/prev, " +
        "or a '<'/'‹' glyph — and wire THAT with ON_CLICK. Only use a frame-level ON_DRAG swipe-back when the request names a " +
        "gesture ('스와이프/밀어서 뒤로'). If the intent is abstract AND no back-affordance node exists, ASK the user " +
        "('백버튼이 안 보이는데 스와이프 제스처로 할까요?') rather than silently wiring a swipe — do not create a node (this tool only wires). " +
```

- [ ] **Step 2: Add a matrix-doc row**

In `docs/dictionaries/tool-disambiguation-matrix.md`, under Part 1 (Tool selection), add:

```markdown
| "뒤로가기 달아줘" (abstract, no element named) | proto_back on a discovered back-affordance node (ON_CLICK) | search for top-left back icon first; swipe (ON_DRAG) only on explicit gesture cue; ask if none found |
```

- [ ] **Step 3: Verify**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/mcp-server/tools.ts docs/dictionaries/tool-disambiguation-matrix.md
git commit -m "feat(steering): proto_back back-affordance discovery guidance (B)"
```

---

## Task 9: Live probe — DISSOLVE + matchLayers (A2, gating)

**Files:**
- Modify (temporary): `src/figma-plugin/reaction-builder.ts` (`buildTransition` DISSOLVE branch)
- Record outcome in the matrix doc + a memory.

This requires the live server (`npm start`), the Figma plugin connected, and a real file with two frames. It determines whether Task 10 adds `matchLayers` to DISSOLVE or takes the directional fallback.

- [ ] **Step 1: Temporarily emit matchLayers on DISSOLVE**

In `src/figma-plugin/reaction-builder.ts`, in `buildTransition`, split the combined DISSOLVE/SMART_ANIMATE branch so DISSOLVE carries `matchLayers: true`:

```typescript
  if (input === "SMART_ANIMATE") {
    return { type: "SMART_ANIMATE", duration: 0.3, easing: { type: "EASE_OUT" } };
  }
  if (input === "DISSOLVE") {
    return { type: "DISSOLVE", duration: 0.3, easing: { type: "EASE_OUT" }, matchLayers: true } as TransitionShape;
  }
```

- [ ] **Step 2: Run a live DISSOLVE wire and observe**

With the server running and plugin connected, in the connected MCP client run a single `proto_wire` between two existing frames with `motion: "DISSOLVE"`. Watch the server/plugin log for the `setReactionsAsync` result.

Expected — one of:
- **ACCEPTED:** the reaction is created, no error. → matchLayers IS supported on DISSOLVE at runtime.
- **REJECTED:** `setReactionsAsync` throws `Unrecognized key(s) in object: 'matchLayers'` (the same shape as the `deprecatedVersion`/`initialVelocity` rejections). → NOT supported.

- [ ] **Step 3: Revert the temporary edit**

```bash
git checkout src/figma-plugin/reaction-builder.ts
```

- [ ] **Step 4: Record the outcome**

Note ACCEPTED or REJECTED in `docs/dictionaries/tool-disambiguation-matrix.md` (a line under the greenfield section) and carry it into Task 10. No commit needed for the reverted probe edit; the recorded note is committed with Task 10.

---

## Task 10: Apply A2 per probe result + final verification

**Files:**
- If ACCEPTED: `src/figma-plugin/reaction-builder.ts`, `src/mcp-server/tools.ts` (`SimpleTransitionObject`), `tests/reaction-builder.test.ts`
- If REJECTED: `src/mcp-server/protoTools.ts` (describe note), memory
- Always: `docs/dictionaries/tool-disambiguation-matrix.md`

- [ ] **Step 1a (ONLY if probe ACCEPTED): test + implement matchLayers on DISSOLVE**

Add to `tests/reaction-builder.test.ts`:

```typescript
it("DISSOLVE carries matchLayers true (runtime-confirmed)", () => {
  expect(buildTransition("DISSOLVE")).toEqual({
    type: "DISSOLVE", duration: 0.3, easing: { type: "EASE_OUT" }, matchLayers: true,
  });
});
```

Note: this replaces the existing `"returns DISSOLVE with duration and EASE_OUT easing"` assertion — update that older test to include `matchLayers: true` so both agree.

Then make the Step-1 split from Task 9 permanent in `buildTransition`, and for the object-form simple branch set `matchLayers: true` when `input.type === "DISSOLVE"`. Add `matchLayers: z.boolean().optional()` to `SimpleTransitionObject` in `tools.ts` so an explicit DISSOLVE may carry it, and add `matchLayers?: boolean` to the simple variant of `TransitionShape` in `reaction-builder.ts`.

- [ ] **Step 1b (ONLY if probe REJECTED): document the limitation + directional fallback**

Append to `MotionInputSchema.describe()` in `protoTools.ts`:

```typescript
    "(A DISSOLVE cannot carry matching layers — Figma runtime rejects matchLayers on DISSOLVE. " +
    "For a fade that also morphs shared layers, use a directional transition with matchLayers, e.g. {type:'PUSH', direction, matchLayers:true}.) " +
```

Write a memory `dissolve-matchlayers-rejected.md` recording the runtime rejection (mirrors `runtime-vs-typings-mismatch`).

- [ ] **Step 2: Full test run + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — all suites green (count increased by the tasks above).

- [ ] **Step 3: Live verification round**

With server + plugin + a real file (e.g. the greenfield fixture `MCP_test_13`), run in the MCP client:
1. A forward wire between two **non-matching** screens with default motion → confirm the created reaction's transition is the degraded DISSOLVE/INSTANT (not SMART_ANIMATE). Check the returned warning.
2. A forward wire between two screens that **share a layer name** → confirm SMART_ANIMATE is kept.
3. "밀어서 / 올라와" wire → confirm a directional PUSH/MOVE transition.
4. "뒤로가기 달아줘" on a frame with a top-left back button → confirm proto_back wires the back node with ON_CLICK (not a swipe).

Record results in the matrix doc's greenfield section.

- [ ] **Step 4: Update matrix doc + commit**

```bash
git add docs/dictionaries/tool-disambiguation-matrix.md src/ tests/
git commit -m "feat(steering): A2 DISSOLVE matchLayers per live probe + R2 verification"
```

---

## Self-Review Notes

- **Spec coverage:** A1 → Tasks 1-6; A2 → Tasks 9-10; A3 → Task 7; B → Task 8; testing/live → Task 10. All spec sections mapped.
- **Type consistency:** `degradeTo: "DISSOLVE" | "INSTANT" | undefined` is consistent across `degradeTransition`, `resolveNavigateTransition`, `buildNonConditionalAction`, and the zod `z.enum(["DISSOLVE","INSTANT"])`. `findTopLevelFrameNode`/`framesShareLayer`/`collectDescendantLayerNames`/`isSmartAnimate`/`degradeTransition`/`resolveNavigateTransition` names match between definition and call sites.
- **Probe gating:** Task 9 is the only step with an unknown outcome; Task 10 branches explicitly (1a vs 1b) so neither path is a placeholder.
