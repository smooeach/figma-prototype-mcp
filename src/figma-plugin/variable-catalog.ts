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
