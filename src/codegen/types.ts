import type { InteractionSpec } from "../server/interaction-spec.js";

/** One generated source file returned in the tool result (never written to disk here). */
export interface GeneratedFile {
  path: string;
  content: string;
}

/** A framework code generator: pure InteractionSpec -> files. No I/O, no figma.*. */
export type Emitter = (spec: InteractionSpec) => GeneratedFile[];

/** "Home Screen" -> "HomeScreen". Falls back to "Screen" for empty input. */
export function pascalCase(name: string): string {
  const parts = (name ?? "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const pascal = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return pascal || "Screen";
}

/** "Home Screen" -> "home-screen". Falls back to "screen" for empty input. */
export function slugify(name: string): string {
  const slug = (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "screen";
}
