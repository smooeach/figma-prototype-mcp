// Pure functions: convert our tool input to the shape that Figma Plugin API expects
// when calling node.setReactionsAsync([reaction]).

export type TransitionName = "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
export type TriggerName = "ON_CLICK" | "ON_HOVER" | "ON_PRESS";

export type TransitionShape =
  | null
  | { type: "DISSOLVE"; duration: number; easing: { type: string } }
  | { type: "SMART_ANIMATE"; duration: number; easing: { type: string } };

// Figma's Action union: NODE actions cover NAVIGATE/SCROLL_TO/OVERLAY/SWAP navigations.
// CLOSE, BACK, URL are top-level action.types with their own shapes.
export type BuiltAction =
  | {
      type: "NODE";
      destinationId: string;
      navigation: "NAVIGATE" | "SCROLL_TO" | "OVERLAY" | "SWAP";
      transition: TransitionShape;
      preserveScrollPosition: false;
    }
  | { type: "CLOSE" }
  | { type: "BACK" }
  | { type: "URL"; url: string; openInNewTab: boolean };

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

export interface BackBuildInput {
  trigger: TriggerName;
}

export interface UrlBuildInput {
  trigger: TriggerName;
  url: string;
  openInNewTab?: boolean;
}

export interface SwapOverlayBuildInput {
  trigger: TriggerName;
  transition: TransitionName;
  targetFrameId: string;
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

export function buildBackReaction(input: BackBuildInput): BuiltReaction {
  return {
    trigger: { type: input.trigger },
    actions: [{ type: "BACK" }],
  };
}

export function buildUrlReaction(input: UrlBuildInput): BuiltReaction {
  return {
    trigger: { type: input.trigger },
    actions: [{ type: "URL", url: input.url, openInNewTab: input.openInNewTab ?? false }],
  };
}

export function buildSwapOverlayReaction(input: SwapOverlayBuildInput): BuiltReaction {
  return {
    trigger: { type: input.trigger },
    actions: [
      {
        type: "NODE",
        destinationId: input.targetFrameId,
        navigation: "SWAP",
        transition: buildTransition(input.transition),
        preserveScrollPosition: false,
      },
    ],
  };
}
