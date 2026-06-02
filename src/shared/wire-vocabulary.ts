// Single source of truth for the string-literal vocabularies that cross the
// WebSocket wire between the MCP server (zod input schemas) and the Figma plugin
// (TS input types). Pure: no figma.*, no Node, no zod — so it bundles into the
// plugin sandbox and stays unit-testable. The server derives `z.enum(<CONST>)`
// from these; the plugin derives `type X = typeof <CONST>[number]`.

// --- Triggers ---
// Triggers expressible as a bare string shorthand (no params) at the API surface.
// Not the full Figma trigger surface — ON_DRAG / ON_MEDIA_END / ON_KEY_DOWN /
// ON_MEDIA_HIT require the object form and appear in the other trigger consts.
export const TRIGGER_SHORTCUTS = ["ON_CLICK", "ON_HOVER", "ON_PRESS", "AFTER_TIMEOUT"] as const;
export type TriggerName = (typeof TRIGGER_SHORTCUTS)[number];

export const TRIGGER_NOPARAM_TYPES = ["ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG", "ON_MEDIA_END"] as const;
export type TriggerNoParamType = (typeof TRIGGER_NOPARAM_TYPES)[number];

export const MOUSE_CLICK_TYPES = ["MOUSE_UP", "MOUSE_DOWN"] as const;
export type MouseClickType = (typeof MOUSE_CLICK_TYPES)[number];

export const MOUSE_HOVER_TYPES = ["MOUSE_ENTER", "MOUSE_LEAVE"] as const;
export type MouseHoverType = (typeof MOUSE_HOVER_TYPES)[number];

export const KEYBOARD_DEVICES = ["KEYBOARD", "XBOX_ONE", "PS4", "SWITCH_PRO", "UNKNOWN_CONTROLLER"] as const;
export type KeyboardDevice = (typeof KEYBOARD_DEVICES)[number];

// --- Transitions ---
export const TRANSITION_SHORTCUTS = ["INSTANT", "DISSOLVE", "SMART_ANIMATE"] as const;
export type TransitionName = (typeof TRANSITION_SHORTCUTS)[number];

// Wire-shape transition discriminants. INSTANT is intentionally absent: it
// resolves to `null` on the wire (no transition object), so it lives only in
// TRANSITION_SHORTCUTS, not here.
export const SIMPLE_TRANSITION_TYPES = ["DISSOLVE", "SMART_ANIMATE", "SCROLL_ANIMATE"] as const;
export type SimpleTransitionType = (typeof SIMPLE_TRANSITION_TYPES)[number];

export const DIRECTIONAL_TRANSITION_TYPES = ["MOVE_IN", "MOVE_OUT", "PUSH", "SLIDE_IN", "SLIDE_OUT"] as const;
export type DirectionalTransitionType = (typeof DIRECTIONAL_TRANSITION_TYPES)[number];

export const NAMED_EASINGS = [
  "LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT",
  "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK",
  "GENTLE", "QUICK", "BOUNCY", "SLOW",
] as const;
export type NamedEasingName = (typeof NAMED_EASINGS)[number];

export const DIRECTIONS = ["LEFT", "RIGHT", "TOP", "BOTTOM"] as const;
export type Direction = (typeof DIRECTIONS)[number];

// --- Other ---
export const COMPARISON_OPERATORS = ["==", "!=", "<", "<=", ">", ">="] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export const OVERFLOW_DIRECTIONS = ["NONE", "HORIZONTAL", "VERTICAL", "BOTH"] as const;
export type OverflowDirection = (typeof OVERFLOW_DIRECTIONS)[number];
