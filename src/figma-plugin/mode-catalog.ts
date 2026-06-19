// Pure resolution of a (collection?, mode) name pair to Figma ids. No figma.*/zod —
// safe in the plugin bundle. Mirrors variable-catalog's name-collision handling.

export interface CollectionModesDescriptor {
  id: string;
  name: string;
  modes: { name: string; modeId: string; isDefault: boolean }[];
}

export type ModeSelection =
  | { kind: "match"; collectionId: string; modeId: string }
  | { kind: "not_found"; message: string }
  | { kind: "ambiguous"; message: string };

export function selectModeMatch(
  collections: CollectionModesDescriptor[],
  mode: string,
  collection?: string,
): ModeSelection {
  const scoped = collection !== undefined
    ? collections.filter((c) => c.name === collection)
    : collections;

  if (collection !== undefined && scoped.length === 0) {
    return { kind: "not_found", message: `Collection not found: "${collection}". Available: ${collections.map((c) => c.name).join(", ") || "(none)"}` };
  }

  const hits: { col: CollectionModesDescriptor; modeId: string }[] = [];
  for (const c of scoped) {
    const m = c.modes.find((x) => x.name === mode);
    if (m) hits.push({ col: c, modeId: m.modeId });
  }

  if (hits.length === 1) return { kind: "match", collectionId: hits[0]!.col.id, modeId: hits[0]!.modeId };
  if (hits.length === 0) {
    const where = collection !== undefined ? ` in collection "${collection}"` : "";
    const avail = scoped.map((c) => `${c.name}: [${c.modes.map((m) => m.name).join(", ")}]`).join("; ");
    return { kind: "not_found", message: `Mode "${mode}" not found${where}. Modes — ${avail || "(none)"}` };
  }
  return {
    kind: "ambiguous",
    message: `Mode "${mode}" exists in ${hits.length} collections — pass collection to choose one:\n` +
      hits.map((h) => `  - ${h.col.name}`).join("\n"),
  };
}
