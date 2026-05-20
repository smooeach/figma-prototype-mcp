// Pure functions: convert our tool input to the shape that Figma Plugin API expects
// when calling node.setReactionsAsync([reaction]).

export type TransitionName = "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
export type TriggerName = "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "AFTER_TIMEOUT";

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

export type TriggerShape = { type: string; timeout?: number };

export interface BuiltReaction {
  trigger: TriggerShape;
  actions: BuiltAction[];
}

export interface NavigateBuildInput {
  targetFrameId: string;
  trigger: TriggerName;
  transition: TransitionName;
  afterTimeoutSeconds?: number;
}

export interface ScrollBuildInput {
  targetNodeId: string;
  trigger: TriggerName;
  transition: TransitionName;
  afterTimeoutSeconds?: number;
}

export interface OverlayBuildInput {
  targetFrameId: string;
  trigger: TriggerName;
  transition: TransitionName;
  afterTimeoutSeconds?: number;
}

export interface CloseBuildInput {
  trigger: TriggerName;
  afterTimeoutSeconds?: number;
}

export interface BackBuildInput {
  trigger: TriggerName;
  afterTimeoutSeconds?: number;
}

export interface UrlBuildInput {
  trigger: TriggerName;
  url: string;
  openInNewTab?: boolean;
  afterTimeoutSeconds?: number;
}

export interface SwapOverlayBuildInput {
  trigger: TriggerName;
  transition: TransitionName;
  targetFrameId: string;
  afterTimeoutSeconds?: number;
}

export function buildTransition(name: TransitionName): TransitionShape {
  if (name === "INSTANT") return null;
  return { type: name, duration: 0.3, easing: { type: "EASE_OUT" } };
}

export function buildTrigger(name: TriggerName, afterTimeoutSeconds?: number): TriggerShape {
  if (name === "AFTER_TIMEOUT") {
    if (afterTimeoutSeconds === undefined) {
      throw new Error("buildTrigger: afterTimeoutSeconds is required when name is AFTER_TIMEOUT");
    }
    return { type: "AFTER_TIMEOUT", timeout: afterTimeoutSeconds };
  }
  return { type: name };
}

export function buildNavigateReaction(input: NavigateBuildInput): BuiltReaction {
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
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
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
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
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
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
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [{ type: "CLOSE" }],
  };
}

export function buildBackReaction(input: BackBuildInput): BuiltReaction {
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [{ type: "BACK" }],
  };
}

export function buildUrlReaction(input: UrlBuildInput): BuiltReaction {
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [{ type: "URL", url: input.url, openInNewTab: input.openInNewTab ?? false }],
  };
}

export function buildSwapOverlayReaction(input: SwapOverlayBuildInput): BuiltReaction {
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
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
