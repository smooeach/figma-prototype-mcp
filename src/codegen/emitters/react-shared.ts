// Pure pieces shared by the React and React Native emitters (RN runs React, so the
// variable store + condition logic are identical). No I/O, no figma.*.
import type { InteractionSpec, Action } from "../../server/interaction-spec.js";
import { pascalCase, slugify } from "../types.js";

// ---------------------------------------------------------------------------
// Screen identity — unique component name + route path keyed by frame id
// ---------------------------------------------------------------------------

export interface ScreenIdentity { component: string; path: string; }

/** id-fragment safe for identifiers/paths: "935:21614" -> "935_21614". */
function idFragment(id: string): string {
  return (id ?? "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "x";
}

/**
 * Build id -> unique {component, path}.
 * First screen gets path "/". Collisions get an id suffix.
 */
export function buildScreenIdentities(spec: InteractionSpec): Map<string, ScreenIdentity> {
  const map = new Map<string, ScreenIdentity>();
  const usedComponents = new Set<string>();
  const usedPaths = new Set<string>();
  spec.screens.forEach((s, i) => {
    const base = pascalCase(s.name ?? "");
    let component = base;
    if (usedComponents.has(component)) component = `${base}_${idFragment(s.id)}`;
    usedComponents.add(component);

    let path = i === 0 ? "/" : `/${slugify(s.name ?? "")}`;
    if (path !== "/" && usedPaths.has(path)) path = `/${slugify(s.name ?? "")}-${idFragment(s.id)}`;
    usedPaths.add(path);

    map.set(s.id, { component, path });
  });
  return map;
}

/** Walk all actions (including conditional branches) and collect referenced variable names. */
export function collectVariables(spec: InteractionSpec): string[] {
  const names = new Set<string>();
  const visit = (actions: Action[]) => {
    for (const a of actions) {
      if (a.type === "setVariable" || a.type === "toggleVariable") {
        if (typeof a.variable === "string") names.add(a.variable);
      } else if (a.type === "conditional") {
        collectConditionVars(a.if, names);
        visit(a.then);
        if (a.else) visit(a.else);
      }
    }
  };
  for (const s of spec.screens) for (const it of s.interactions) visit(it.actions);
  return [...names];
}

function collectConditionVars(node: any, names: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node.all)) node.all.forEach((n: any) => collectConditionVars(n, names));
  else if (Array.isArray(node.any)) node.any.forEach((n: any) => collectConditionVars(n, names));
  else if (typeof node.variable === "string") names.add(node.variable);
}

/** Render a condition node to a JS boolean expression over useProtoVar values. */
export function renderCondition(node: any): string {
  if (!node || typeof node !== "object") return "false";
  if (Array.isArray(node.all)) return node.all.map(renderCondition).join(" && ") || "true";
  if (Array.isArray(node.any)) return node.any.map(renderCondition).join(" || ") || "false";
  if (typeof node.variable === "string") {
    const OP_MAP: Record<string, string> = {
      "==": "===",
      "!=": "!==",
      "<": "<",
      "<=": "<=",
      ">": ">",
      ">=": ">=",
    };
    const op = OP_MAP[node.operator as string] ?? "===";
    return `vars[${JSON.stringify(node.variable)}] ${op} ${JSON.stringify(node.value)}`;
  }
  return "false";
}

/** Emit a React Context store holding the prototype's variables as state. */
export function emitStore(spec: InteractionSpec): string {
  const vars = collectVariables(spec);
  const initial = vars.map((v) => `  ${JSON.stringify(v)}: undefined as unknown,`).join("\n");
  return [
    `import { createContext, useContext, useState, useCallback } from "react";`,
    ``,
    `// Prototype variables, generated from the Figma prototype's set/toggle/conditional actions.`,
    `const INITIAL: Record<string, unknown> = {`,
    initial,
    `};`,
    ``,
    `const StoreContext = createContext<{`,
    `  vars: Record<string, unknown>;`,
    `  set: (name: string, value: unknown) => void;`,
    `  toggle: (name: string) => void;`,
    `} | null>(null);`,
    ``,
    `export function PrototypeStoreProvider({ children }: { children: React.ReactNode }) {`,
    `  const [vars, setVars] = useState<Record<string, unknown>>(INITIAL);`,
    `  const set = useCallback(function set(name: string, value: unknown) { setVars((s) => ({ ...s, [name]: value })); }, []);`,
    `  const toggle = useCallback(function toggle(name: string) { setVars((s) => ({ ...s, [name]: !s[name] })); }, []);`,
    `  return <StoreContext.Provider value={{ vars, set, toggle }}>{children}</StoreContext.Provider>;`,
    `}`,
    ``,
    `export function useProtoStore() {`,
    `  const ctx = useContext(StoreContext);`,
    `  if (!ctx) throw new Error("useProtoStore must be used within PrototypeStoreProvider");`,
    `  return ctx;`,
    `}`,
    ``,
    `export function useProtoVar(name: string) {`,
    `  return useProtoStore().vars[name];`,
    `}`,
    ``,
  ].join("\n");
}
