# Compound Conditions (AND/OR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a prototype Conditional branch on ≥2 variable comparisons joined by a single AND or OR (`if: { all: [...] }` / `if: { any: [...] }`), in addition to the existing single comparison.

**Architecture:** Figma encodes a compound as a nested `EXPRESSION` whose `expressionFunction` is `AND`/`OR` and whose `expressionArguments` are each a boolean-typed comparison `EXPRESSION` (the exact shape our single-comparison builder already emits). We add a pure compound builder + decoder in `condition-codec.ts`, widen the two condition schemas (`ConditionInput` low-level, `ProtoConditionIf` high-level) to a union, map compound through the compiler, and teach the plugin's `buildCondition` to assemble multi-leaf conditions. Read-back (`list_reactions`) round-trips compounds via the echo decoder.

**Tech Stack:** TypeScript, zod (schemas), vitest (tests), tsup (plugin bundle), Figma plugin API (`setReactionsAsync`).

**Scope:** one level of `all` (AND) **or** `any` (OR) over ≥2 leaf comparisons. No NOT, no nesting, no mixing AND+OR. Spec: `docs/superpowers/specs/2026-06-12-compound-conditions-design.md`.

---

## File structure

- `src/figma-plugin/condition-codec.ts` — add `buildCompoundConditionExpression`; refactor single-comparison decode into a `decodeComparison` helper; extend `decodeConditionExpression` to return a compound variant. (pure, unit-tested)
- `src/figma-plugin/code.ts` — widen `buildCondition` to accept the condition union and assemble compound operands.
- `src/figma-plugin/action-echo.ts` — extend `decodeConditionForEcho` to resolve compound leaf names and echo `{ all|any: [...] }`.
- `src/mcp-server/tools.ts` — widen `ConditionInput` to `union(single | {all} | {any})`.
- `src/mcp-server/protoTools.ts` — widen `ProtoConditionIf` to a union; map compound in `compileProtoConditional`.
- `src/server/tools.ts` — add compound NL cues to the `proto_conditional` description.
- `README.md` — update "Known limitations": remove compound + the now-stale "set-variant" entry.
- Tests: `tests/condition-codec.test.ts`, `tests/tools.test.ts`, `tests/protoTools-compile.test.ts`, `tests/action-echo.test.ts`.

---

## Task 1: Codec — build a compound EXPRESSION

**Files:**
- Modify: `src/figma-plugin/condition-codec.ts`
- Test: `tests/condition-codec.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/condition-codec.test.ts` (import `buildCompoundConditionExpression` and the existing `buildConditionExpression`):

```typescript
import { buildCompoundConditionExpression } from "../src/figma-plugin/condition-codec.js";

describe("buildCompoundConditionExpression", () => {
  const leafA = buildConditionExpression({
    variableId: "Var:A", resolvedType: "BOOLEAN", operator: "==",
    literal: { type: "BOOLEAN", value: true },
  });
  const leafB = buildConditionExpression({
    variableId: "Var:B", resolvedType: "FLOAT", operator: ">=",
    literal: { type: "FLOAT", value: 2 },
  });

  it("wraps operands in an AND expression", () => {
    const expr = buildCompoundConditionExpression({ join: "AND", operands: [leafA, leafB] });
    expect(expr).toEqual({
      type: "EXPRESSION",
      resolvedType: "BOOLEAN",
      value: { expressionFunction: "AND", expressionArguments: [leafA, leafB] },
    });
  });

  it("wraps operands in an OR expression", () => {
    const expr = buildCompoundConditionExpression({ join: "OR", operands: [leafA, leafB] });
    expect(expr.value.expressionFunction).toBe("OR");
    expect(expr.value.expressionArguments).toEqual([leafA, leafB]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/condition-codec.test.ts`
Expected: FAIL — `buildCompoundConditionExpression is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/figma-plugin/condition-codec.ts`, after `buildConditionExpression`, add:

```typescript
/**
 * Wrap ≥2 boolean operand expressions in a single AND/OR EXPRESSION — the nested
 * shape Figma uses for compound prototype conditions (captured live 2026-06-12).
 * Each operand is itself a ConditionExpression (e.g. from buildConditionExpression).
 */
export function buildCompoundConditionExpression(input: {
  join: "AND" | "OR";
  operands: ConditionExpression[];
}): ConditionExpression {
  return {
    type: "EXPRESSION",
    resolvedType: "BOOLEAN",
    value: {
      expressionFunction: input.join,
      expressionArguments: input.operands,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/condition-codec.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/condition-codec.ts tests/condition-codec.test.ts
git commit -m "feat(codec): buildCompoundConditionExpression (AND/OR wrapper)"
```

---

## Task 2: Codec — decode a compound EXPRESSION back to all/any

**Files:**
- Modify: `src/figma-plugin/condition-codec.ts`
- Test: `tests/condition-codec.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/condition-codec.test.ts` (import `decodeConditionExpression`, already used elsewhere in the file):

```typescript
describe("decodeConditionExpression — compound", () => {
  const leafA = buildConditionExpression({
    variableId: "Var:A", resolvedType: "BOOLEAN", operator: "==",
    literal: { type: "BOOLEAN", value: true },
  });
  const leafB = buildConditionExpression({
    variableId: "Var:B", resolvedType: "FLOAT", operator: ">=",
    literal: { type: "FLOAT", value: 2 },
  });

  it("decodes an AND of two comparisons to { join: 'all', conditions }", () => {
    const expr = buildCompoundConditionExpression({ join: "AND", operands: [leafA, leafB] });
    expect(decodeConditionExpression(expr)).toEqual({
      join: "all",
      conditions: [
        { variableId: "Var:A", operator: "==", value: true },
        { variableId: "Var:B", operator: ">=", value: 2 },
      ],
    });
  });

  it("decodes an OR to { join: 'any', conditions }", () => {
    const expr = buildCompoundConditionExpression({ join: "OR", operands: [leafA, leafB] });
    const decoded = decodeConditionExpression(expr) as { join: string };
    expect(decoded.join).toBe("any");
  });

  it("returns { raw } when a compound operand is not a recognized comparison", () => {
    const bad = buildCompoundConditionExpression({ join: "AND", operands: [leafA] });
    bad.value.expressionArguments = [leafA, { type: "EXPRESSION", resolvedType: "BOOLEAN", value: { expressionFunction: "AND", expressionArguments: [] } } as any];
    expect(decodeConditionExpression(bad)).toEqual({ raw: bad });
  });

  it("still decodes a single comparison (regression)", () => {
    expect(decodeConditionExpression(leafA)).toEqual({ variableId: "Var:A", operator: "==", value: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/condition-codec.test.ts`
Expected: FAIL — the AND case currently returns `{ raw: condition }` (the decoder only knows comparison functions), so the first two tests fail.

- [ ] **Step 3: Write minimal implementation**

In `src/figma-plugin/condition-codec.ts`, replace the existing `decodeConditionExpression` and its `DecodedCondition` type with the version below. It factors the single-comparison logic into `decodeComparison`, then handles AND/OR by decoding each operand:

```typescript
/** One decoded `variable <op> literal` comparison. */
export type DecodedComparison = {
  variableId: string | undefined;
  operator: string;
  value: boolean | number | string | undefined;
};

export type DecodedCondition =
  | DecodedComparison
  | { join: "all" | "any"; conditions: DecodedComparison[] }
  | { raw: unknown };

/** Decode a single comparison EXPRESSION, or null if it isn't one. */
function decodeComparison(condition: any): DecodedComparison | null {
  if (!condition || condition.type !== "EXPRESSION" || !condition.value) return null;
  const expr = condition.value;
  const operator = OPERATOR_INVERSE[expr.expressionFunction as string];
  if (!operator) return null;
  const args = expr.expressionArguments ?? [];
  if (args.length !== 2) return null;
  const aliasArg = args[0];
  const literalArg = args[1];
  if (aliasArg?.type !== "VARIABLE_ALIAS") return null;
  const variableId: string | undefined = aliasArg.value?.id;
  let value: boolean | number | string | undefined;
  if (literalArg?.type === "BOOLEAN" || literalArg?.type === "FLOAT" || literalArg?.type === "STRING") {
    value = literalArg.value;
  }
  return { variableId, operator, value };
}

const JOIN_INVERSE: Record<string, "all" | "any"> = { AND: "all", OR: "any" };

/**
 * Decode a condition EXPRESSION. A single comparison returns a DecodedComparison.
 * An AND/OR of comparisons returns { join, conditions }. Anything unrecognized
 * (non-EXPRESSION, unknown function, a compound whose operand isn't a plain
 * comparison) returns { raw } so the caller can echo it verbatim.
 */
export function decodeConditionExpression(condition: any): DecodedCondition {
  const join = condition?.type === "EXPRESSION" ? JOIN_INVERSE[condition.value?.expressionFunction as string] : undefined;
  if (join) {
    const operands = condition.value.expressionArguments ?? [];
    const conditions: DecodedComparison[] = [];
    for (const op of operands) {
      const c = decodeComparison(op);
      if (!c) return { raw: condition };
      conditions.push(c);
    }
    return { join, conditions };
  }
  const single = decodeComparison(condition);
  return single ?? { raw: condition };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/condition-codec.test.ts`
Expected: PASS (all compound + regression cases).

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/condition-codec.ts tests/condition-codec.test.ts
git commit -m "feat(codec): decode AND/OR compound conditions to all/any"
```

---

## Task 3: Low-level schema — widen ConditionInput to a union

**Files:**
- Modify: `src/mcp-server/tools.ts:184-189` (the `ConditionInput` definition)
- Test: `tests/tools.test.ts`

- [ ] **Step 1: Write the failing test**

Find how `tests/tools.test.ts` parses a conditional (search for `"conditional"`). Add a test that `CreateReactionsInput` accepts a compound condition. Use the exported input schema (search the file for the existing import — it imports `CreateReactionsInput` from `../src/mcp-server/tools.js`):

```typescript
describe("ConditionInput compound", () => {
  it("accepts an `all` compound condition inside a conditional action", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        action: {
          type: "conditional",
          condition: { all: [
            { variable: "loggedIn", operator: "==", value: true },
            { variable: "step", operator: ">=", value: 2 },
          ] },
          then: [{ type: "back" }],
        },
      }],
    });
    const cond = (parsed.connections[0].action as any).condition;
    expect(cond.all).toHaveLength(2);
  });

  it("rejects an `all` with fewer than 2 comparisons", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        action: { type: "conditional", condition: { all: [{ variable: "x", operator: "==", value: true }] }, then: [{ type: "back" }] },
      }],
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools.test.ts`
Expected: FAIL — the `all` shape doesn't match the current single-object `ConditionInput`.

- [ ] **Step 3: Write minimal implementation**

In `src/mcp-server/tools.ts`, replace the `ConditionInput` definition (lines 184-189) with:

```typescript
const ConditionComparison = z.object({
  variable: z.string().min(1),
  collection: z.string().min(1).optional(),
  operator: ComparisonOperator,
  value: z.union([z.boolean(), z.number(), z.string()]),
});

const ConditionInput = z.union([
  ConditionComparison,
  z.object({ all: z.array(ConditionComparison).min(2) }).strict(),
  z.object({ any: z.array(ConditionComparison).min(2) }).strict(),
]);
```

(`ConditionalActionInput.condition` at line 226 already references `ConditionInput`; no change needed there.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tools.test.ts`
Expected: PASS. Then run `npx tsc --noEmit` — Expected: clean (the plugin's `conn.action.condition` type widens automatically via the inferred input type).

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/tools.ts tests/tools.test.ts
git commit -m "feat(schema): ConditionInput accepts all/any compound (low-level)"
```

---

## Task 4: High-level schema + compiler — proto_conditional all/any

**Files:**
- Modify: `src/mcp-server/protoTools.ts:172-177` (`ProtoConditionIf`), `:228` (`if:` field), and `compileProtoConditional` (around `:425-449`)
- Test: `tests/protoTools-compile.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/protoTools-compile.test.ts` (it already imports `compileProtoConditional` and `ProtoConditionalInput`):

```typescript
describe("compileProtoConditional — compound", () => {
  it("maps an `all` if-condition to a compound condition on the connection", () => {
    const out = compileProtoConditional(ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { all: [
          { variable: "loggedIn", value: true },          // operator defaults to "=="
          { variable: "step", operator: ">=", value: 2 },
        ] },
        then: { back: true },
      }],
    }));
    const cond = (out.connections[0].action as any).condition;
    expect(cond.all).toEqual([
      { variable: "loggedIn", operator: "==", value: true },
      { variable: "step", operator: ">=", value: 2 },
    ]);
  });

  it("maps an `any` if-condition to a compound `any` condition", () => {
    const out = compileProtoConditional(ProtoConditionalInput.parse({
      conditions: [{ from: "1:1", if: { any: [
        { variable: "a", value: true }, { variable: "b", value: false },
      ] }, then: { back: true } }],
    }));
    expect((out.connections[0].action as any).condition.any).toHaveLength(2);
  });

  it("still maps a single if-condition (regression)", () => {
    const out = compileProtoConditional(ProtoConditionalInput.parse({
      conditions: [{ from: "1:1", if: { variable: "x", value: true }, then: { back: true } }],
    }));
    expect((out.connections[0].action as any).condition).toEqual({ variable: "x", operator: "==", value: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/protoTools-compile.test.ts`
Expected: FAIL — `ProtoConditionalInput.parse` rejects `if: { all: [...] }` (current `if` is the single object only).

- [ ] **Step 3: Write minimal implementation**

In `src/mcp-server/protoTools.ts`, after the existing `ProtoConditionIf` (line 172-177), add the union and use it on the entry. Keep `ProtoConditionIf` as the leaf/single shape:

```typescript
const ProtoConditionExpr = z.union([
  ProtoConditionIf,
  z.object({ all: z.array(ProtoConditionIf).min(2) }).strict(),
  z.object({ any: z.array(ProtoConditionIf).min(2) }).strict(),
]);
```

Change the entry field (line 228) from `if: ProtoConditionIf,` to:

```typescript
  if: ProtoConditionExpr,
```

In `compileProtoConditional`, replace the inline `condition: { ... }` object (lines 435-440) with a mapped condition. Add this helper above `compileProtoConditional`:

```typescript
type LeafIf = z.infer<typeof ProtoConditionIf>;
function compileLeaf(leaf: LeafIf) {
  return {
    variable: leaf.variable,
    ...(leaf.collection !== undefined && { collection: leaf.collection }),
    operator: leaf.operator,   // zod already applied default "=="
    value: leaf.value,
  };
}
function compileConditionExpr(cond: z.infer<typeof ProtoConditionExpr>) {
  if ("all" in cond) return { all: cond.all.map(compileLeaf) };
  if ("any" in cond) return { any: cond.any.map(compileLeaf) };
  return compileLeaf(cond);
}
```

Then in the `action` object inside `compileProtoConditional`, replace:

```typescript
      condition: {
        variable: c.if.variable,
        ...(c.if.collection !== undefined && { collection: c.if.collection }),
        operator: c.if.operator,
        value: c.if.value,
      },
```

with:

```typescript
      condition: compileConditionExpr(c.if),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/protoTools-compile.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/protoTools.ts tests/protoTools-compile.test.ts
git commit -m "feat(proto): proto_conditional if accepts all/any compound"
```

---

## Task 5: Plugin — assemble compound in buildCondition

**Files:**
- Modify: `src/figma-plugin/code.ts` — import `buildCompoundConditionExpression`; widen `buildCondition` (lines ~350-369) and its call site (lines ~513-519).

No unit test (the per-leaf path calls `figma.variables` via `resolveVariableByName`, same as today's untested single path). Verified by `tsc` + the live probe in Task 8. Each piece it composes is already unit-tested (Tasks 1-2, `buildConditionExpression`, `validateVariableLiteralCompat`).

- [ ] **Step 1: Add the import**

In `src/figma-plugin/code.ts`, in the `./condition-codec.js` import block (around line 35-37), add `buildCompoundConditionExpression`:

```typescript
import {
  buildConditionExpression,
  buildCompoundConditionExpression,
  // ...existing imports (COMPARISON_OPERATOR_MAP etc.)
} from "./condition-codec.js";
```

- [ ] **Step 2: Widen `buildCondition`**

Replace the whole `buildCondition` function (lines ~350-369) with a version that accepts the condition union and assembles compounds. It reuses the existing single-leaf logic via an inner `buildLeaf`:

```typescript
type LeafComparison = { variable: string; operator: ComparisonOperator; value: boolean | number | string; collection?: string };
type ConditionArg = LeafComparison | { all: LeafComparison[] } | { any: LeafComparison[] };

async function buildCondition(input: ConditionArg): Promise<{ condition: unknown; warning?: string }> {
  let firstWarning: string | undefined;

  const buildLeaf = async (leaf: LeafComparison) => {
    const { variable, warning } = await resolveVariableByName(leaf.variable, leaf.collection);
    if (warning && !firstWarning) firstWarning = warning;
    const literalVD = validateVariableLiteralCompat(
      { name: variable.name, resolvedType: variable.resolvedType },
      leaf.value,
      "comparison",
    );
    return buildConditionExpression({
      variableId: variable.id,
      resolvedType: variable.resolvedType,
      operator: leaf.operator,
      literal: literalVD,
    });
  };

  if ("all" in input || "any" in input) {
    const join = "all" in input ? "AND" : "OR";
    const leaves = "all" in input ? input.all : input.any;
    const operands = await Promise.all(leaves.map(buildLeaf)); // ConditionExpression[]
    return { condition: buildCompoundConditionExpression({ join, operands }), warning: firstWarning };
  }

  const condition = await buildLeaf(input);
  return { condition, warning: firstWarning };
}
```

- [ ] **Step 3: Update the call site**

In the `conn.action.type === "conditional"` branch (lines ~513-519), the call currently destructures the single shape. Replace it to pass `conn.action.condition` through:

```typescript
        const { condition, warning: condWarning } = await buildCondition(conn.action.condition);
        if (condWarning) warning = condWarning;
```

- [ ] **Step 4: Verify build + types**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm test` — Expected: all pass (no behavior regression; single path preserved).
Run: `npm run build:plugin` — Expected: `Build success`.

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/code.ts
git commit -m "feat(plugin): buildCondition assembles all/any compound operands"
```

---

## Task 6: Echo — round-trip compound in list_reactions

**Files:**
- Modify: `src/figma-plugin/action-echo.ts:85-98` (`decodeConditionForEcho`)
- Test: `tests/action-echo.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/action-echo.test.ts` (it tests `decodeConditionForEcho`; import `buildConditionExpression` + `buildCompoundConditionExpression` from condition-codec). Use a stub resolver that maps ids to names:

```typescript
import { buildConditionExpression, buildCompoundConditionExpression } from "../src/figma-plugin/condition-codec.js";

describe("decodeConditionForEcho — compound", () => {
  const resolvers = { variableName: async (id: string) => ({ "Var:A": "loggedIn", "Var:B": "step" }[id]) };
  const exprAnd = buildCompoundConditionExpression({ join: "AND", operands: [
    buildConditionExpression({ variableId: "Var:A", resolvedType: "BOOLEAN", operator: "==", literal: { type: "BOOLEAN", value: true } }),
    buildConditionExpression({ variableId: "Var:B", resolvedType: "FLOAT", operator: ">=", literal: { type: "FLOAT", value: 2 } }),
  ] });

  it("echoes an AND back as { all: [...] } with resolved names", async () => {
    const echoed = await decodeConditionForEcho(exprAnd, resolvers as any);
    expect(echoed).toEqual({ all: [
      { variable: "loggedIn", operator: "==", value: true },
      { variable: "step", operator: ">=", value: 2 },
    ] });
  });
});
```

(Confirm the exact resolver field name by reading the top of `tests/action-echo.test.ts` / the `EchoResolvers` type in `action-echo.ts`; match the existing single-comparison test's stub shape.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/action-echo.test.ts`
Expected: FAIL — `decodeConditionForEcho` currently returns `{ raw }` for a compound (the decoder change in Task 2 now returns `{ join, conditions }`, which `decodeConditionForEcho` doesn't yet handle).

- [ ] **Step 3: Write minimal implementation**

In `src/figma-plugin/action-echo.ts`, replace `decodeConditionForEcho` (lines 85-98) with a version that handles the compound decode variant:

```typescript
export async function decodeConditionForEcho(condition: any, resolvers: EchoResolvers): Promise<unknown> {
  const decoded = decodeConditionExpression(condition);
  if ("raw" in decoded) return { raw: decoded.raw };

  const echoLeaf = async (c: { variableId: string | undefined; operator: string; value: boolean | number | string | undefined }) => {
    const name = c.variableId ? await resolvers.variableName(c.variableId) : undefined;
    return { variable: name ?? `<id:${c.variableId}>`, operator: c.operator, value: c.value };
  };

  if ("join" in decoded) {
    const conditions = [];
    for (const c of decoded.conditions) conditions.push(await echoLeaf(c));
    return decoded.join === "all" ? { all: conditions } : { any: conditions };
  }

  const leaf = await echoLeaf(decoded);
  return {
    ...leaf,
    raw: leaf.variable.startsWith("<id:") ? condition : undefined, // keep raw if we lost the name
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/action-echo.test.ts` — Expected: PASS (compound + existing single tests).
Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/action-echo.ts tests/action-echo.test.ts
git commit -m "feat(echo): list_reactions round-trips all/any compound conditions"
```

---

## Task 7: NL steering — compound cues in proto_conditional describe()

**Files:**
- Modify: `src/server/tools.ts` (the `proto_conditional` tool `description` string)

- [ ] **Step 1: Update the description**

In `src/server/tools.ts`, find the `proto_conditional` entry's `description`. After the existing sentence about `if/then/else` input, add the compound guidance. Append this to the description string (keep the surrounding `+ "..."` concatenation style):

```typescript
        "`if` is a single comparison `{ variable, operator?, value }`, OR a one-level compound: " +
        "`{ all: [<comparison>, …] }` (AND — 모두 참일 때, cues: '그리고/이고/둘 다/모두') or " +
        "`{ any: [<comparison>, …] }` (OR — 하나라도 참일 때, cues: '또는/거나/하나라도'). " +
        "Each array needs ≥2 comparisons; `all` and `any` cannot be mixed or nested (one level only) — " +
        "for multi-way branching use separate reactions (Figma has no else-if). " +
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm test` — Expected: all pass (description is a string; no test asserts its exact text).

- [ ] **Step 3: Commit**

```bash
git add src/server/tools.ts
git commit -m "feat(steering): proto_conditional describe() documents all/any compound cues"
```

---

## Task 8: Live write-probe (ship gate) + README

**Files:**
- Modify: `README.md` (Known limitations)
- Throwaway: an ad-hoc SSE probe script (NOT committed; delete after)

This is the live-verify gate the project requires before shipping any reaction change (e.g. [DISSOLVE matchLayers rejected], runtime-vs-typings catches). It confirms `setReactionsAsync` accepts our built compound — the one thing unit tests cannot.

- [ ] **Step 1: Build the plugin and start the server**

```bash
npm run build:plugin
npm start   # background; wait for "[server] listening on http://localhost:3000"
```
Reload the plugin in Figma so it runs the new bundle. Keep Figma the SOLE SSE client (single-active newest-wins — do not run other SSE clients except the one probe below, one at a time).

- [ ] **Step 2: Find a source node + two BOOLEAN/numeric variables**

Use an SSE probe (MCP `SSEClientTransport` to `http://localhost:3000/sse`, pattern from prior probes) to call `find_nodes` for a node that can hold reactions and `list_variables` for two variables (e.g. `loggedIn` BOOLEAN, `step` FLOAT — or two booleans).

- [ ] **Step 3: Drive an `all` compound and read it back**

Call `proto_conditional` with:
```json
{ "conditions": [{
  "from": "<sourceNodeId>",
  "if": { "all": [
    { "variable": "loggedIn", "value": true },
    { "variable": "isOpen", "value": true }
  ] },
  "then": { "set": { "variable": "showMenu", "value": true } },
  "else": { "set": { "variable": "showMenu", "value": false } }
}], "replaceExisting": true }
```
Then call `list_reactions` for `<sourceNodeId>`.

**Expected:** `proto_conditional` returns `successCount: 1` (no error). `list_reactions` shows `action.condition` echoed as `{ all: [ { variable:"loggedIn", operator:"==", value:true }, { variable:"isOpen", operator:"==", value:true } ] }`.

**Contingency (documented risk):** if `setReactionsAsync` rejects the operands (e.g. it requires a bare boolean `VARIABLE_ALIAS` for a `bool == true` operand rather than an `EQUALS` comparison), update `buildCondition`'s `buildLeaf` to emit a bare alias for `BOOLEAN`-typed `== true/false` leaves (a `{ type:"VARIABLE_ALIAS", resolvedType:"BOOLEAN", value:{ type:"VARIABLE_ALIAS", id } }` operand instead of an `EQUALS` expression), keeping the comparison form for non-boolean leaves. Re-probe. Add a unit test for the bare-alias operand in `condition-codec.test.ts` if this path is taken.

- [ ] **Step 4: Drive an `any` compound and read it back**

Repeat Step 3 with `"any"` instead of `"all"`. Expected: `successCount: 1`; `list_reactions` echoes `{ any: [...] }`.

- [ ] **Step 5: Clean up the probe**

Clear the test reaction (`clear_reactions` on the source node), delete the throwaway probe script, stop the server if no longer needed.

- [ ] **Step 6: Update README known-limitations**

In `README.md` (Known limitations, ~line 375), update the reaction-actions line: change `**Conditional** (single comparison, IF/ELSE)` to `**Conditional** (single comparison or one-level AND/OR compound, IF/ELSE)`, and remove `set-variant (component swap)` and `AND/OR compound conditions` from the "Not supported" list (set-variant shipped as `change_to` in v0.27.0; compound ships here). Leave `nested conditionals` and `else-if chains` in the not-supported list.

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs(readme): compound conditions supported; drop stale set-variant limitation"
```

---

## Notes for the implementer

- **Run order:** Tasks 1→2 (codec) before 5 (plugin uses the builder) and 6 (echo uses the decoder). 3 and 4 (schemas) are independent of the codec. 8 (live probe) is last and is the ship gate.
- **Single-source caution:** `code.ts` imports the zod-inferred input types (erased at bundle time). After widening `ConditionInput` (Task 3), `conn.action.condition` is the union type — the `"all" in input` / `"any" in input` narrowing in `buildCondition` (Task 5) is what `tsc` checks. If `tsc` complains that `conn.action.condition` isn't assignable to `ConditionArg`, align `ConditionArg` field optionality with the inferred type rather than casting.
- **No new tools, no version bump inside tasks.** Versioning/release (tag `v0.28.0`, gh release, memory) happens after the live probe passes, as a separate wrap-up step — mirrors prior feature releases.
