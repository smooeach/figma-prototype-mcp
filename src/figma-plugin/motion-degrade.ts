// Pure composition of node-tree layer matching + transition degrading.
// No figma.* references — safe inside the plugin bundle and unit-testable.

import { framesShareLayer, findTopLevelFrameNode, type NodeLike } from "./node-tree.js";
import { isSmartAnimate, degradeTransition, type TransitionInput } from "./reaction-builder.js";

/**
 * Decide the transition to actually use for a navigate reaction. When the
 * motion is SMART_ANIMATE and the source's top-level frame shares no matching
 * layer names with the destination frame, degrade to `degradeTo` (default
 * DISSOLVE) since there is nothing to morph. Otherwise return it unchanged.
 */
export function resolveNavigateTransition(args: {
  source: NodeLike;
  destFrame: NodeLike;
  transition: TransitionInput;
  degradeTo: "DISSOLVE" | "INSTANT" | undefined;
}): { transition: TransitionInput; warning?: string } {
  const { source, destFrame, transition, degradeTo } = args;
  if (!isSmartAnimate(transition)) return { transition };
  const srcTop = findTopLevelFrameNode(source);
  if (!srcTop) return { transition };
  if (framesShareLayer(srcTop, destFrame)) return { transition };
  const to = degradeTo ?? "DISSOLVE";
  return {
    transition: degradeTransition(transition, to),
    warning: `SMART_ANIMATE has no matching layers between "${srcTop.name}" and "${destFrame.name}"; degraded to ${to}`,
  };
}
