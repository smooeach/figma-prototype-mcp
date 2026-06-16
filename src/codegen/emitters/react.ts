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
