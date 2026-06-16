import type { InteractionSpec } from "../server/interaction-spec.js";
import type { Emitter, GeneratedFile } from "./types.js";
import { emitReact } from "./emitters/react.js";

const EMITTERS: Record<string, Emitter> = {
  react: emitReact,
};

/** The selectable codegen targets (keep in sync with GenerateInteractionCodeInput.target). */
export const EMITTER_TARGETS = Object.keys(EMITTERS) as ["react"];

export function runEmitter(target: string, spec: InteractionSpec): GeneratedFile[] {
  const emitter = EMITTERS[target];
  if (!emitter) {
    throw new Error(`Unknown target "${target}" (available: ${Object.keys(EMITTERS).join(", ")})`);
  }
  return emitter(spec);
}
