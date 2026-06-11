// Pure functions: convert our tool input to the shape that Figma Plugin API expects
// when calling node.setReactionsAsync([reaction]).

import type {
  TriggerName as WTriggerName,
  // not re-exported below, so no name collision — imported unprefixed
  TriggerNoParamType,
  MouseClickType,
  MouseHoverType,
  KeyboardDevice as WKeyboardDevice,
  TransitionName as WTransitionName,
  SimpleTransitionType as WSimpleTransitionType,
  DirectionalTransitionType as WDirectionalTransitionType,
  NamedEasingName as WNamedEasingName,
  Direction as WDirection,
} from "../shared/wire-vocabulary.js";

// shortcut strings — keep for backward compat at the API surface
export type TransitionName = WTransitionName;

export type SimpleTransitionType = WSimpleTransitionType;

export type NamedEasingName = WNamedEasingName;

// Backward-compat alias.
export type EasingName = NamedEasingName;

export interface CustomCubicBezierEasing {
  type: "CUSTOM_CUBIC_BEZIER";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Figma's runtime rejects `initialVelocity` despite it appearing in the
// plugin typings — typings vs runtime mismatch confirmed by setReactionsAsync
// returning "Unrecognized key(s) in object: 'initialVelocity'". Only the
// three core spring fields are accepted.
export interface CustomSpringEasing {
  type: "CUSTOM_SPRING";
  mass: number;
  stiffness: number;
  damping: number;
}

export type EasingInput = NamedEasingName | CustomCubicBezierEasing | CustomSpringEasing;

export type EasingShape =
  | { type: NamedEasingName }
  | {
      type: "CUSTOM_CUBIC_BEZIER";
      easingFunctionCubicBezier: { x1: number; y1: number; x2: number; y2: number };
    }
  | {
      type: "CUSTOM_SPRING";
      easingFunctionSpring: { mass: number; stiffness: number; damping: number };
    };

export interface SimpleTransitionInput {
  type: SimpleTransitionType;
  duration?: number;       // seconds, default 0.3
  easing?: EasingInput;    // default "EASE_OUT"
}

export type DirectionalTransitionType = WDirectionalTransitionType;

export type Direction = WDirection;

export interface DirectionalTransitionInput {
  type: DirectionalTransitionType;
  direction: Direction;
  matchLayers?: boolean;  // default false
  duration?: number;      // default 0.3
  easing?: EasingInput;   // default EASE_OUT (via resolveEasing)
}

export type TransitionInput = TransitionName | SimpleTransitionInput | DirectionalTransitionInput;
export type TriggerName = WTriggerName;

export type KeyboardDevice = WKeyboardDevice;

export type TriggerInput =
  | TriggerName
  | { type: TriggerNoParamType }
  | { type: "AFTER_TIMEOUT"; timeout: number }
  | { type: MouseClickType; delay?: number }
  | { type: MouseHoverType; delay?: number }
  | { type: "ON_KEY_DOWN"; device: KeyboardDevice; keyCodes: number[] }
  | { type: "ON_MEDIA_HIT"; mediaHitTime: number };

export type TransitionShape =
  | null
  | { type: SimpleTransitionType; duration: number; easing: EasingShape }
  | {
      type: DirectionalTransitionType;
      direction: Direction;
      matchLayers: boolean;
      duration: number;
      easing: EasingShape;
    };

// Figma's Action union: NODE actions cover NAVIGATE/SCROLL_TO/OVERLAY/SWAP navigations.
// CLOSE, BACK, URL are top-level action.types with their own shapes.

export interface ConditionalBlockShape {
  condition?: unknown;        // VariableData; opaque to the builder (plugin builds it)
  actions: BuiltAction[];
}

export type BuiltAction =
  | {
      type: "NODE";
      destinationId: string;
      navigation: "NAVIGATE" | "SCROLL_TO" | "OVERLAY" | "SWAP";
      transition: TransitionShape;
      resetScrollPosition?: boolean;
    }
  | { type: "CLOSE" }
  | { type: "BACK" }
  | { type: "URL"; url: string; openInNewTab: boolean }
  | { type: "CONDITIONAL"; conditionalBlocks: ConditionalBlockShape[] }
  | { type: "SET_VARIABLE"; variableId: string; variableValue: unknown };

export type TriggerShape =
  | { type: TriggerNoParamType }
  | { type: "AFTER_TIMEOUT"; timeout: number }
  | { type: MouseClickType; delay: number }
  | { type: MouseHoverType; delay: number }
  | { type: "ON_KEY_DOWN"; device: KeyboardDevice; keyCodes: number[] }
  | { type: "ON_MEDIA_HIT"; mediaHitTime: number };

export interface BuiltReaction {
  trigger: TriggerShape;
  actions: BuiltAction[];
}

export interface NavigateBuildInput {
  targetFrameId: string;
  trigger: TriggerInput;
  transition: TransitionInput;
  afterTimeoutSeconds?: number;
  resetScrollPosition?: boolean;
}

export interface ScrollBuildInput {
  targetNodeId: string;
  trigger: TriggerInput;
  transition: TransitionInput;
  afterTimeoutSeconds?: number;
  resetScrollPosition?: boolean;
}

export interface OverlayBuildInput {
  targetFrameId: string;
  trigger: TriggerInput;
  transition: TransitionInput;
  afterTimeoutSeconds?: number;
  resetScrollPosition?: boolean;
}

export interface CloseBuildInput {
  trigger: TriggerInput;
  afterTimeoutSeconds?: number;
}

export interface BackBuildInput {
  trigger: TriggerInput;
  afterTimeoutSeconds?: number;
}

export interface UrlBuildInput {
  trigger: TriggerInput;
  url: string;
  openInNewTab?: boolean;
  afterTimeoutSeconds?: number;
}

export interface SwapOverlayBuildInput {
  trigger: TriggerInput;
  transition: TransitionInput;
  targetFrameId: string;
  afterTimeoutSeconds?: number;
  resetScrollPosition?: boolean;
}

export function resolveEasing(input: EasingInput | undefined): EasingShape {
  if (input === undefined) return { type: "EASE_OUT" };
  if (typeof input === "string") return { type: input };
  if (input.type === "CUSTOM_CUBIC_BEZIER") {
    return {
      type: "CUSTOM_CUBIC_BEZIER",
      easingFunctionCubicBezier: { x1: input.x1, y1: input.y1, x2: input.x2, y2: input.y2 },
    };
  }
  // CUSTOM_SPRING — initialVelocity intentionally omitted; see CustomSpringEasing note.
  return {
    type: "CUSTOM_SPRING",
    easingFunctionSpring: {
      mass: input.mass,
      stiffness: input.stiffness,
      damping: input.damping,
    },
  };
}

export function buildTransition(input: TransitionInput): TransitionShape {
  if (input === "INSTANT") return null;

  if (input === "DISSOLVE" || input === "SMART_ANIMATE") {
    return {
      type: input,
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    };
  }

  // Object form — discriminate directional vs simple by type.
  if (
    input.type === "MOVE_IN" || input.type === "MOVE_OUT" ||
    input.type === "PUSH"    || input.type === "SLIDE_IN" ||
    input.type === "SLIDE_OUT"
  ) {
    return {
      type: input.type,
      direction: input.direction,
      matchLayers: input.matchLayers ?? false,
      duration: input.duration ?? 0.3,
      easing: resolveEasing(input.easing),
    };
  }

  // SimpleTransitionInput — resolve defaults.
  return {
    type: input.type,
    duration: input.duration ?? 0.3,
    easing: resolveEasing(input.easing),
  };
}

/** Whether a transition resolves to SMART_ANIMATE (string or object form). */
export function isSmartAnimate(input: TransitionInput): boolean {
  if (input === "SMART_ANIMATE") return true;
  return typeof input !== "string" && input.type === "SMART_ANIMATE";
}

/**
 * Degrade a SMART_ANIMATE transition to a fallback. Used when the source and
 * destination frames share no matching layers, so SMART_ANIMATE has nothing to
 * morph. Non-SMART_ANIMATE input is returned unchanged.
 * - "INSTANT": a hard cut (no duration/easing).
 * - "DISSOLVE": a soft fade, preserving the SMART_ANIMATE duration/easing.
 */
export function degradeTransition(
  input: TransitionInput,
  degradeTo: "DISSOLVE" | "INSTANT",
): TransitionInput {
  if (!isSmartAnimate(input)) return input;
  if (degradeTo === "INSTANT") return "INSTANT";
  if (typeof input === "string") return "DISSOLVE";
  // input is SimpleTransitionInput with type === "SMART_ANIMATE" at this point.
  const obj = input as SimpleTransitionInput;
  return { type: "DISSOLVE", duration: obj.duration, easing: obj.easing };
}

export function buildTrigger(
  input: TriggerInput,
  legacyAfterTimeoutSeconds?: number
): TriggerShape {
  if (typeof input === "string") {
    if (input === "AFTER_TIMEOUT") {
      if (legacyAfterTimeoutSeconds === undefined) {
        throw new Error("buildTrigger: afterTimeoutSeconds is required when name is AFTER_TIMEOUT");
      }
      return { type: "AFTER_TIMEOUT", timeout: legacyAfterTimeoutSeconds };
    }
    return { type: input };
  }
  switch (input.type) {
    case "ON_CLICK":
    case "ON_HOVER":
    case "ON_PRESS":
    case "ON_DRAG":
    case "ON_MEDIA_END":
      return { type: input.type };
    case "AFTER_TIMEOUT":
      return { type: "AFTER_TIMEOUT", timeout: input.timeout };
    case "MOUSE_UP":
    case "MOUSE_DOWN":
      return { type: input.type, delay: input.delay ?? 0 };
    case "MOUSE_ENTER":
    case "MOUSE_LEAVE":
      // Figma's runtime rejects `deprecatedVersion` despite it appearing in
      // the plugin typings — same typings vs runtime mismatch pattern as
      // CustomSpringEasing.initialVelocity. setReactionsAsync returns
      // "Unrecognized key(s) in object: 'deprecatedVersion'".
      return {
        type: input.type,
        delay: input.delay ?? 0,
      };
    case "ON_KEY_DOWN":
      return { type: "ON_KEY_DOWN", device: input.device, keyCodes: input.keyCodes };
    case "ON_MEDIA_HIT":
      return { type: "ON_MEDIA_HIT", mediaHitTime: input.mediaHitTime };
  }
}

export function buildNavigateReaction(input: NavigateBuildInput): BuiltReaction {
  const action: BuiltAction = {
    type: "NODE",
    destinationId: input.targetFrameId,
    navigation: "NAVIGATE",
    transition: buildTransition(input.transition),
    ...(input.resetScrollPosition !== undefined && { resetScrollPosition: input.resetScrollPosition }),
  };
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [action],
  };
}

export function buildScrollReaction(input: ScrollBuildInput): BuiltReaction {
  const action: BuiltAction = {
    type: "NODE",
    destinationId: input.targetNodeId,
    navigation: "SCROLL_TO",
    transition: buildTransition(input.transition),
    ...(input.resetScrollPosition !== undefined && { resetScrollPosition: input.resetScrollPosition }),
  };
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [action],
  };
}

export function buildOverlayReaction(input: OverlayBuildInput): BuiltReaction {
  const action: BuiltAction = {
    type: "NODE",
    destinationId: input.targetFrameId,
    navigation: "OVERLAY",
    transition: buildTransition(input.transition),
    ...(input.resetScrollPosition !== undefined && { resetScrollPosition: input.resetScrollPosition }),
  };
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [action],
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
  const action: BuiltAction = {
    type: "NODE",
    destinationId: input.targetFrameId,
    navigation: "SWAP",
    transition: buildTransition(input.transition),
    ...(input.resetScrollPosition !== undefined && { resetScrollPosition: input.resetScrollPosition }),
  };
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [action],
  };
}

export interface ConditionalBuildInput {
  trigger: TriggerInput;
  afterTimeoutSeconds?: number;
  condition: unknown;             // VariableData; constructed by the plugin
  thenActions: BuiltAction[];
  elseActions?: BuiltAction[];
}

export function buildConditionalReaction(input: ConditionalBuildInput): BuiltReaction {
  const blocks: ConditionalBlockShape[] = [
    { condition: input.condition, actions: input.thenActions },
  ];
  if (input.elseActions && input.elseActions.length > 0) {
    blocks.push({ actions: input.elseActions });
  }
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [{ type: "CONDITIONAL", conditionalBlocks: blocks }],
  };
}

export interface SetVariableBuildInput {
  trigger: TriggerInput;
  afterTimeoutSeconds?: number;
  variableId: string;
  variableValue: unknown;       // VariableData; constructed by the plugin
}

export function buildSetVariableReaction(input: SetVariableBuildInput): BuiltReaction {
  return {
    trigger: buildTrigger(input.trigger, input.afterTimeoutSeconds),
    actions: [{
      type: "SET_VARIABLE",
      variableId: input.variableId,
      variableValue: input.variableValue,
    }],
  };
}
