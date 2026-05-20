// Pure functions: convert our tool input to the shape that Figma Plugin API expects
// when calling node.setReactionsAsync([reaction]).

export type TransitionName = "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
export type TriggerName = "ON_CLICK" | "ON_HOVER" | "ON_PRESS";

export type TransitionShape =
  | null
  | { type: "DISSOLVE"; duration: number; easing: { type: string } }
  | { type: "SMART_ANIMATE"; duration: number; easing: { type: string } };

// Figma encodes Scroll To and Open Overlay as NODE actions with the
// corresponding navigation value, not as separate top-level action types.
// Close Overlay IS a top-level type ("CLOSE") with no extra fields.
export type BuiltAction =
  | {
      type: "NODE";
      destinationId: string;
      navigation: "NAVIGATE" | "SCROLL_TO" | "OVERLAY";
      transition: TransitionShape;
      preserveScrollPosition: false;
      overlayRelativePosition?: { x: number; y: number };
      overlayBackgroundInteraction?: "NONE" | "CLOSE_ON_CLICK_OUTSIDE";
      overlayBackground?:
        | { type: "NONE" }
        | { type: "SOLID_COLOR"; color: { r: number; g: number; b: number; a: number } };
    }
  | { type: "CLOSE" };

export interface BuiltReaction {
  trigger: { type: string };
  actions: BuiltAction[];
}

export interface NavigateBuildInput {
  targetFrameId: string;
  trigger: TriggerName;
  transition: TransitionName;
}

export interface ScrollBuildInput {
  targetNodeId: string;
  trigger: TriggerName;
  transition: TransitionName;
}

export interface OverlayBuildInput {
  targetFrameId: string;
  trigger: TriggerName;
  transition: TransitionName;
}

export interface CloseBuildInput {
  trigger: TriggerName;
}

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

export function buildOverlayReaction(input: OverlayBuildInput): BuiltReaction {
  return {
    trigger: { type: input.trigger },
    actions: [
      {
        type: "NODE",
        destinationId: input.targetFrameId,
        navigation: "OVERLAY",
        transition: buildTransition(input.transition),
        preserveScrollPosition: false,
        overlayRelativePosition: { x: 0, y: 0 },
        overlayBackgroundInteraction: "CLOSE_ON_CLICK_OUTSIDE",
        overlayBackground: { type: "NONE" },
      },
    ],
  };
}

export function buildCloseReaction(input: CloseBuildInput): BuiltReaction {
  return {
    trigger: { type: input.trigger },
    actions: [{ type: "CLOSE" }],
  };
}
