// Pure function: converts our tool input to the shape that Figma Plugin API expects
// when calling node.setReactionsAsync([reaction]).
//
// We do NOT import @figma/plugin-typings here because this file runs inside the
// plugin sandbox at runtime; we just return a plain object that matches the shape.

export type TransitionName = "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
export type TriggerName = "ON_CLICK" | "ON_HOVER" | "ON_PRESS";

export type TransitionShape =
  | null
  | { type: "DISSOLVE"; duration: number; easing: { type: string } }
  | { type: "SMART_ANIMATE"; duration: number; easing: { type: string } };

export interface BuildInput {
  sourceNodeId: string;
  targetFrameId: string;
  trigger: TriggerName;
  transition: TransitionName;
}

export interface BuiltReaction {
  trigger: { type: string };
  actions: Array<{
    type: "NODE";
    destinationId: string;
    navigation: "NAVIGATE";
    transition: TransitionShape;
    preserveScrollPosition: false;
  }>;
}

export function buildTransition(name: TransitionName): TransitionShape {
  if (name === "INSTANT") return null;
  return { type: name, duration: 0.3, easing: { type: "EASE_OUT" } };
}

export function buildNavigateReaction(input: BuildInput): BuiltReaction {
  return {
    trigger: { type: input.trigger },
    actions: [
      {
        type: "NODE",
        destinationId: input.targetFrameId,
        navigation: "NAVIGATE",
        transition: buildTransition(input.transition),
        preserveScrollPosition: false,
      },
    ],
  };
}
