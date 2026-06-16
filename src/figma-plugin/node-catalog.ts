// Pure node name-resolution decision + error formatting. No figma.* access —
// the plugin collects the candidate pool (findAll + scope) and calls these.
// Mirrors variable-catalog.ts.

export interface NodeCandidate {
  id: string;
  name: string;
  screen: string | null;
}

export type NodeMatch =
  | { kind: "match"; id: string }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: NodeCandidate[] };

/** Pick a node from the pool by exact (case-insensitive) name. */
export function selectNodeMatch(name: string, pool: NodeCandidate[]): NodeMatch {
  const lower = name.toLowerCase();
  const matches = pool.filter((c) => c.name.toLowerCase() === lower);
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "match", id: matches[0].id };
  return { kind: "ambiguous", candidates: matches };
}

export function formatNodeNotFoundError(name: string, scope: string | null): string {
  const where = scope ? ` in screen "${scope}"` : " on this page";
  return `No node named "${name}"${where}. Pass a node ID, or use find_nodes to locate it.`;
}

export function formatAmbiguousNodeError(name: string, candidates: NodeCandidate[]): string {
  const list = candidates
    .map((c) => `  - ${c.id}${c.screen ? ` (in "${c.screen}")` : ""}`)
    .join("\n");
  return (
    `"${name}" matches ${candidates.length} nodes — pick one by ID, ` +
    `or narrow with fromScreen:\n${list}`
  );
}
