# Wire-vocabulary single source (Candidate C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate every drift-risk wire vocabulary (trigger / transition / easing / direction / comparison-operator / overflow-direction enums) into one pure `src/shared/wire-vocabulary.ts`, so the server zod schemas and the plugin TS types derive from a single source.

**Architecture:** A new pure module exports each vocabulary as an `as const` tuple plus a derived type. The server uses `z.enum(<CONST>)`; the plugin imports the derived types. Behavior and wire format are unchanged — only the origin of the literals moves. No new runtime dependency enters the plugin sandbox bundle (no zod).

**Tech Stack:** TypeScript, zod ^3.25 (verified to accept `readonly` tuples in `z.enum`), vitest, tsup (bundles `src/shared/` into the plugin).

---

## File structure

- **Create** `src/shared/wire-vocabulary.ts` — the single source: `as const` arrays + derived types.
- **Create** `tests/wire-vocabulary.test.ts` — member snapshots, `z.enum` round-trip, cross-side conformance.
- **Modify** `src/mcp-server/tools.ts` — `z.enum(<CONST>)` in place of inline literal arrays.
- **Modify** `src/figma-plugin/reaction-builder.ts` — derive trigger/transition/easing/direction types from shared, keep public names as aliases.
- **Modify** `src/figma-plugin/condition-codec.ts` — derive `ComparisonOperator` from shared; type the translation map as `Record<ComparisonOperator, ...>`.
- **Modify** `src/figma-plugin/code.ts` — replace two inline overflow-direction unions with the shared `OverflowDirection` type.

Existing suites (`tests/tools.test.ts`, `tests/reaction-builder.test.ts`, `tests/condition-codec.test.ts`, etc., 383 tests total) are the behavioral regression guard: they must stay green unchanged after each migration task.

---

### Task 1: Create the shared module + its unit test

**Files:**
- Create: `src/shared/wire-vocabulary.ts`
- Test: `tests/wire-vocabulary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/wire-vocabulary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  TRIGGER_SHORTCUTS,
  TRIGGER_NOPARAM_TYPES,
  MOUSE_CLICK_TYPES,
  MOUSE_HOVER_TYPES,
  KEYBOARD_DEVICES,
  TRANSITION_SHORTCUTS,
  SIMPLE_TRANSITION_TYPES,
  DIRECTIONAL_TRANSITION_TYPES,
  NAMED_EASINGS,
  DIRECTIONS,
  COMPARISON_OPERATORS,
  OVERFLOW_DIRECTIONS,
} from "../src/shared/wire-vocabulary.js";

describe("wire-vocabulary member snapshots", () => {
  it("triggers", () => {
    expect([...TRIGGER_SHORTCUTS]).toEqual(["ON_CLICK", "ON_HOVER", "ON_PRESS", "AFTER_TIMEOUT"]);
    expect([...TRIGGER_NOPARAM_TYPES]).toEqual(["ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG", "ON_MEDIA_END"]);
    expect([...MOUSE_CLICK_TYPES]).toEqual(["MOUSE_UP", "MOUSE_DOWN"]);
    expect([...MOUSE_HOVER_TYPES]).toEqual(["MOUSE_ENTER", "MOUSE_LEAVE"]);
    expect([...KEYBOARD_DEVICES]).toEqual(["KEYBOARD", "XBOX_ONE", "PS4", "SWITCH_PRO", "UNKNOWN_CONTROLLER"]);
  });

  it("transitions", () => {
    expect([...TRANSITION_SHORTCUTS]).toEqual(["INSTANT", "DISSOLVE", "SMART_ANIMATE"]);
    expect([...SIMPLE_TRANSITION_TYPES]).toEqual(["DISSOLVE", "SMART_ANIMATE", "SCROLL_ANIMATE"]);
    expect([...DIRECTIONAL_TRANSITION_TYPES]).toEqual(["MOVE_IN", "MOVE_OUT", "PUSH", "SLIDE_IN", "SLIDE_OUT"]);
    expect([...NAMED_EASINGS]).toEqual([
      "LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT",
      "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK",
      "GENTLE", "QUICK", "BOUNCY", "SLOW",
    ]);
    expect([...DIRECTIONS]).toEqual(["LEFT", "RIGHT", "TOP", "BOTTOM"]);
  });

  it("other vocabularies", () => {
    expect([...COMPARISON_OPERATORS]).toEqual(["==", "!=", "<", "<=", ">", ">="]);
    expect([...OVERFLOW_DIRECTIONS]).toEqual(["NONE", "HORIZONTAL", "VERTICAL", "BOTH"]);
  });
});

describe("wire-vocabulary feeds z.enum", () => {
  it("accepts every member and rejects a bad value", () => {
    const e = z.enum(TRIGGER_SHORTCUTS);
    for (const v of TRIGGER_SHORTCUTS) expect(e.parse(v)).toBe(v);
    expect(() => e.parse("NOT_A_TRIGGER")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wire-vocabulary.test.ts`
Expected: FAIL — cannot resolve `../src/shared/wire-vocabulary.js` (module does not exist yet).

- [ ] **Step 3: Create the module**

Create `src/shared/wire-vocabulary.ts`:

```ts
// Single source of truth for the string-literal vocabularies that cross the
// WebSocket wire between the MCP server (zod input schemas) and the Figma plugin
// (TS input types). Pure: no figma.*, no Node, no zod — so it bundles into the
// plugin sandbox and stays unit-testable. The server derives `z.enum(<CONST>)`
// from these; the plugin derives `type X = typeof <CONST>[number]`.

// --- Triggers ---
export const TRIGGER_SHORTCUTS = ["ON_CLICK", "ON_HOVER", "ON_PRESS", "AFTER_TIMEOUT"] as const;
export type TriggerName = (typeof TRIGGER_SHORTCUTS)[number];

export const TRIGGER_NOPARAM_TYPES = ["ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG", "ON_MEDIA_END"] as const;
export type TriggerNoParamType = (typeof TRIGGER_NOPARAM_TYPES)[number];

export const MOUSE_CLICK_TYPES = ["MOUSE_UP", "MOUSE_DOWN"] as const;
export type MouseClickType = (typeof MOUSE_CLICK_TYPES)[number];

export const MOUSE_HOVER_TYPES = ["MOUSE_ENTER", "MOUSE_LEAVE"] as const;
export type MouseHoverType = (typeof MOUSE_HOVER_TYPES)[number];

export const KEYBOARD_DEVICES = ["KEYBOARD", "XBOX_ONE", "PS4", "SWITCH_PRO", "UNKNOWN_CONTROLLER"] as const;
export type KeyboardDevice = (typeof KEYBOARD_DEVICES)[number];

// --- Transitions ---
export const TRANSITION_SHORTCUTS = ["INSTANT", "DISSOLVE", "SMART_ANIMATE"] as const;
export type TransitionName = (typeof TRANSITION_SHORTCUTS)[number];

export const SIMPLE_TRANSITION_TYPES = ["DISSOLVE", "SMART_ANIMATE", "SCROLL_ANIMATE"] as const;
export type SimpleTransitionType = (typeof SIMPLE_TRANSITION_TYPES)[number];

export const DIRECTIONAL_TRANSITION_TYPES = ["MOVE_IN", "MOVE_OUT", "PUSH", "SLIDE_IN", "SLIDE_OUT"] as const;
export type DirectionalTransitionType = (typeof DIRECTIONAL_TRANSITION_TYPES)[number];

export const NAMED_EASINGS = [
  "LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT",
  "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK",
  "GENTLE", "QUICK", "BOUNCY", "SLOW",
] as const;
export type NamedEasingName = (typeof NAMED_EASINGS)[number];

export const DIRECTIONS = ["LEFT", "RIGHT", "TOP", "BOTTOM"] as const;
export type Direction = (typeof DIRECTIONS)[number];

// --- Other ---
export const COMPARISON_OPERATORS = ["==", "!=", "<", "<=", ">", ">="] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export const OVERFLOW_DIRECTIONS = ["NONE", "HORIZONTAL", "VERTICAL", "BOTH"] as const;
export type OverflowDirection = (typeof OVERFLOW_DIRECTIONS)[number];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wire-vocabulary.test.ts`
Expected: PASS (2 describe blocks, all assertions green).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean (no output).

- [ ] **Step 6: Commit**

```bash
git add src/shared/wire-vocabulary.ts tests/wire-vocabulary.test.ts
git commit -m "feat(shared): add wire-vocabulary single source (as const + derived types)"
```

---

### Task 2: Migrate the server schemas to consume the constants

**Files:**
- Modify: `src/mcp-server/tools.ts` (add import; replace 12 inline `z.enum` arrays)

`tests/tools.test.ts` (99 tests) is the behavioral guard — it must stay green with no edits.

- [ ] **Step 1: Add the import at the top of `src/mcp-server/tools.ts`**

After the existing `import { z } from "zod";` (line 1), add:

```ts
import {
  TRIGGER_SHORTCUTS,
  TRIGGER_NOPARAM_TYPES,
  MOUSE_CLICK_TYPES,
  MOUSE_HOVER_TYPES,
  KEYBOARD_DEVICES,
  TRANSITION_SHORTCUTS,
  SIMPLE_TRANSITION_TYPES,
  DIRECTIONAL_TRANSITION_TYPES,
  NAMED_EASINGS,
  DIRECTIONS,
  COMPARISON_OPERATORS,
  OVERFLOW_DIRECTIONS,
} from "../shared/wire-vocabulary.js";
```

- [ ] **Step 2: Replace each inline `z.enum([...])` with `z.enum(<CONST>)`**

Make these exact replacements (left → right) in `src/mcp-server/tools.ts`:

```ts
// TriggerEnum
z.enum(["ON_CLICK", "ON_HOVER", "ON_PRESS", "AFTER_TIMEOUT"])        → z.enum(TRIGGER_SHORTCUTS)
// KeyboardDeviceEnum
z.enum(["KEYBOARD", "XBOX_ONE", "PS4", "SWITCH_PRO", "UNKNOWN_CONTROLLER"]) → z.enum(KEYBOARD_DEVICES)
// TriggerObjectNoParam.type
z.enum(["ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG", "ON_MEDIA_END"]) → z.enum(TRIGGER_NOPARAM_TYPES)
// TriggerObjectMouseClick.type
z.enum(["MOUSE_UP", "MOUSE_DOWN"])                                   → z.enum(MOUSE_CLICK_TYPES)
// TriggerObjectMouseHover.type
z.enum(["MOUSE_ENTER", "MOUSE_LEAVE"])                               → z.enum(MOUSE_HOVER_TYPES)
// TransitionEnum
z.enum(["INSTANT", "DISSOLVE", "SMART_ANIMATE"])                     → z.enum(TRANSITION_SHORTCUTS)
// NamedEasingEnum (the 11-member array)
z.enum([... "LINEAR" ... "SLOW" ...])                                → z.enum(NAMED_EASINGS)
// SimpleTransitionObject.type
z.enum(["DISSOLVE", "SMART_ANIMATE", "SCROLL_ANIMATE"])              → z.enum(SIMPLE_TRANSITION_TYPES)
// DirectionEnum
z.enum(["LEFT", "RIGHT", "TOP", "BOTTOM"])                           → z.enum(DIRECTIONS)
// DirectionalTransitionObject.type
z.enum(["MOVE_IN", "MOVE_OUT", "PUSH", "SLIDE_IN", "SLIDE_OUT"])     → z.enum(DIRECTIONAL_TRANSITION_TYPES)
// ComparisonOperator
z.enum(["==", "!=", "<", "<=", ">", ">="])                           → z.enum(COMPARISON_OPERATORS)
// OverflowDirectionEnum
z.enum(["NONE", "HORIZONTAL", "VERTICAL", "BOTH"])                   → z.enum(OVERFLOW_DIRECTIONS)
```

Leave the `z.literal(...)` discriminants (`"AFTER_TIMEOUT"`, `"ON_KEY_DOWN"`, `"ON_MEDIA_HIT"`) and all action-intent literals (`"navigate"`, `"scroll"`, …) untouched.

- [ ] **Step 3: Run the server schema tests**

Run: `npx vitest run tests/tools.test.ts tests/protoTools.test.ts tests/protoTools-compile.test.ts`
Expected: PASS, unchanged counts (99 + 52 + 56).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Verify no inline arrays remain in this file**

Run: `git grep -n 'z.enum(\[' src/mcp-server/tools.ts`
Expected: NO matches (every `z.enum` now takes a constant).

- [ ] **Step 6: Commit**

```bash
git add src/mcp-server/tools.ts
git commit -m "refactor(server): derive enum schemas from shared wire-vocabulary"
```

---

### Task 3: Migrate the plugin reaction-builder types

**Files:**
- Modify: `src/figma-plugin/reaction-builder.ts` (replace hand-written unions with imported derived types; keep public names as aliases)

`tests/reaction-builder.test.ts` (72 tests) is the behavioral guard — stays green unchanged.

- [ ] **Step 1: Add the import at the top of `src/figma-plugin/reaction-builder.ts`**

At the very top (above the current line 1 comment is fine, but place after it for readability):

```ts
import type {
  TriggerName as WTriggerName,
  TriggerNoParamType,
  MouseClickType,
  MouseHoverType,
  KeyboardDevice as WKeyboardDevice,
  TransitionName as WTransitionName,
  SimpleTransitionType as WSimpleTransitionType,
  DirectionalTransitionType as WDirectionalTransitionType,
  NamedEasingName as WNamedEasingName,
  Direction as WDirection,
} from "../shared/wire-vocabulary.js";
```

(The `W`-prefixed import aliases avoid colliding with the local exported names we keep below.)

- [ ] **Step 2: Replace the hand-written union type declarations with aliases**

Replace these declarations in `src/figma-plugin/reaction-builder.ts`:

```ts
export type TransitionName = "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
```
→
```ts
export type TransitionName = WTransitionName;
```

```ts
export type SimpleTransitionType = "DISSOLVE" | "SMART_ANIMATE" | "SCROLL_ANIMATE";
```
→
```ts
export type SimpleTransitionType = WSimpleTransitionType;
```

```ts
export type NamedEasingName =
  | "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT"
  | "EASE_IN_BACK" | "EASE_OUT_BACK" | "EASE_IN_AND_OUT_BACK"
  | "GENTLE" | "QUICK" | "BOUNCY" | "SLOW";
```
→
```ts
export type NamedEasingName = WNamedEasingName;
```

```ts
export type DirectionalTransitionType =
  "MOVE_IN" | "MOVE_OUT" | "PUSH" | "SLIDE_IN" | "SLIDE_OUT";
```
→
```ts
export type DirectionalTransitionType = WDirectionalTransitionType;
```

```ts
export type Direction = "LEFT" | "RIGHT" | "TOP" | "BOTTOM";
```
→
```ts
export type Direction = WDirection;
```

```ts
export type TriggerName = "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "AFTER_TIMEOUT";
```
→
```ts
export type TriggerName = WTriggerName;
```

```ts
export type KeyboardDevice =
  | "KEYBOARD" | "XBOX_ONE" | "PS4" | "SWITCH_PRO" | "UNKNOWN_CONTROLLER";
```
→
```ts
export type KeyboardDevice = WKeyboardDevice;
```

- [ ] **Step 3: Replace the inline object-union `type` literals in `TriggerInput` and `TriggerShape`**

In `TriggerInput` (currently lines ~74–81), replace the inline literal sets:

```ts
export type TriggerInput =
  | "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "AFTER_TIMEOUT"
  | { type: "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "ON_DRAG" | "ON_MEDIA_END" }
  | { type: "AFTER_TIMEOUT"; timeout: number }
  | { type: "MOUSE_UP" | "MOUSE_DOWN"; delay?: number }
  | { type: "MOUSE_ENTER" | "MOUSE_LEAVE"; delay?: number }
  | { type: "ON_KEY_DOWN"; device: KeyboardDevice; keyCodes: number[] }
  | { type: "ON_MEDIA_HIT"; mediaHitTime: number };
```
→
```ts
export type TriggerInput =
  | TriggerName
  | { type: TriggerNoParamType }
  | { type: "AFTER_TIMEOUT"; timeout: number }
  | { type: MouseClickType; delay?: number }
  | { type: MouseHoverType; delay?: number }
  | { type: "ON_KEY_DOWN"; device: KeyboardDevice; keyCodes: number[] }
  | { type: "ON_MEDIA_HIT"; mediaHitTime: number };
```

In `TriggerShape` (currently lines ~116–122), replace likewise:

```ts
export type TriggerShape =
  | { type: "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "ON_DRAG" | "ON_MEDIA_END" }
  | { type: "AFTER_TIMEOUT"; timeout: number }
  | { type: "MOUSE_UP" | "MOUSE_DOWN"; delay: number }
  | { type: "MOUSE_ENTER" | "MOUSE_LEAVE"; delay: number }
  | { type: "ON_KEY_DOWN"; device: KeyboardDevice; keyCodes: number[] }
  | { type: "ON_MEDIA_HIT"; mediaHitTime: number };
```
→
```ts
export type TriggerShape =
  | { type: TriggerNoParamType }
  | { type: "AFTER_TIMEOUT"; timeout: number }
  | { type: MouseClickType; delay: number }
  | { type: MouseHoverType; delay: number }
  | { type: "ON_KEY_DOWN"; device: KeyboardDevice; keyCodes: number[] }
  | { type: "ON_MEDIA_HIT"; mediaHitTime: number };
```

Leave the runtime `switch`/`if` string comparisons in the build functions (e.g. `case "ON_CLICK":`, `input === "DISSOLVE"`) as-is — they are value checks against the same vocabulary and remain correct; converting them is out of scope and would add noise.

- [ ] **Step 4: Run the plugin builder tests**

Run: `npx vitest run tests/reaction-builder.test.ts`
Expected: PASS, 72 tests, unchanged.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Verify no inline union literal sets remain for these vocabularies**

Run: `git grep -n '"INSTANT"\|"MOVE_IN"\|"MOUSE_ENTER"\|"SMART_ANIMATE" |' src/figma-plugin/reaction-builder.ts`
Expected: matches only inside runtime `switch`/`if`/`case` bodies (value checks), NOT in `type ... =` declarations.

- [ ] **Step 7: Commit**

```bash
git add src/figma-plugin/reaction-builder.ts
git commit -m "refactor(plugin): derive reaction-builder types from shared wire-vocabulary"
```

---

### Task 4: Migrate condition-codec (operator) and code.ts (overflow)

**Files:**
- Modify: `src/figma-plugin/condition-codec.ts` (derive `ComparisonOperator` from shared; type the map)
- Modify: `src/figma-plugin/code.ts` (replace 2 inline overflow unions)

`tests/condition-codec.test.ts` (17 tests) is the behavioral guard — stays green unchanged.

- [ ] **Step 1: Rewire `ComparisonOperator` in `src/figma-plugin/condition-codec.ts`**

Add to the imports at the top (there is already `import type { ... } from "./variable-literal.js";`):

```ts
import type { ComparisonOperator } from "../shared/wire-vocabulary.js";
```

Then change the map + type. Replace:

```ts
export const COMPARISON_OPERATOR_MAP = {
  "==": "EQUALS",
  "!=": "NOT_EQUAL",
  "<":  "LESS_THAN",
  "<=": "LESS_THAN_OR_EQUAL",
  ">":  "GREATER_THAN",
  ">=": "GREATER_THAN_OR_EQUAL",
} as const;

export type ComparisonOperator = keyof typeof COMPARISON_OPERATOR_MAP;
```
→
```ts
// Translation from our operator symbols (the shared wire vocabulary) to Figma's
// ExpressionFunction. Typed as Record<ComparisonOperator, ...> so adding an
// operator to the shared set without a translation here is a compile error.
export const COMPARISON_OPERATOR_MAP: Record<ComparisonOperator, string> = {
  "==": "EQUALS",
  "!=": "NOT_EQUAL",
  "<":  "LESS_THAN",
  "<=": "LESS_THAN_OR_EQUAL",
  ">":  "GREATER_THAN",
  ">=": "GREATER_THAN_OR_EQUAL",
};

export type { ComparisonOperator };
```

(Re-exporting `ComparisonOperator` preserves the existing `export type ComparisonOperator` that downstream code may import from this module.)

- [ ] **Step 2: Replace the two inline overflow unions in `src/figma-plugin/code.ts`**

Add to the imports near the other figma-plugin imports (e.g. after `import { ... } from "./reaction-builder.js";`):

```ts
import type { OverflowDirection } from "../shared/wire-vocabulary.js";
```

Then at both occurrences (around lines 113 and 797) replace:

```ts
    direction?: "NONE" | "HORIZONTAL" | "VERTICAL" | "BOTH";
```
→
```ts
    direction?: OverflowDirection;
```

(Use Edit with `replace_all: true` since the two lines are identical.)

Leave the runtime comparison `(cur as any).overflowDirection !== "NONE"` and the assignment `(node as FrameNode).overflowDirection = direction;` unchanged — value usage, still correct.

- [ ] **Step 3: Run the affected tests**

Run: `npx vitest run tests/condition-codec.test.ts`
Expected: PASS, 17 tests, unchanged.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean (this confirms `code.ts`'s overflow change compiles and the `Record<ComparisonOperator, string>` map is exhaustive).

- [ ] **Step 5: Verify no inline literals remain**

Run: `git grep -n '"NONE" | "HORIZONTAL"' src/figma-plugin/code.ts`
Expected: NO matches.
Run: `git grep -n 'keyof typeof COMPARISON_OPERATOR_MAP' src/figma-plugin/condition-codec.ts`
Expected: NO matches.

- [ ] **Step 6: Commit**

```bash
git add src/figma-plugin/condition-codec.ts src/figma-plugin/code.ts
git commit -m "refactor(plugin): derive operator + overflow types from shared wire-vocabulary"
```

---

### Task 5: Cross-side conformance test + full verification gate

**Files:**
- Modify: `tests/wire-vocabulary.test.ts` (add a cross-side conformance block)

- [ ] **Step 1: Add the conformance test**

Append to `tests/wire-vocabulary.test.ts`. This asserts the shared source actually reaches both the server schema (by parsing through it) and the plugin operator map (by importing it):

```ts
import { COMPARISON_OPERATOR_MAP } from "../src/figma-plugin/condition-codec.js";

describe("cross-side conformance: shared source reaches both sides", () => {
  it("the plugin operator-translation map covers exactly the shared operators", () => {
    expect(Object.keys(COMPARISON_OPERATOR_MAP).sort()).toEqual([...COMPARISON_OPERATORS].sort());
  });

  it("every shared comparison operator translates to a non-empty Figma function", () => {
    for (const op of COMPARISON_OPERATORS) {
      expect(typeof COMPARISON_OPERATOR_MAP[op]).toBe("string");
      expect(COMPARISON_OPERATOR_MAP[op].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the conformance test**

Run: `npx vitest run tests/wire-vocabulary.test.ts`
Expected: PASS — all describe blocks green (snapshots + z.enum + conformance).

- [ ] **Step 3: Full suite + typecheck (the verification gate)**

Run: `npm test`
Expected: all test files pass; total = 383 (existing) + the new `wire-vocabulary.test.ts` tests, 0 failures.

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Final drift-free grep across the codebase**

Run: `git grep -n 'z.enum(\[' src/mcp-server/tools.ts`
Expected: NO matches.

Run: `git grep -n '"NONE" | "HORIZONTAL"' src`
Expected: NO matches.

Confirm `src/shared/wire-vocabulary.ts` is the only file holding the member arrays.

- [ ] **Step 5: Commit**

```bash
git add tests/wire-vocabulary.test.ts
git commit -m "test: cross-side conformance for shared wire-vocabulary"
```

- [ ] **Step 6: Push**

```bash
git push
```

(Internal refactor — no version bump, no tag, matching the prior `variable-literal` / `condition-codec` extraction policy.)

---

## Notes for the implementer

- **Why no zod in shared:** the plugin sandbox bundle must stay lean and performs no validation (the server already validated before sending over WS). The shared module is therefore plain `as const` arrays + types, never zod schemas.
- **The `W`-prefixed imports in reaction-builder** exist only to avoid name collision with the same-named local `export type`s we keep as the public surface. Downstream importers (`code.ts`, tests) keep importing `TriggerName`, `Direction`, etc. from `reaction-builder.js` unchanged.
- **Runtime value checks left alone on purpose:** `case "ON_CLICK":`, `input === "DISSOLVE"`, `overflowDirection !== "NONE"` are value comparisons, not type declarations. They don't carry the duplication risk this refactor targets (a typo there fails existing behavioral tests), and rewriting them adds churn without benefit.
- **CONTEXT.md:** after the work lands, consider adding a one-line glossary entry for "wire vocabulary" pointing at `src/shared/wire-vocabulary.ts` (optional, not required for the plan to be complete).
