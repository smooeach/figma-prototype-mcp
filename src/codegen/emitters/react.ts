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
