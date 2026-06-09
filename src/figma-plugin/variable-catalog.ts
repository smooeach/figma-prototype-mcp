// Pure helpers for the list_variables tool and the variable resolver: filter a
// list of variable descriptors by type/name, and format the "not found" error
// listing available candidate names. No `figma.*` API — callers fetch the
// descriptors; this module is unit-testable in isolation.

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
