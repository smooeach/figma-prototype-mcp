import type { InteractionSpec } from "../../server/interaction-spec.js";
import type { Action } from "../../server/interaction-spec.js";
import type { GeneratedFile } from "../types.js";
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

// ---------------------------------------------------------------------------

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
  const identities = buildScreenIdentities(spec);
  const imports = spec.screens
    .map((s) => {
      const { component } = identities.get(s.id)!;
      return `import ${component} from "./screens/${component}";`;
    })
    .join("\n");
  const routes = spec.screens
    .map((s) => {
      const { component, path } = identities.get(s.id)!;
      return `  { path: ${JSON.stringify(path)}, element: <${component} /> },`;
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
function renderAction(a: Action, indent: string, identities: Map<string, ScreenIdentity>): string[] {
  switch (a.type) {
    case "navigate":
    case "scrollTo":
    case "openOverlay":
    case "swapOverlay": {
      const t = mapTransition((a as any).transition);
      const toId: string | undefined = (a as any).to?.id;
      const toName: string | undefined = (a as any).to?.name;
      const identity = toId ? identities.get(toId) : undefined;
      let path: string;
      let todoComment: string | undefined;
      if (identity) {
        path = identity.path;
      } else {
        path = toName ? `/${slugify(toName)}` : "/";
        if (toName) {
          todoComment = `${indent}// TODO: target screen "${toName}" is not in the generated routes`;
        }
      }
      const line = `${indent}navigate(${JSON.stringify(path)}, { state: { transition: ${JSON.stringify(t)} } });`;
      return todoComment ? [line, todoComment] : [line];
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
      const then = (a as any).then.flatMap((x: Action) => renderAction(x, indent + "  ", identities));
      const out = [`${indent}if (${cond}) {`, ...then, `${indent}}`];
      if ((a as any).else && (a as any).else.length) {
        const els = (a as any).else.flatMap((x: Action) => renderAction(x, indent + "  ", identities));
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

/** Emit one interaction-hook file per screen. */
export function emitScreenInteractions(spec: InteractionSpec): GeneratedFile[] {
  const identities = buildScreenIdentities(spec);
  return spec.screens.map((s) => {
    const { component: comp } = identities.get(s.id)!;
    const handlers = s.interactions.map((it) => {
      const handler = triggerToHandler(it.trigger);
      const key = it.source?.name ? pascalCase(it.source.name) : it.source?.id ?? "node";
      const body = it.actions.flatMap((a) => renderAction(a, "        ", identities)).join("\n");
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

/** Emit a README explaining how to wire the files in + listing unsupported interactions. */
export function emitReadme(spec: InteractionSpec): string {
  const unsupportedLines = spec.unsupported.length
    ? spec.unsupported.map((u) => `- \`${u.source?.name ?? u.source?.id ?? "?"}\`: ${u.reason}`).join("\n")
    : "- (none)";
  return [
    `# Generated prototype interactions (React)`,
    ``,
    `Generated from the Figma prototype. Covers navigation, transitions, variables, and`,
    `conditionals — NOT screen UI. Wire these into your own components.`,
    ``,
    `## Dependencies`,
    `- \`react-router-dom\` (navigation)`,
    `- \`framer-motion\` (transitions — see \`state.transition\` passed on navigate)`,
    ``,
    `## Files`,
    `- \`routes.tsx\` — route table; render with \`<RouterProvider router={router} />\`.`,
    `- \`prototype-store.tsx\` — wrap your app in \`<PrototypeStoreProvider>\`; read with \`useProtoVar(name)\`.`,
    `- \`interactions/<Screen>.ts\` — \`use<Screen>Interactions()\` returns handlers keyed by source node; spread onto your elements.`,
    ``,
    `## Unsupported / manual interactions`,
    unsupportedLines,
    ``,
    spec.truncated ? `> Note: the source flow was truncated; some interactions may be missing.\n` : ``,
  ].join("\n");
}

/** The React emitter: InteractionSpec -> structured file set. */
export function emitReact(spec: InteractionSpec): GeneratedFile[] {
  return [
    { path: "routes.tsx", content: emitRoutes(spec) },
    { path: "prototype-store.tsx", content: emitStore(spec) },
    ...emitScreenInteractions(spec),
    { path: "README.md", content: emitReadme(spec) },
  ];
}
