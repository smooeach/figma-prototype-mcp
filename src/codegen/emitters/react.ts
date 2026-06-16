import type { InteractionSpec } from "../../server/interaction-spec.js";
import type { Action } from "../../server/interaction-spec.js";
import type { GeneratedFile } from "../types.js";
import { pascalCase, slugify } from "../types.js";

/** Map a Figma transition (best-effort, shape is loose) to a framer-motion transition. */
export function mapTransition(transition: any): { duration: number; ease: string } {
  const duration = typeof transition?.duration === "number" ? transition.duration : 0.3;
  const raw = transition?.easing?.type ?? transition?.easing ?? transition?.type;
  const ease =
    raw === "EASE_IN" ? "easeIn"
    : raw === "EASE_OUT" ? "easeOut"
    : raw === "LINEAR" ? "linear"
    : "easeInOut";
  return { duration, ease };
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

/** Build a react-router route table from the screens. First screen maps to "/". */
export function emitRoutes(spec: InteractionSpec): string {
  const screens = spec.screens;
  const imports = screens
    .map((s) => `import ${pascalCase(s.name ?? "")} from "./screens/${pascalCase(s.name ?? "")}";`)
    .join("\n");
  const routes = screens
    .map((s, i) => {
      const path = i === 0 ? "/" : `/${slugify(s.name ?? "")}`;
      return `  { path: ${JSON.stringify(path)}, element: <${pascalCase(s.name ?? "")} /> },`;
    })
    .join("\n");
  return [
    `import { createBrowserRouter } from "react-router-dom";`,
    imports,
    ``,
    `// Routes generated from the Figma prototype screen graph.`,
    `export const router = createBrowserRouter([`,
    routes,
    `]);`,
    ``,
  ].join("\n");
}
