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

/** Map a trigger object to a DOM handler prop name. Unknown -> onClick (+ recorded note). */
function triggerToHandler(trigger: any): string {
  const t = trigger?.type;
  if (t === "ON_HOVER" || t === "MOUSE_ENTER") return "onMouseEnter";
  if (t === "MOUSE_LEAVE") return "onMouseLeave";
  return "onClick";
}

/** Render a single action as a line of handler-body code. */
function renderAction(a: Action, indent: string): string[] {
  switch (a.type) {
    case "navigate":
    case "scrollTo":
    case "openOverlay":
    case "swapOverlay": {
      const t = mapTransition((a as any).transition);
      const slug = a.to?.name ? `/${slugify(a.to.name)}` : "/";
      return [`${indent}navigate(${JSON.stringify(slug)}, { state: { transition: ${JSON.stringify(t)} } });`];
    }
    case "back":
      return [`${indent}navigate(-1);`];
    case "closeOverlay":
      return [`${indent}navigate(-1); // close overlay`];
    case "openUrl":
      return [`${indent}window.open(${JSON.stringify(String((a as any).url ?? ""))}, ${(a as any).openInNewTab ? '"_blank"' : '"_self"'});`];
    case "setVariable":
      return [`${indent}set(${JSON.stringify(String((a as any).variable))}, ${JSON.stringify((a as any).value)});`];
    case "toggleVariable":
      return [`${indent}toggle(${JSON.stringify(String((a as any).variable))});`];
    case "changeVariant":
      return [`${indent}// TODO: changeVariant to ${JSON.stringify(a.to?.name ?? a.to?.id ?? "")} — variants are a design concern; wire manually.`];
    case "conditional": {
      const cond = renderCondition((a as any).if);
      const then = (a as any).then.flatMap((x: Action) => renderAction(x, indent + "  "));
      const out = [`${indent}if (${cond}) {`, ...then, `${indent}}`];
      if ((a as any).else && (a as any).else.length) {
        const els = (a as any).else.flatMap((x: Action) => renderAction(x, indent + "  "));
        out.push(`${indent}else {`, ...els, `${indent}}`);
      }
      return out;
    }
    default:
      return [`${indent}// TODO: unsupported action ${JSON.stringify((a as any).type)}`];
  }
}

/** Render a condition node to a JS boolean expression over useProtoVar values. */
function renderCondition(node: any): string {
  if (!node || typeof node !== "object") return "false";
  if (Array.isArray(node.all)) return node.all.map(renderCondition).join(" && ") || "true";
  if (Array.isArray(node.any)) return node.any.map(renderCondition).join(" || ") || "false";
  if (typeof node.variable === "string") {
    const op = node.operator === "NEQ" ? "!==" : "===";
    return `vars[${JSON.stringify(node.variable)}] ${op} ${JSON.stringify(node.value)}`;
  }
  return "false";
}

/** Emit one interaction-hook file per screen. */
export function emitScreenInteractions(spec: InteractionSpec): GeneratedFile[] {
  return spec.screens.map((s) => {
    const comp = pascalCase(s.name ?? "");
    const handlers = s.interactions.map((it) => {
      const handler = triggerToHandler(it.trigger);
      const key = it.source?.name ? pascalCase(it.source.name) : it.source?.id ?? "node";
      const body = it.actions.flatMap((a) => renderAction(a, "        ")).join("\n");
      return [
        `    ${JSON.stringify(key)}: {`,
        `      ${handler}: () => {`,
        body,
        `      },`,
        `    },`,
      ].join("\n");
    }).join("\n");
    const content = [
      `import { useNavigate } from "react-router-dom";`,
      `import { useProtoStore } from "../prototype-store";`,
      ``,
      `// Interaction handlers for the "${s.name ?? s.id}" screen, keyed by source node.`,
      `export function use${comp}Interactions() {`,
      `  const navigate = useNavigate();`,
      `  const { vars, set, toggle } = useProtoStore();`,
      `  return {`,
      handlers,
      `  };`,
      `}`,
      ``,
    ].join("\n");
    return { path: `interactions/${comp}.ts`, content };
  });
}
