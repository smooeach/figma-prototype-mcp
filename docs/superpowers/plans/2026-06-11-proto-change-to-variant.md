# proto_change_to (Component Variant Switching) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `proto_change_to` high-level tool (plus a low-level `change_to` action) that wires a component instance to switch to a sibling variant on interaction — Figma's `CHANGE_TO` navigation.

**Architecture:** Mirror the existing proto_* stack exactly: a low-level `change_to` action on `create_reactions` → a plugin builder (`buildChangeToReaction`) emitting `{type:"NODE", navigation:"CHANGE_TO", destinationId, transition}` → a `change_to` branch in `buildNonConditionalAction` (validates the target is a COMPONENT variant) → a high-level `proto_change_to` tool wrapping `compileProtoChangeTo`. Motion is passed through; a live probe (Task 7) confirms the runtime accepts a SMART_ANIMATE transition on CHANGE_TO, with an overlay-style DISSOLVE rewrite as the contingency (Task 8).

**Tech Stack:** TypeScript, Zod, Vitest, Figma Plugin API. Compiles to a plugin bundle (`code.ts`, no zod) + an MCP server.

---

## File Structure

- `src/mcp-server/tools.ts` — add `ChangeToActionInput`; add it to `NonConditionalActionInput` + `ActionInput` unions.
- `src/figma-plugin/reaction-builder.ts` — add `"CHANGE_TO"` to the `BuiltAction` NODE navigation union; add `buildChangeToReaction` + its `ChangeToBuildInput` type.
- `src/figma-plugin/code.ts` — import `buildChangeToReaction`; add a `change_to` branch to `buildNonConditionalAction`.
- `src/mcp-server/protoTools.ts` — add `ProtoChangeToEntry` + `ProtoChangeToInput` + `compileProtoChangeTo`.
- `src/server/tools.ts` — register the `proto_change_to` tool.
- Tests: `tests/tools.test.ts`, `tests/reaction-builder.test.ts`, `tests/protoTools-compile.test.ts`.

---

## Task 1: Low-level `change_to` action schema (`tools.ts`)

**Files:**
- Modify: `src/mcp-server/tools.ts` (after `ToggleVariableActionInput` ~202; the two union arrays ~207 and ~226)
- Test: `tests/tools.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/tools.test.ts` (`CreateReactionsInput` is already imported there):

```typescript
describe("change_to action", () => {
  it("accepts a change_to action with targetVariantId", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "i1", action: { type: "change_to", targetVariantId: "v1" } }],
    });
    expect(parsed.connections[0].action).toEqual({ type: "change_to", targetVariantId: "v1" });
  });
  it("rejects change_to without targetVariantId", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "i1", action: { type: "change_to" } }],
    })).toThrow();
  });
  it("allows change_to inside a conditional then-branch", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "i1",
        action: {
          type: "conditional",
          condition: { variable: "v", operator: "EQ", value: true },
          then: [{ type: "change_to", targetVariantId: "v1" }],
        },
      }],
    });
    expect((parsed.connections[0].action as { then: unknown[] }).then[0]).toEqual({
      type: "change_to", targetVariantId: "v1",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools.test.ts`
Expected: FAIL — `change_to` is not a recognized action type (discriminated-union parse error).

- [ ] **Step 3: Add the action schema + wire into both unions**

In `src/mcp-server/tools.ts`, immediately after the `ToggleVariableActionInput` definition (~line 202), add:

```typescript
const ChangeToActionInput = z.object({
  type: z.literal("change_to"),
  targetVariantId: z.string().min(1),
});
```

Add `ChangeToActionInput,` to the `NonConditionalActionInput` array (after `SetVariableActionInput,`):

```typescript
const NonConditionalActionInput = z.discriminatedUnion("type", [
  NavigateActionInput,
  ScrollActionInput,
  OverlayActionInput,
  CloseActionInput,
  BackActionInput,
  UrlActionInput,
  SwapOverlayActionInput,
  SetVariableActionInput,
  ChangeToActionInput,
]);
```

Add `ChangeToActionInput,` to the `ActionInput` array as well (after `ToggleVariableActionInput,`):

```typescript
const ActionInput = z.discriminatedUnion("type", [
  NavigateActionInput,
  ScrollActionInput,
  OverlayActionInput,
  CloseActionInput,
  BackActionInput,
  UrlActionInput,
  SwapOverlayActionInput,
  ConditionalActionInput,
  SetVariableActionInput,
  ToggleVariableActionInput,
  ChangeToActionInput,
]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/tools.ts tests/tools.test.ts
git commit -m "feat(schema): low-level change_to action (conditional-usable)"
```

---

## Task 2: `buildChangeToReaction` + CHANGE_TO navigation (`reaction-builder.ts`)

**Files:**
- Modify: `src/figma-plugin/reaction-builder.ts` (`BuiltAction` NODE union ~115; add builder after `buildNavigateReaction` ~320)
- Test: `tests/reaction-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/reaction-builder.test.ts` (`buildChangeToReaction` is the new import):

```typescript
import { buildChangeToReaction } from "../src/figma-plugin/reaction-builder.js";

describe("buildChangeToReaction", () => {
  it("emits a NODE action with CHANGE_TO navigation and the variant destination", () => {
    const r = buildChangeToReaction({
      targetVariantId: "v:highlight",
      trigger: "ON_CLICK",
      transition: "SMART_ANIMATE",
    });
    expect(r.actions[0]).toEqual({
      type: "NODE",
      destinationId: "v:highlight",
      navigation: "CHANGE_TO",
      transition: { type: "SMART_ANIMATE", duration: 0.3, easing: { type: "EASE_OUT" } },
    });
  });
  it("supports INSTANT (null transition)", () => {
    const r = buildChangeToReaction({ targetVariantId: "v1", trigger: "ON_CLICK", transition: "INSTANT" });
    expect((r.actions[0] as { transition: unknown }).transition).toBe(null);
  });
  it("builds the trigger via buildTrigger", () => {
    const r = buildChangeToReaction({ targetVariantId: "v1", trigger: "ON_CLICK", transition: "INSTANT" });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/reaction-builder.test.ts`
Expected: FAIL — `buildChangeToReaction is not a function`.

- [ ] **Step 3: Implement**

In `src/figma-plugin/reaction-builder.ts`, extend the `BuiltAction` NODE navigation union (the line `navigation: "NAVIGATE" | "SCROLL_TO" | "OVERLAY" | "SWAP";`):

```typescript
      navigation: "NAVIGATE" | "SCROLL_TO" | "OVERLAY" | "SWAP" | "CHANGE_TO";
```

Add a build-input interface near the other `*BuildInput` interfaces (e.g. after `NavigateBuildInput`):

```typescript
export interface ChangeToBuildInput {
  targetVariantId: string;
  trigger: TriggerInput;
  transition: TransitionInput;
  afterTimeoutSeconds?: number;
}
```

Add the builder immediately after `buildNavigateReaction`:

```typescript
/**
 * Build a "Change to" reaction: switch the triggering node's nearest component
 * instance to the variant identified by `targetVariantId`. Emits a NODE action
 * with CHANGE_TO navigation — the same action shape Figma uses for NAVIGATE,
 * confirmed accepted by setReactionsAsync (probe 2026-06-11).
 */
export function buildChangeToReaction(input: ChangeToBuildInput): BuiltReaction {
  const action: BuiltAction = {
    type: "NODE",
    destinationId: input.targetVariantId,
    navigation: "CHANGE_TO",
    transition: buildTransition(input.transition),
  };
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [action],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/reaction-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/reaction-builder.ts tests/reaction-builder.test.ts
git commit -m "feat(plugin): buildChangeToReaction + CHANGE_TO navigation"
```

---

## Task 3: `change_to` branch in the plugin dispatch (`code.ts`)

**Files:**
- Modify: `src/figma-plugin/code.ts` (import ~5-18; `buildNonConditionalAction` branches ~138-200)

No unit test — `code.ts` depends on `figma.*` and is not unit-tested in this repo; covered by the live verification in Tasks 7/9.

- [ ] **Step 1: Add the import**

In `src/figma-plugin/code.ts`, add `buildChangeToReaction` to the `reaction-builder.js` import block (alongside `buildNavigateReaction`):

```typescript
  buildNavigateReaction,
  buildChangeToReaction,
  buildScrollReaction,
```

- [ ] **Step 2: Add the `change_to` branch**

In `buildNonConditionalAction`, add this branch right after the `navigate` branch (after its closing `}` ~line 156, before the `scroll` branch):

```typescript
  if (action.type === "change_to") {
    const target = figma.getNodeById(action.targetVariantId);
    if (!target) throw new Error(`Change-to target not found: ${action.targetVariantId}`);
    if (target.type !== "COMPONENT") {
      throw new Error(`Change-to target must be a component variant: ${action.targetVariantId} (got ${target.type})`);
    }
    // Figma applies CHANGE_TO to the nearest INSTANCE ancestor of the source.
    let cur: BaseNode | null = sourceNode;
    let hasInstance = false;
    while (cur) {
      if (cur.type === "INSTANCE") { hasInstance = true; break; }
      cur = cur.parent;
    }
    const reaction = buildChangeToReaction({
      targetVariantId: action.targetVariantId,
      trigger, afterTimeoutSeconds, transition,
    });
    const warning = hasInstance
      ? undefined
      : `Change-to source ${sourceNode.id} is not (and is not inside) a component instance; the reaction will not animate at runtime`;
    return { built: reaction.actions[0]!, warning };
  }
```

- [ ] **Step 3: Typecheck + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — no type errors, all suites green (the discriminated union now routes `change_to`).

- [ ] **Step 4: Commit**

```bash
git add src/figma-plugin/code.ts
git commit -m "feat(plugin): change_to branch — validate variant target + instance warning"
```

---

## Task 4: `compileProtoChangeTo` (`protoTools.ts`)

**Files:**
- Modify: `src/mcp-server/protoTools.ts` (entry schemas near `ProtoWireEntry` ~36; compile fns near `compileProtoWire` ~272)
- Test: `tests/protoTools-compile.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/protoTools-compile.test.ts` (mirror the existing `compileProtoWire`/`ProtoWireInput` import style — add `compileProtoChangeTo` and `ProtoChangeToInput` to the imports from `../src/mcp-server/protoTools.js`):

```typescript
describe("compileProtoChangeTo", () => {
  it("maps a change entry to a change_to connection with defaults", () => {
    const out = compileProtoChangeTo(ProtoChangeToInput.parse({
      changes: [{ from: "i1", to: "v1" }],
    }));
    expect(out.connections[0].sourceNodeId).toBe("i1");
    expect(out.connections[0].trigger).toEqual({ type: "ON_CLICK" });
    expect(out.connections[0].action).toEqual({ type: "change_to", targetVariantId: "v1" });
  });
  it("threads replaceExisting", () => {
    const out = compileProtoChangeTo(ProtoChangeToInput.parse({
      changes: [{ from: "i1", to: "v1" }], replaceExisting: true,
    }));
    expect(out.replaceExisting).toBe(true);
  });
  it("defaults motion to a SMART_ANIMATE transition", () => {
    const out = compileProtoChangeTo(ProtoChangeToInput.parse({ changes: [{ from: "i1", to: "v1" }] }));
    const t = out.connections[0].transition;
    const type = typeof t === "string" ? t : (t as { type: string }).type;
    expect(type).toBe("SMART_ANIMATE");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/protoTools-compile.test.ts`
Expected: FAIL — `compileProtoChangeTo`/`ProtoChangeToInput` are not exported.

- [ ] **Step 3: Implement**

In `src/mcp-server/protoTools.ts`, add the entry + input schema near `ProtoWireEntry` (after the `ProtoWireInput` definition):

```typescript
const ProtoChangeToEntry = z.object({
  from: z.string().min(1).describe("Source node ID — a component instance (or a node inside one), NOT a name. Resolve via find_nodes."),
  to: z.string().min(1).describe("Target variant node ID — a COMPONENT inside the same component set, NOT a name. Resolve via find_nodes."),
  trigger: TriggerInput.optional(),
  motion: MotionInputSchema.optional(),
});

export const ProtoChangeToInput = z.object({
  changes: z.array(ProtoChangeToEntry).min(1),
  replaceExisting: z.boolean().optional(),
});
export type ProtoChangeToInput = z.infer<typeof ProtoChangeToInput>;
```

Add the compile function after `compileProtoWire`:

```typescript
export function compileProtoChangeTo(input: ProtoChangeToInput): CreateReactionsInputType {
  const connections: Connection[] = input.changes.map((w) =>
    buildConnection(w.from, w.trigger, w.motion, { type: "change_to", targetVariantId: w.to }),
  );
  return { connections, replaceExisting: input.replaceExisting };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/protoTools-compile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/protoTools.ts tests/protoTools-compile.test.ts
git commit -m "feat(proto): compileProtoChangeTo + ProtoChangeToInput schema"
```

---

## Task 5: Register the `proto_change_to` tool (`server/tools.ts`)

**Files:**
- Modify: `src/server/tools.ts` (imports for proto compile/inputs; add a TOOLS entry near `proto_wire` ~130)

No new unit test — registration is exercised by the live round (Task 9). Verified here by typecheck + full test run.

- [ ] **Step 1: Import the new schema + compiler**

In `src/server/tools.ts`, add `ProtoChangeToInput` and `compileProtoChangeTo` to the existing imports from `../mcp-server/protoTools.js` (match the import style used for `ProtoWireInput`/`compileProtoWire`), and add `ProtoChangeToInput` to the type import block if input types are imported separately (mirror how `ProtoWireInput` is imported as a type for the `parsedInput` cast).

- [ ] **Step 2: Register the tool**

In the `TOOLS` array, add this entry immediately after the `proto_wire` entry (after its closing `},`):

```typescript
    {
      name: "proto_change_to",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Switch a component INSTANCE to a sibling VARIANT on interaction (Figma's 'Change to'). " +
        "Use for toggles, tabs, segmented controls, and on/off or selected/unselected state changes " +
        "driven by variants of one component — KO cues: 'highlight 상태로 바꿔', '토글', 'variant 바꿔', " +
        "'선택 상태로'. `from` = a component instance node ID (or a node inside one); `to` = the target " +
        "variant node ID (a COMPONENT inside the same component set) — both are node IDs, NOT names; " +
        "resolve names via find_nodes first. For a whole-screen change use proto_wire; for a data value use " +
        "proto_set_variable. Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED (SMART_ANIMATE morph between variants). " +
        "Compiles to create_reactions internally.",
      schema: ProtoChangeToInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoChangeToInput;
        return recordedHandler(historyStore, "proto_change_to", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoChangeTo(parsedInput)),
        );
      },
    },
```

- [ ] **Step 3: Typecheck + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Build the plugin bundle**

Run: `npm run build:plugin`
Expected: `Build success`.

- [ ] **Step 5: Commit**

```bash
git add src/server/tools.ts
git commit -m "feat(server): register proto_change_to tool (17th tool)"
```

---

## Task 6: NL-steering describe + matrix doc

**Files:**
- Modify: `docs/dictionaries/tool-disambiguation-matrix.md` (Part 1 tool-selection rows)

Pure docs. The tool `describe()` was written in Task 5.

- [ ] **Step 1: Add matrix rows**

In `docs/dictionaries/tool-disambiguation-matrix.md`, under Part 1 (Tool selection), add:

```markdown
| "highlight 상태로 바꿔" / "토글" / "selected 상태로" (component variant) | proto_change_to | instance → sibling variant; `to` is a variant node ID (find_nodes). NOT proto_wire (frame) / NOT set_variable (data value) |
| "이 버튼 누르면 눌린 상태로" (variant of same component) | proto_change_to | ON_CLICK switch to the pressed/active variant |
```

- [ ] **Step 2: Verify**

Run: `npx vitest run`
Expected: PASS (no test asserts on the doc; confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add docs/dictionaries/tool-disambiguation-matrix.md
git commit -m "docs(matrix): proto_change_to tool-selection rows"
```

---

## Task 7: Live probe — SMART_ANIMATE transition on CHANGE_TO (gating)

This needs the live server (`npm start`), the plugin connected, and the variant fixture `MCP_test_16` (COMPONENT_SET `button`; variants `state=normal` `1404:34003` / `state=highlight` `1404:34002`; instance `1404:34005`). No temp code — the built tool IS the probe.

- [ ] **Step 1: Start server + connect plugin**

Run `npm start`; reload the Figma plugin so it connects to `ws://localhost:3000/ws` on the page holding `MCP_test_16`.

- [ ] **Step 2: Run a default-motion change_to and observe**

Drive one `proto_change_to` via an MCP SSE client (or Claude Desktop):
`{ changes: [{ from: "1404:34005", to: "1404:34002" }] }` (default motion M3_EMPHASIZED = SMART_ANIMATE).

Expected — one of:
- **ACCEPTED:** `successCount: 1`; `list_reactions` on `1404:34005` shows `action.transition.type === "SMART_ANIMATE"`. → CHANGE_TO carries SMART_ANIMATE at runtime; no rewrite needed. **Skip Task 8.**
- **REJECTED:** `setReactionsAsync` error (Unrecognized-key / invalid transition class, like overlay). → Task 8 adds the DISSOLVE rewrite.

- [ ] **Step 3: Record the outcome**

Note ACCEPTED or REJECTED in `docs/dictionaries/tool-disambiguation-matrix.md` (a line under the greenfield/R-section) and carry it into Task 8/9.

---

## Task 8: (ONLY if Task 7 REJECTED) DISSOLVE rewrite for change_to

**Files:**
- Modify: `src/mcp-server/protoTools.ts` (`compileProtoChangeTo` + reuse `rewriteForOverlay`)
- Test: `tests/protoTools-compile.test.ts`

Skip this task entirely if Task 7 was ACCEPTED.

- [ ] **Step 1: Write the failing test**

Append to `tests/protoTools-compile.test.ts`:

```typescript
it("rewrites SMART_ANIMATE motion to DISSOLVE for change_to (runtime-rejected SMART_ANIMATE)", () => {
  const out = compileProtoChangeTo(ProtoChangeToInput.parse({
    changes: [{ from: "i1", to: "v1", motion: "M3_EMPHASIZED" }],
  }));
  const t = out.connections[0].transition;
  const type = typeof t === "string" ? t : (t as { type: string }).type;
  expect(type).toBe("DISSOLVE");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/protoTools-compile.test.ts`
Expected: FAIL — type is `SMART_ANIMATE`, not `DISSOLVE`.

- [ ] **Step 3: Apply the rewrite**

In `compileProtoChangeTo`, pass `rewriteForOverlay` as the `transformTransition` arg to `buildConnection` (it already exists for the overlay case and does exactly the SMART_ANIMATE→DISSOLVE rewrite preserving duration/easing):

```typescript
export function compileProtoChangeTo(input: ProtoChangeToInput): CreateReactionsInputType {
  const connections: Connection[] = input.changes.map((w) =>
    buildConnection(w.from, w.trigger, w.motion, { type: "change_to", targetVariantId: w.to }, rewriteForOverlay),
  );
  return { connections, replaceExisting: input.replaceExisting };
}
```

Also append to the `proto_change_to` description in `src/server/tools.ts` (before "Compiles to create_reactions internally."):

```typescript
        "(Figma rejects SMART_ANIMATE on a variant switch, so a SMART_ANIMATE preset is rewritten to DISSOLVE, preserving duration/easing.) " +
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/protoTools.ts src/server/tools.ts tests/protoTools-compile.test.ts
git commit -m "fix(proto): rewrite SMART_ANIMATE to DISSOLVE for change_to (runtime limit)"
```

---

## Task 9: Final live verification + matrix doc + release

**Files:**
- Modify: `docs/dictionaries/tool-disambiguation-matrix.md`, `package.json`

- [ ] **Step 1: Full test run + typecheck + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build:plugin`
Expected: all green; build success.

- [ ] **Step 2: Live verification round** (server + plugin + `MCP_test_16`)

Drive via an MCP SSE client (or Claude Desktop):
1. `proto_change_to { changes: [{ from: "1404:34005", to: "1404:34002" }] }` → `list_reactions` on `1404:34005` shows `action.navigation === "CHANGE_TO"`, `destinationId === "1404:34002"`, and the transition per the Task-7 outcome (SMART_ANIMATE if accepted, else DISSOLVE).
2. `proto_change_to` with `to` pointing at a non-COMPONENT node → tool returns the "must be a component variant" error.
3. `proto_change_to` from a non-instance node → succeeds with the instance warning.

Record results in `docs/dictionaries/tool-disambiguation-matrix.md`.

- [ ] **Step 3: Version bump + commit**

```bash
# bump "version" in package.json to 0.27.0
git add package.json docs/dictionaries/tool-disambiguation-matrix.md
git commit -m "chore(release): v0.27.0 — proto_change_to component variant switching"
```

- [ ] **Step 4: Tag + release** (after merge to main)

```bash
git tag -a v0.27.0 -m "v0.27.0 — proto_change_to (component variant switching)"
# push + gh release per the project's release flow
```

---

## Self-Review Notes

- **Spec coverage:** ① tool → Task 5; ② low-level action → Task 1; ③ plugin build path → Tasks 2-3; ④ motion probe-gate → Tasks 7-8; ⑤ compile → Task 4; ⑥ describe/matrix → Tasks 5-6; ⑦ testing → unit in Tasks 1/2/4/8 + live in Tasks 7/9. All spec sections mapped.
- **Type consistency:** `change_to`/`targetVariantId` identical across `ChangeToActionInput`, `buildChangeToReaction`, the code.ts branch, and `compileProtoChangeTo`. `ProtoChangeToInput`/`compileProtoChangeTo` names match between protoTools.ts and server/tools.ts. `CHANGE_TO` navigation added to the `BuiltAction` union (Task 2) before the code.ts branch (Task 3) uses it.
- **Probe gating:** Task 7 is the only unknown-outcome step; Task 8 is explicitly skipped on ACCEPT, so neither path is a placeholder.
- **No degrade:** intentionally omitted (variants share structure) — consistent with the spec.
