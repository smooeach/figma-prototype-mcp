// Pure functions: convert our tool input to the shape that Figma Plugin API expects
// when calling node.setReactionsAsync([reaction]).

export type TransitionName = "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
export type TriggerName = "ON_CLICK" | "ON_HOVER" | "ON_PRESS";

export type TransitionShape =
  | null
  | { type: "DISSOLVE"; duration: number; easing: { type: string } }
  | { type: "SMART_ANIMATE"; duration: number; easing: { type: string } };

// Figma encodes Scroll To as a NODE action with `navigation: "SCROLL_TO"`, not a
// separate top-level action type. setReactionsAsync rejects `type: "SCROLL_TO"`.
export type BuiltAction = {
  type: "NODE";
  destinationId: string;
  navigation: "NAVIGATE" | "SCROLL_TO";
  transition: TransitionShape;
  preserveScrollPosition: false;
};

export interface BuiltReaction {
  trigger: { type: string };
  actions: BuiltAction[];
}

export interface NavigateBuildInput {
  sourceNodeId: string;
  targetFrameId: string;
  trigger: TriggerName;
  transition: TransitionName;
}

export interface ScrollBuildInput {
  sourceNodeId: string;
  targetNodeId: string;
  trigger: TriggerName;
  transition: TransitionName;
}

// Backward-compat alias used by older imports/tests.
export type BuildInput = NavigateBuildInput;

export function buildTransition(name: TransitionName): TransitionShape {
  if (name === "INSTANT") return null;
  return { type: name, duration: 0.3, easing: { type: "EASE_OUT" } };
}

export function buildNavigateReaction(input: NavigateBuildInput): BuiltReaction {
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

export function buildScrollReaction(input: ScrollBuildInput): BuiltReaction {
  return {
    trigger: { type: input.trigger },
    actions: [
      {
        type: "NODE",
        destinationId: input.targetNodeId,
        navigation: "SCROLL_TO",
        transition: buildTransition(input.transition),
        preserveScrollPosition: false,
      },
    ],
  };
}
