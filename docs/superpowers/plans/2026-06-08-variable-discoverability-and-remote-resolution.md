# Variable Discoverability & Remote/Library Variable Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the LLM discover Figma variables by name (`list_variables`) and resolve library/remote variables — not just local ones — in `proto_set_variable` / `proto_toggle_variable` / `proto_conditional`.

**Architecture:** A new low-level read tool `list_variables` (same wiring as `find_nodes`). Pure mapping/filtering/error-formatting logic lives in a testable module `src/figma-plugin/variable-catalog.ts`; the `figma`-global glue lives in `code.ts` handlers and is verified live (the codebase's established split — pure modules are unit-tested, sandbox glue is live-verified). `resolveVariableByName` gains a remote-import step. The entire remote path is gated behind a live API probe (Task 1).

**Tech Stack:** TypeScript, zod (`@modelcontextprotocol/sdk`), vitest, Figma plugin-typings, tsup bundle.

Spec: `docs/superpowers/specs/2026-06-08-variable-discoverability-and-remote-resolution-design.md`

---

## File Structure

- **Create** `src/figma-plugin/variable-catalog.ts` — pure: type defs, `filterVariables`, `formatVariableNotFoundError`. No `figma` global.
- **Create** `tests/variable-catalog.test.ts` — unit tests for the pure module.
- **Modify** `src/mcp-server/tools.ts` — add `ListVariablesInput` schema + inferred type.
- **Modify** `src/mcp-server/types.ts` — add `"LIST_VARIABLES"` to `CommandName`.
- **Modify** `tests/tools.test.ts` — parse tests for `ListVariablesInput`.
- **Modify** `src/server/tools.ts` — register the `list_variables` tool entry.
- **Modify** `src/figma-plugin/code.ts` — `Command` union arm, dispatch `case`, `handleListVariables`, and the extended `resolveVariableByName`.

---

## Task 1: Live API probe (GATE — no code committed)

This task decides whether the remote path is built. It runs a one-off snippet in the Figma plugin console against the real fixture file. **Do not skip** — this is the mandatory-API-probe rule after the v1.4 / v0.24.0 platform blocks.

**Files:** none (manual verification).

- [ ] **Step 1: Start the server and connect the plugin**

Run: `npm start` (server died on the last reboot — must be restarted). Then open the Figma file `uxwXKX9lcuqQxAnPouWJWK`, section `MCP_test_12`, and connect the plugin so the console is available.

- [ ] **Step 2: Run the probe snippet in the plugin console**

Paste into the plugin's console (the sandbox where `figma` is global):

```js
(async () => {
  const cols = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  console.log("collections:", cols.map(c => ({ name: c.name, key: c.key, lib: c.libraryName })));
  for (const c of cols) {
    const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key);
    console.log("vars in", c.name, ":", vars.map(v => ({ name: v.name, key: v.key, type: v.resolvedType })));
    const hit = vars.find(v => v.name === "corner-radius/8");
    if (hit) {
      const imported = await figma.variables.importVariableByKeyAsync(hit.key);
      console.log("IMPORTED:", { id: imported.id, name: imported.name, type: imported.resolvedType });
    }
  }
})();
```

- [ ] **Step 3: Record the verdict**

Expected PASS: the `corner-radius` collection is listed, `corner-radius/8` appears with a `key`, and `importVariableByKeyAsync` returns a `Variable` with `resolvedType === "FLOAT"`.

- **If PASS** → implement Tasks 2–6 in full.
- **If FAIL** (permission error / variable absent / unpublished / runtime mismatch) → implement Tasks 2–6 but in Task 5 SKIP the import step (keep local-only resolution + candidate-listing error), and in Task 6 record the limitation. `list_variables` still ships with `remoteEnumerated: false`.

No commit in this task.

---

## Task 2: `ListVariablesInput` schema + `LIST_VARIABLES` command name

**Files:**
- Modify: `src/mcp-server/tools.ts` (add schema near `FindNodesInput`, ~line 26; add inferred type near line 263)
- Modify: `src/mcp-server/types.ts` (add to `CommandName` union, ~line 5)
- Test: `tests/tools.test.ts`

- [ ] **Step 1: Write the failing parse tests**

Add to `tests/tools.test.ts` (and add `ListVariablesInput` to the existing import block at the top of the file):

```ts
describe("ListVariablesInput", () => {
  it("accepts empty input with includeRemote defaulting to true", () => {
    const r = ListVariablesInput.parse({});
    expect(r.includeRemote).toBe(true);
  });
  it("accepts a resolvedType filter and nameQuery", () => {
    const r = ListVariablesInput.parse({ resolvedType: "FLOAT", nameQuery: "corner" });
    expect(r.resolvedType).toBe("FLOAT");
    expect(r.nameQuery).toBe("corner");
  });
  it("allows includeRemote to be disabled", () => {
    expect(ListVariablesInput.parse({ includeRemote: false }).includeRemote).toBe(false);
  });
  it("rejects an unknown resolvedType", () => {
    expect(() => ListVariablesInput.parse({ resolvedType: "VECTOR" })).toThrow();
  });
  it("rejects unknown keys (strict)", () => {
    expect(() => ListVariablesInput.parse({ bogus: 1 })).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/tools.test.ts -t ListVariablesInput`
Expected: FAIL — `ListVariablesInput is not defined`.

- [ ] **Step 3: Add the schema and inferred type**

In `src/mcp-server/tools.ts`, after the `FindNodesInput` block (line 26):

```ts
export const ListVariablesInput = z
  .object({
    resolvedType: z
      .enum(["BOOLEAN", "FLOAT", "STRING", "COLOR"])
      .optional()
      .describe("Filter to one variable type."),
    includeRemote: z
      .boolean()
      .default(true)
      .describe(
        "Enumerate library (remote) variables in addition to local ones. " +
          "Can be slow on files with large connected libraries; set false to list local only.",
      ),
    nameQuery: z
      .string()
      .optional()
      .describe("Case-insensitive substring filter on the variable name."),
  })
  .strict();
```

In the inferred-type block near line 263, add:

```ts
export type ListVariablesInput = z.infer<typeof ListVariablesInput>;
```

- [ ] **Step 4: Add `LIST_VARIABLES` to `CommandName`**

In `src/mcp-server/types.ts`, add the arm to the `CommandName` union (alongside `"FIND_NODES"`):

```ts
  | "LIST_VARIABLES"
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/tools.test.ts -t ListVariablesInput`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/mcp-server/tools.ts src/mcp-server/types.ts tests/tools.test.ts
git commit -m "feat(schema): ListVariablesInput + LIST_VARIABLES command name"
```

---

## Task 3: `variable-catalog.ts` pure module

**Files:**
- Create: `src/figma-plugin/variable-catalog.ts`
- Test: `tests/variable-catalog.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/variable-catalog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  filterVariables,
  formatVariableNotFoundError,
  type LocalVarDescriptor,
  type LibraryVarDescriptor,
} from "../src/figma-plugin/variable-catalog.js";

const local: LocalVarDescriptor[] = [
  { name: "isOpen", id: "VariableID:1", resolvedType: "BOOLEAN", collection: "modes" },
  { name: "count", id: "VariableID:2", resolvedType: "FLOAT", collection: "modes" },
];
const library: LibraryVarDescriptor[] = [
  { name: "corner-radius/8", key: "k1", resolvedType: "FLOAT", collection: "radius", libraryName: "DS" },
  { name: "brand/primary", key: "k2", resolvedType: "COLOR", collection: "color", libraryName: "DS" },
];

describe("filterVariables", () => {
  it("returns everything when no filters are given", () => {
    expect(filterVariables(local, {})).toHaveLength(2);
  });
  it("filters by resolvedType", () => {
    const r = filterVariables(local, { resolvedType: "BOOLEAN" });
    expect(r.map((v) => v.name)).toEqual(["isOpen"]);
  });
  it("filters by case-insensitive name substring", () => {
    const r = filterVariables(library, { nameQuery: "CORNER" });
    expect(r.map((v) => v.name)).toEqual(["corner-radius/8"]);
  });
  it("applies type and name filters together", () => {
    expect(filterVariables(library, { resolvedType: "COLOR", nameQuery: "brand" })).toHaveLength(1);
    expect(filterVariables(library, { resolvedType: "FLOAT", nameQuery: "brand" })).toHaveLength(0);
  });
});

describe("formatVariableNotFoundError", () => {
  it("lists local and library candidates", () => {
    const msg = formatVariableNotFoundError("corner-radius/9", ["isOpen"], ["corner-radius/8", "brand/primary"]);
    expect(msg).toBe(
      'Variable "corner-radius/9" not found. Available — local: [isOpen]; ' +
        "library: [corner-radius/8, brand/primary]. Use list_variables to inspect.",
    );
  });
  it("renders empty candidate lists as (none)", () => {
    const msg = formatVariableNotFoundError("x", [], []);
    expect(msg).toBe(
      'Variable "x" not found. Available — local: (none); library: (none). Use list_variables to inspect.',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/variable-catalog.test.ts`
Expected: FAIL — cannot find module `variable-catalog.js`.

- [ ] **Step 3: Write the module**

Create `src/figma-plugin/variable-catalog.ts`:

```ts
import type { VariableResolvedType } from "./variable-literal.js";

export interface LocalVarDescriptor {
  name: string;
  id: string;
  resolvedType: VariableResolvedType;
  collection: string;
}

export interface LibraryVarDescriptor {
  name: string;
  key: string;
  resolvedType: VariableResolvedType;
  collection: string;
  libraryName: string;
}

export interface VarListFilters {
  resolvedType?: VariableResolvedType;
  nameQuery?: string;
}

/** Apply optional type + case-insensitive name-substring filters. Pure. */
export function filterVariables<T extends { name: string; resolvedType: VariableResolvedType }>(
  items: T[],
  filters: VarListFilters,
): T[] {
  const q = filters.nameQuery?.toLowerCase();
  return items.filter((v) => {
    if (filters.resolvedType && v.resolvedType !== filters.resolvedType) return false;
    if (q && !v.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Build the "not found" error listing the available candidate names. Pure. */
export function formatVariableNotFoundError(
  name: string,
  localNames: string[],
  libraryNames: string[],
): string {
  const render = (names: string[]) => (names.length ? `[${names.join(", ")}]` : "(none)");
  return (
    `Variable "${name}" not found. Available — ` +
    `local: ${render(localNames)}; library: ${render(libraryNames)}. ` +
    `Use list_variables to inspect.`
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/variable-catalog.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/figma-plugin/variable-catalog.ts tests/variable-catalog.test.ts
git commit -m "feat(plugin): variable-catalog pure module (filter + not-found error)"
```

---

## Task 4: `handleListVariables` glue + registration + dispatch

**Files:**
- Modify: `src/figma-plugin/code.ts` (import; `Command` union ~line 47; dispatch `case` ~line 87; new handler near `handleFindNodes` ~line 310)
- Modify: `src/server/tools.ts` (import `ListVariablesInput` ~line 15; add tool entry after the `find_nodes` entry ~line 83)

- [ ] **Step 1: Import the schema type and catalog in `code.ts`**

In `src/figma-plugin/code.ts`, add to the existing `import type { ... } from "../mcp-server/tools.js"` block: `ListVariablesInput`. Add a new import:

```ts
import {
  filterVariables,
  type LocalVarDescriptor,
  type LibraryVarDescriptor,
} from "./variable-catalog.js";
```

- [ ] **Step 2: Add the `Command` union arm**

In the `Command` type (line ~47), add:

```ts
  | { type: "LIST_VARIABLES"; params: ListVariablesInput }
```

- [ ] **Step 3: Add the dispatch case**

In the switch (after the `FIND_NODES` case, line ~87):

```ts
      case "LIST_VARIABLES":      return { status: "ok", result: await handleListVariables(params) };
```

- [ ] **Step 4: Write the handler**

After `handleFindNodes` (ends ~line 310) in `code.ts`:

```ts
async function handleListVariables(params: ListVariablesInput) {
  const includeRemote = params.includeRemote ?? true;
  const filters = { resolvedType: params.resolvedType, nameQuery: params.nameQuery };

  const localVars = await figma.variables.getLocalVariablesAsync();
  const localDescriptors: LocalVarDescriptor[] = await Promise.all(
    localVars.map(async (v) => {
      const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      return {
        name: v.name,
        id: v.id,
        resolvedType: v.resolvedType,
        collection: col?.name ?? "",
      };
    }),
  );
  const local = filterVariables(localDescriptors, filters);

  let library: LibraryVarDescriptor[] = [];
  let remoteEnumerated = false;
  if (includeRemote) {
    try {
      const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      const all: LibraryVarDescriptor[] = [];
      for (const col of collections) {
        const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
        for (const v of vars) {
          all.push({
            name: v.name,
            key: v.key,
            resolvedType: v.resolvedType,
            collection: col.name,
            libraryName: col.libraryName,
          });
        }
      }
      library = filterVariables(all, filters);
      remoteEnumerated = true;
    } catch {
      library = [];
      remoteEnumerated = false;
    }
  }

  return { local, library, remoteEnumerated };
}
```

- [ ] **Step 5: Register the tool in `src/server/tools.ts`**

Add `ListVariablesInput` to the import from `"../mcp-server/tools.js"` (line ~15). Add this entry to the array returned by `makeTools`, right after the `find_nodes` entry (line ~83):

```ts
    {
      name: "list_variables",
      description:
        "List Figma variables usable by name in set/toggle/conditional tools. Returns `local` variables " +
        "(in this file) and `library` variables (from connected libraries, importable on use). " +
        "Call this BEFORE proto_set_variable / proto_toggle_variable / proto_conditional instead of guessing " +
        "a variable name. `remoteEnumerated:false` means library enumeration was unavailable (local list still valid).",
      schema: ListVariablesInput,
      command: "LIST_VARIABLES" as CommandName,
    },
```

- [ ] **Step 6: Verify the build and full test suite still pass**

Run: `npm run build && npm test`
Expected: build succeeds (tsup emits plugin + server); all existing tests PASS (no regressions). `code.ts` glue has no unit test — it is verified live in Task 6.

- [ ] **Step 7: Commit**

```bash
git add src/figma-plugin/code.ts src/server/tools.ts
git commit -m "feat(plugin): list_variables tool (local + library enumeration)"
```

---

## Task 5: Extend `resolveVariableByName` with remote import

**Files:**
- Modify: `src/figma-plugin/code.ts` (`resolveVariableByName`, lines 204-218; import the error formatter)

- [ ] **Step 1: Import the error formatter**

Extend the catalog import added in Task 4 to also bring in `formatVariableNotFoundError`:

```ts
import {
  filterVariables,
  formatVariableNotFoundError,
  type LocalVarDescriptor,
  type LibraryVarDescriptor,
} from "./variable-catalog.js";
```

- [ ] **Step 2: Replace `resolveVariableByName` with the 3-step version**

Replace lines 204-218 in `code.ts`:

```ts
async function resolveVariableByName(name: string): Promise<{
  variable: Variable;
  warning?: string;
}> {
  // Step 1: local exact match (existing behavior, including the multi-match warning).
  const all = await figma.variables.getLocalVariablesAsync();
  const matches = all.filter((v) => v.name === name);
  if (matches.length > 0) {
    const picked = matches[0]!;
    const warning =
      matches.length > 1
        ? `Multiple local variables named "${name}" (${matches.length}); using the first (id ${picked.id})`
        : undefined;
    return { variable: picked, warning };
  }

  // Step 2: import a matching PUBLISHED library variable.
  const libraryNames: string[] = [];
  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    for (const col of collections) {
      const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
      for (const v of vars) {
        libraryNames.push(v.name);
        if (v.name === name) {
          const imported = await figma.variables.importVariableByKeyAsync(v.key);
          return {
            variable: imported,
            warning: `Imported library variable "${name}" from "${col.libraryName}".`,
          };
        }
      }
    }
  } catch {
    // Library enumeration unavailable — fall through to the candidate-listing error.
  }

  // Step 3: not found — list candidates.
  throw new Error(formatVariableNotFoundError(name, all.map((v) => v.name), libraryNames));
}
```

> **If Task 1 probe FAILED:** omit the entire Step-2 block, keep `libraryNames` as `[]`, and go straight from the local-miss to the Step-3 error.

- [ ] **Step 3: Verify the build and full test suite still pass**

Run: `npm run build && npm test`
Expected: build succeeds; all existing tests PASS (set_variable / toggle / conditional compile tests are unaffected — resolution is runtime-only glue).

- [ ] **Step 4: Commit**

```bash
git add src/figma-plugin/code.ts
git commit -m "feat(plugin): resolveVariableByName resolves library variables via import"
```

---

## Task 6: Live re-validation, memory, release

**Files:**
- Modify: `package.json` (version bump)
- Modify: memory files (not in repo)

- [ ] **Step 1: Rebuild and reconnect**

Run: `npm run build && npm start` (server died on reboot). Reconnect the Figma plugin to file `uxwXKX9lcuqQxAnPouWJWK` / `MCP_test_12`.

- [ ] **Step 2: Live-validate via Claude Desktop + supergateway**

Drive these scenarios through Claude Desktop (config already present from prior rounds):

1. "변수 목록 보여줘" → expect `list_variables`; local `isOpen` (BOOLEAN) listed; if probe PASSED, `corner-radius/8` (FLOAT) appears under `library` with `remoteEnumerated:true`.
2. "corner-radius/8 을 토글/조건에 써줘" → expect the remote variable resolves (import) instead of an opaque "Variable not found".
3. A deliberately wrong name (e.g. "corner-radius/9") → expect the new candidate-listing error naming `corner-radius/8`.

Record PASS/FAIL per scenario. If the probe failed in Task 1, scenario 2 is expected to surface the candidate-listing error (local-only) — that is the documented fallback, not a regression.

- [ ] **Step 3: Bump the version**

In `package.json`, bump `"version"` from `0.23.1` to `0.24.0` (next minor — note `0.24.0` was never released; the abandoned else-if work was reverted, so the number is free).

- [ ] **Step 4: Commit, tag, and release**

```bash
git add package.json
git commit -m "chore: release v0.24.0 — variable discoverability + remote resolution"
git tag v0.24.0
git push origin main --tags
gh release create v0.24.0 --title "v0.24.0 — list_variables + remote variable resolution" --notes "Adds list_variables (local + library) and library/remote variable resolution in set/toggle/conditional via importVariableByKeyAsync. Closes F2 from the 2026-06-08 NL-steering live validation."
```

- [ ] **Step 5: Write the shipped/blocked memory**

Create a memory file `v0.24.0-shipped.md` (if remote PASSED) or `v0.24.0-remote-var-blocked.md` (if the probe FAILED and only A shipped), record the live-validation outcomes and any API surprises, add the one-line pointer to `MEMORY.md`, link `[[nl-steering-live-validation]]` and `[[runtime-vs-typings-mismatch]]`, and delete the now-stale `f2-brainstorm-in-progress.md` pointer + file.

---

## Notes for the implementer

- **Resolution order matters:** local exact match wins over library import (Task 5 Step 2 runs only after a local miss). This preserves existing behavior for local vars and avoids surprise imports.
- **`importVariableByKeyAsync` takes the VARIABLE key** (`LibraryVariable.key`), not the collection key. Confirmed in plugin-typings (line 2207, 2220).
- **Published-only:** unpublished library variables are not returned by `getVariablesInLibraryCollectionAsync`, so they neither resolve nor appear in candidate lists. This is a Figma platform constraint (typings line 10320), surfaced by the Task 1 probe.
- **`code.ts` is not unit-tested** by design — `figma`-global handlers are verified live (Task 6). All testable logic lives in `variable-catalog.ts` (Task 3) and the zod schema (Task 2).
