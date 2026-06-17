import type { InteractionSpec } from "../../server/interaction-spec.js";
import type { Action } from "../../server/interaction-spec.js";
import type { GeneratedFile } from "../types.js";
import { pascalCase, slugify } from "../types.js";
import {
  type ScreenIdentity,
  buildScreenIdentities,
  renderCondition,
  emitStore,
} from "./react-shared.js";

// Re-export the shared pieces that external modules/tests import from this path.
export { type ScreenIdentity, buildScreenIdentities, collectVariables, emitStore } from "./react-shared.js";

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
    case "openOverlay":
    case "swapOverlay": {
      const toName = (a as any).to?.name ?? "";
      const id = (a as any).to?.id;
      const identity = id ? identities.get(id) : undefined;
      const screen = identity ? identity.component : (toName ? pascalCase(toName) : "Home");
      const style = (a as any).overlay?.style === "dialog" ? "dialog" : "sheet";
      const dismissable = (a as any).overlay?.dismissable === false ? "false" : "true";
      const line = `${indent}presentOverlay({ screen: ${JSON.stringify(screen)}, style: ${JSON.stringify(style)}, dismissable: ${dismissable} });`;
      return identity ? [line] : [line, `${indent}// TODO: overlay target "${toName || id || ""}" is not in the generated routes`];
    }
    case "scrollTo": {
      const label = (a as any).to?.name ?? (a as any).to?.id ?? "";
      const id = String((a as any).to?.id ?? "");
      return [`${indent}// TODO: scroll to "${label}" — document.getElementById("${id}")?.scrollIntoView({ behavior: "smooth" })`];
    }
    case "navigate": {
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
      return [`${indent}dismissOverlay();`];
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

/**
 * Emit one interaction-hook file per screen — including screens with no interactions
 * (an empty hook), for 1:1 parity with the routes table. (The React Native emitter, by
 * contrast, skips empty screens since it has no routes table to anchor them to.)
 */
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
      `  const { vars, set, toggle, presentOverlay, dismissOverlay } = useProtoStore();`,
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
    `- Overlays: read \`useProtoStore().overlay\` and render a modal (sheet/dialog by \`overlay.style\`); call \`dismissOverlay()\` to close.`,
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
