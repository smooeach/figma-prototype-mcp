// Pure function: converts our tool input to the shape that Figma Plugin API expects
// when calling node.setReactionsAsync([reaction]).
//
// We do NOT import @figma/plugin-typings here because this file runs inside the
// plugin sandbox at runtime; we just return a plain object that matches the shape.
// Tests use a structural assertion instead of the Figma types.

export interface BuildInput {
  sourceNodeId: string;
  targetFrameId: string;
  trigger: "ON_CLICK" | "ON_HOVER" | "ON_PRESS";
  transition: "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
}

export interface BuiltReaction {
  trigger: { type: string };
  actions: Array<{
    type: "NODE";
    destinationId: string;
    navigation: "NAVIGATE";
    transition:
      | { type: "INSTANT" }
      | { type: "DISSOLVE"; duration: number }
      | { type: "SMART_ANIMATE"; duration: number; easing: { type: string } };
    preserveScrollPosition: false;
  }>;
}

export function buildNavigateReaction(input: BuildInput): BuiltReaction {
  let transition: BuiltReaction["actions"][number]["transition"];
  if (input.transition === "INSTANT") {
    transition = { type: "INSTANT" };
  } else if (input.transition === "DISSOLVE") {
    transition = { type: "DISSOLVE", duration: 0.3 };
  } else {
    transition = { type: "SMART_ANIMATE", duration: 0.3, easing: { type: "EASE_OUT" } };
  }

  return {
    trigger: { type: input.trigger },
    actions: [
      {
        type: "NODE",
        destinationId: input.targetFrameId,
        navigation: "NAVIGATE",
        transition,
        preserveScrollPosition: false,
      },
    ],
  };
}
