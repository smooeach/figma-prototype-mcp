# Variable Name-Collision Disambiguation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a caller disambiguate a variable that shares its name across multiple collections via an optional `collection` field, and turn silent first-match-wins into an explicit error when a collision is unresolved.

**Architecture:** A pure `selectVariableMatch` helper in `variable-catalog.ts` makes the pick/collision/none decision (unit-tested). `resolveVariableByName(name, collection?)` in the plugin sandbox fetches descriptors and delegates to it, at both the local step and the library step. The optional `collection` field threads through the wire action schemas (tools.ts), the proto input schemas + compile mappers (protoTools.ts), and the three resolver call sites. Local-first ordering is preserved; the library step drops its first-match `break` so it can detect library-side collisions.

**Tech Stack:** TypeScript, zod, vitest. Plugin bundle built with tsup (no zod in bundle — `import type` only).

**Spec:** `docs/superpowers/specs/2026-06-09-variable-collision-disambiguation-design.md`

---

### Task 1: Pure helper — `selectVariableMatch` + `formatAmbiguousVariableError`

**Files:**
- Modify: `src/figma-plugin/variable-catalog.ts` (add after `formatVariableNotFoundError`, ends line 53)
- Test: `tests/variable-catalog.test.ts` (append new `describe` blocks)

- [ ] **Step 1: Write the failing tests**

Append to `tests/variable-catalog.test.ts`:

```ts
import {
  // ...existing imports plus:
  selectVariableMatch,
  formatAmbiguousVariableError,
} from "../src/figma-plugin/variable-catalog.js";

describe("selectVariableMatch", () => {
  const cands: LocalVarDescriptor[] = [
    { name: "count", id: "VariableID:1", resolvedType: "FLOAT", collection: "mcp_test" },
    { name: "count", id: "VariableID:2", resolvedType: "FLOAT", collection: "DuMat" },
    { name: "isOpen", id: "VariableID:3", resolvedType: "BOOLEAN", collection: "modes" },
  ];

  it("returns none when no candidate matches the name", () => {
    expect(selectVariableMatch("missing", undefined, cands)).toEqual({ kind: "none" });
  });

  it("returns the single match when one name matches and no collection given", () => {
    const r = selectVariableMatch("isOpen", undefined, cands);
    expect(r).toEqual({ kind: "match", item: cands[2] });
  });

  it("returns ambiguous (with collection list) on multi-match and no collection given", () => {
    const r = selectVariableMatch("count", undefined, cands);
    expect(r).toEqual({ kind: "ambiguous", collections: ["mcp_test", "DuMat"] });
  });

  it("resolves a collision when the collection is given", () => {
    const r = selectVariableMatch("count", "DuMat", cands);
    expect(r).toEqual({ kind: "match", item: cands[1] });
  });

  it("returns none when the given collection matches no candidate (fall through to library)", () => {
    expect(selectVariableMatch("count", "nope", cands)).toEqual({ kind: "none" });
  });

  it("returns ambiguous when the same name appears twice in the given collection (defensive)", () => {
    const dupe: LocalVarDescriptor[] = [
      { name: "count", id: "VariableID:1", resolvedType: "FLOAT", collection: "dup" },
      { name: "count", id: "VariableID:2", resolvedType: "FLOAT", collection: "dup" },
    ];
    expect(selectVariableMatch("count", "dup", dupe)).toEqual({ kind: "ambiguous", collections: ["dup", "dup"] });
  });
});

describe("formatAmbiguousVariableError", () => {
  it("formats a local collision", () => {
    const msg = formatAmbiguousVariableError("count", ["mcp_test", "DuMat"], "local");
    expect(msg).toBe(
      'Variable "count" is ambiguous — it exists in multiple local collections: ' +
        "[mcp_test, DuMat]. Specify the `collection` field to disambiguate " +
        "(use list_variables to see collection names).",
    );
  });
  it("formats a library collision", () => {
    const msg = formatAmbiguousVariableError("count", ["A", "B"], "library");
    expect(msg).toBe(
      'Variable "count" is ambiguous — it exists in multiple library collections: ' +
        "[A, B]. Specify the `collection` field to disambiguate " +
        "(use list_variables to see collection names).",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/variable-catalog.test.ts`
Expected: FAIL — `selectVariableMatch is not a function` / `formatAmbiguousVariableError is not a function`.

- [ ] **Step 3: Implement the helper**

Append to `src/figma-plugin/variable-catalog.ts` (after line 53):

```ts
export type VarSelection<T> =
  | { kind: "match"; item: T }
  | { kind: "ambiguous"; collections: string[] }
  | { kind: "none" };

/**
 * Select a variable from candidate descriptors by exact name, optionally
 * narrowed by collection. Pure — callers fetch descriptors.
 *
 * - 0 name matches → { none } (caller proceeds to the next resolution step)
 * - collection given → re-filter by collection: 1 → match, 0 → none, 2+ → ambiguous
 * - collection omitted → 1 → match, 2+ → ambiguous
 */
export function selectVariableMatch<T extends { name: string; collection: string }>(
  name: string,
  collection: string | undefined,
  candidates: T[],
): VarSelection<T> {
  const byName = candidates.filter((c) => c.name === name);
  if (byName.length === 0) return { kind: "none" };

  const pool = collection === undefined ? byName : byName.filter((c) => c.collection === collection);
  if (pool.length === 0) return { kind: "none" };
  if (pool.length === 1) return { kind: "match", item: pool[0]! };
  return { kind: "ambiguous", collections: pool.map((c) => c.collection) };
}

/** Build the "ambiguous variable" error listing the colliding collections. Pure. */
export function formatAmbiguousVariableError(
  name: string,
  collections: string[],
  scope: "local" | "library",
): string {
  return (
    `Variable "${name}" is ambiguous — it exists in multiple ${scope} collections: ` +
    `[${collections.join(", ")}]. Specify the \`collection\` field to disambiguate ` +
    `(use list_variables to see collection names).`
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/variable-catalog.test.ts`
Expected: PASS (all `selectVariableMatch` + `formatAmbiguousVariableError` cases).

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/variable-catalog.ts tests/variable-catalog.test.ts
git commit -m "feat(catalog): pure selectVariableMatch + ambiguous-collision error formatter"
```

---

### Task 2: Thread optional `collection` through the wire action schemas

**Files:**
- Modify: `src/mcp-server/tools.ts:184-199` (`ConditionInput`, `SetVariableActionInput`, `ToggleVariableActionInput`)

These three schemas define the action shapes that `code.ts` handlers consume via
`import type`. Adding the optional field here makes `action.collection` typed at
the resolver call sites in Task 3. No behavioral code yet — schema only.

- [ ] **Step 1: Add the optional field to all three schemas**

In `src/mcp-server/tools.ts`, change lines 184-199:

```ts
const ConditionInput = z.object({
  variable: z.string().min(1),
  collection: z.string().min(1).optional(),
  operator: ComparisonOperator,
  value: z.union([z.boolean(), z.number(), z.string()]),
});

const SetVariableActionInput = z.object({
  type: z.literal("set_variable"),
  variable: z.string().min(1),
  collection: z.string().min(1).optional(),
  value: z.union([z.boolean(), z.number(), z.string()]),
});

const ToggleVariableActionInput = z.object({
  type: z.literal("toggle_variable"),
  variable: z.string().min(1),
  collection: z.string().min(1).optional(),
});
```

- [ ] **Step 2: Verify the project still typechecks**

Run: `npm run typecheck`
Expected: PASS (existing code ignores the new optional field; nothing references it yet).

- [ ] **Step 3: Commit**

```bash
git add src/mcp-server/tools.ts
git commit -m "feat(tools): optional collection on set/toggle/condition wire action schemas"
```

---

### Task 3: Resolver — `resolveVariableByName(name, collection?)` delegates to the helper

**Files:**
- Modify: `src/figma-plugin/code.ts` — import (line 23 area), resolver (213-272), `buildCondition` (278-296), and three call sites (190, 283, 477)

Logic is unit-tested in Task 1; the sandbox itself is verified by typecheck + the live check (Task 6). The library step is restructured to enumerate all collections (drop the first-match `break`) and build descriptors before selecting.

- [ ] **Step 1: Import the new helpers**

In `src/figma-plugin/code.ts`, the existing import block (around line 23) pulls
`formatVariableNotFoundError` from `./variable-catalog.js`. Add the two new names:

```ts
import {
  filterVariables,
  formatVariableNotFoundError,
  selectVariableMatch,
  formatAmbiguousVariableError,
  type LocalVarDescriptor,
  type LibraryVarDescriptor,
} from "./variable-catalog.js";
```

(Keep whichever of these were already imported; add only the missing ones —
`selectVariableMatch` and `formatAmbiguousVariableError` are new.)

- [ ] **Step 2: Rewrite `resolveVariableByName` to accept `collection` and delegate**

Replace the whole function body at `src/figma-plugin/code.ts:213-272` with:

```ts
async function resolveVariableByName(
  name: string,
  collection?: string,
): Promise<{
  variable: Variable;
  warning?: string;
}> {
  // Step 1: local. Build descriptors so collection-aware selection can run.
  const all = await figma.variables.getLocalVariablesAsync();
  const localDescriptors: Array<LocalVarDescriptor & { ref: Variable }> = await Promise.all(
    all.map(async (v) => {
      const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      return {
        name: v.name,
        id: v.id,
        resolvedType: v.resolvedType,
        collection: col?.name ?? "",
        ref: v,
      };
    }),
  );
  const localPick = selectVariableMatch(name, collection, localDescriptors);
  if (localPick.kind === "match") {
    return { variable: localPick.item.ref };
  }
  if (localPick.kind === "ambiguous") {
    throw new Error(formatAmbiguousVariableError(name, localPick.collections, "local"));
  }

  // Step 2: library. Enumerate ALL collections (no early break) so collisions are
  // detectable. Best-effort: a failure degrades to the candidate-listing error.
  const libraryDescriptors: Array<LibraryVarDescriptor> = [];
  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    for (const col of collections) {
      const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
      for (const v of vars) {
        libraryDescriptors.push({
          name: v.name,
          key: v.key,
          resolvedType: v.resolvedType,
          collection: col.name,
          libraryName: col.libraryName,
        });
      }
    }
  } catch {
    // Library enumeration unavailable — fall through to the candidate-listing error.
  }

  const libPick = selectVariableMatch(name, collection, libraryDescriptors);
  if (libPick.kind === "ambiguous") {
    throw new Error(formatAmbiguousVariableError(name, libPick.collections, "library"));
  }
  if (libPick.kind === "match") {
    // Import the matched library variable. A failure here is reported distinctly
    // (the name WAS found; only the import step failed) instead of as "not found".
    try {
      const imported = await figma.variables.importVariableByKeyAsync(libPick.item.key);
      return {
        variable: imported,
        warning: `Imported library variable "${name}" from "${libPick.item.libraryName}".`,
      };
    } catch (err: any) {
      throw new Error(
        `Found library variable "${name}" in "${libPick.item.libraryName}" but failed to import it: ${err?.message ?? String(err)}`,
      );
    }
  }

  // Step 3: not found — list candidates.
  throw new Error(
    formatVariableNotFoundError(name, all.map((v) => v.name), libraryDescriptors.map((v) => v.name)),
  );
}
```

- [ ] **Step 3: Thread `collection` into the three call sites**

(a) `set_variable` handler at line 190 — change to:

```ts
    const { variable, warning } = await resolveVariableByName(action.variable, action.collection);
```

(b) `buildCondition` — add `collection` to its input type (278-282) and pass it (283):

```ts
async function buildCondition(input: {
  variable: string;
  collection?: string;
  operator: ComparisonOperator;
  value: boolean | number | string;
}): Promise<{ condition: unknown; warning?: string }> {
  const { variable, warning } = await resolveVariableByName(input.variable, input.collection);
```

…and at the `buildCondition` call inside `handleCreateReactions` (around line 441), pass the collection through:

```ts
        const { condition, warning: condWarning } = await buildCondition({
          variable: conn.action.condition.variable,
          collection: conn.action.condition.collection,
          operator: conn.action.condition.operator,
          value: conn.action.condition.value,
        });
```

(c) `toggle_variable` handler at line 477 — change to:

```ts
        const { variable, warning: resolveWarning } = await resolveVariableByName(conn.action.variable, conn.action.collection);
```

- [ ] **Step 4: Verify typecheck + full test suite still pass**

Run: `npm run typecheck && npm run test`
Expected: PASS. The removed multi-match `warning` path is no longer exercised; confirm no test asserted on the old "Multiple local variables named" warning string. If one does, update it to expect the new ambiguous error (search: `grep -rn "Multiple local variables named" tests/`).

- [ ] **Step 5: Verify the plugin bundle builds**

Run: `npm run build:plugin`
Expected: PASS (tsup emits the plugin bundle; `import type` keeps zod out).

- [ ] **Step 6: Commit**

```bash
git add src/figma-plugin/code.ts
git commit -m "feat(plugin): collection-aware resolveVariableByName; error on unresolved collision"
```

---

### Task 4: Proto input schemas + `.describe()` steering

**Files:**
- Modify: `src/mcp-server/protoTools.ts` — `ProtoSetVariableEntry` (106-111), `ProtoToggleVariableEntry` (118-122), `ProtoConditionIf` (131-135), `BranchSet.set` (168-173)

- [ ] **Step 1: Add the optional `collection` field with describe() to all four shapes**

Define a shared constant near the top of the variable-related schemas (just above
`ProtoSetVariableEntry`, ~line 105) to keep the describe() text DRY:

```ts
const COLLECTION_FIELD = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Only needed when the same variable name exists in multiple collections. " +
      "Use list_variables to find the collection name and pass it here. " +
      "Omitting it on a collision returns an error.",
  );
```

Then add `collection: COLLECTION_FIELD,` to each shape:

```ts
const ProtoSetVariableEntry = z.object({
  from: z.string().min(1),
  variable: z.string().min(1),
  collection: COLLECTION_FIELD,
  value: z.union([z.boolean(), z.number(), z.string()]),
  trigger: TriggerInput.optional(),
}).strict();

const ProtoToggleVariableEntry = z.object({
  from: z.string().min(1),
  variable: z.string().min(1),
  collection: COLLECTION_FIELD,
  trigger: TriggerInput.optional(),
}).strict();

const ProtoConditionIf = z.object({
  variable: z.string().min(1),
  collection: COLLECTION_FIELD,
  operator: ComparisonOperator.default("=="),
  value: z.union([z.boolean(), z.number(), z.string()]),
}).strict();

const BranchSet = z.object({
  set: z.object({
    variable: z.string().min(1),
    collection: COLLECTION_FIELD,
    value: z.union([z.boolean(), z.number(), z.string()]),
  }).strict(),
}).strict();
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (mappers don't forward the field yet — that's Task 5; the extra
parsed key is simply unused for now).

- [ ] **Step 3: Commit**

```bash
git add src/mcp-server/protoTools.ts
git commit -m "feat(proto): optional collection field on variable proto inputs with steering describe()"
```

---

### Task 5: Proto compile mappers forward `collection`

**Files:**
- Modify: `src/mcp-server/protoTools.ts` — `compileProtoSetVariable` (303-318), `compileProtoToggleVariable` (320-333), `compileBranchAction` set branch (356), `compileProtoConditional` condition (372-381)
- Test: `tests/protoTools-compile.test.ts` (append cases)

- [ ] **Step 1: Write the failing compiler tests**

Append to `tests/protoTools-compile.test.ts`:

```ts
describe("collection disambiguation threading", () => {
  it("forwards collection on proto_set_variable", () => {
    const out = compileProtoSetVariable(
      ProtoSetVariableInput.parse({ sets: [{ from: "1:1", variable: "count", collection: "mcp_test", value: 3 }] }),
    );
    expect(out.connections[0].action).toEqual({ type: "set_variable", variable: "count", collection: "mcp_test", value: 3 });
  });

  it("omits the collection key when not provided (set_variable)", () => {
    const out = compileProtoSetVariable(
      ProtoSetVariableInput.parse({ sets: [{ from: "1:1", variable: "count", value: 3 }] }),
    );
    expect(out.connections[0].action).toEqual({ type: "set_variable", variable: "count", value: 3 });
    expect("collection" in (out.connections[0].action as object)).toBe(false);
  });

  it("forwards collection on proto_toggle_variable", () => {
    const out = compileProtoToggleVariable(
      ProtoToggleVariableInput.parse({ toggles: [{ from: "1:1", variable: "isOpen", collection: "modes" }] }),
    );
    expect(out.connections[0].action).toEqual({ type: "toggle_variable", variable: "isOpen", collection: "modes" });
  });

  it("forwards collection on conditional if + set branch", () => {
    const out = compileProtoConditional(
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "count", collection: "mcp_test", value: 1 },
          then: { set: { variable: "flag", collection: "DuMat", value: true } },
        }],
      }),
    );
    const action = out.connections[0].action as any;
    expect(action.condition).toEqual({ variable: "count", collection: "mcp_test", operator: "==", value: 1 });
    expect(action.then[0]).toEqual({ type: "set_variable", variable: "flag", collection: "DuMat", value: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/protoTools-compile.test.ts`
Expected: FAIL — actions lack the `collection` key.

- [ ] **Step 3: Forward `collection` in each mapper (omit key when undefined)**

In `compileProtoSetVariable` (action object, ~306):

```ts
    const action: Connection["action"] = {
      type: "set_variable",
      variable: s.variable,
      ...(s.collection !== undefined && { collection: s.collection }),
      value: s.value,
    };
```

In `compileProtoToggleVariable` (action object, ~322):

```ts
    const action: Connection["action"] = {
      type: "toggle_variable",
      variable: t.variable,
      ...(t.collection !== undefined && { collection: t.collection }),
    };
```

In `compileBranchAction`, the set branch (line 356):

```ts
  if ("set" in b)     return {
    type: "set_variable",
    variable: b.set.variable,
    ...(b.set.collection !== undefined && { collection: b.set.collection }),
    value: b.set.value,
  };
```

In `compileProtoConditional`, the condition object (~374):

```ts
      condition: {
        variable: c.if.variable,
        ...(c.if.collection !== undefined && { collection: c.if.collection }),
        operator: c.if.operator,
        value: c.if.value,
      },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/protoTools-compile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/protoTools.ts tests/protoTools-compile.test.ts
git commit -m "feat(proto): compile mappers forward collection to set/toggle/condition actions"
```

---

### Task 6: Full verification + live check

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite + typecheck + plugin build**

Run: `npm run typecheck && npm run test && npm run build:plugin`
Expected: ALL PASS. Note the total test count (was 409 + new cases).

- [ ] **Step 2: Live end-to-end on the collision fixture**

Per the spec's live-verification section. Start the server (`npm start`), reconnect
the Figma plugin, restart Claude Desktop. On test file `uxwXKX9lcuqQxAnPouWJWK` /
MCP_test_12 (which has `count` in both `DuMat` and `mcp_test`):
- `proto_set_variable` on `count` **without** `collection` → expect the ambiguous
  error listing both collections.
- Same call **with** `collection: "mcp_test"` → expect success, applied to the
  correct variable.

- [ ] **Step 3: Confirm the collection-name-uniqueness assumption**

While in the live file, eyeball `list_variables` output: confirm no two collections
share a name (which would itself make the `collection` filter ambiguous). Low-risk;
just a sanity check. Record the result.

- [ ] **Step 4: Release as v0.25.0**

Follow the established release flow (version bump, tag `v0.25.0`, `gh release`).
Update memory per the v0.24.0 shipped-note pattern.

---

## Notes for the implementer

- **Local-wins is preserved:** a local match (when its collection matches, or when
  no collection is given and there's a single local match) always short-circuits
  before the library step is even enumerated.
- **The old multi-match warning is intentionally gone** — it's now an error. Don't
  reintroduce a "use the first" fallback.
- **`.strict()` + action-echo:** forwarding `collection` only when defined keeps
  the emitted action object clean, matching the existing `resetScrollPosition`
  convention.
- **No new Figma API surface:** `getLocalVariablesAsync`, `getVariableCollectionByIdAsync`,
  and the teamLibrary calls are all already in use in `handleListVariables`.
