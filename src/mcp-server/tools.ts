import { z } from "zod";
import {
  TRIGGER_SHORTCUTS,
  TRIGGER_NOPARAM_TYPES,
  MOUSE_CLICK_TYPES,
  MOUSE_HOVER_TYPES,
  KEYBOARD_DEVICES,
  TRANSITION_SHORTCUTS,
  SIMPLE_TRANSITION_TYPES,
  DIRECTIONAL_TRANSITION_TYPES,
  NAMED_EASINGS,
  DIRECTIONS,
  COMPARISON_OPERATORS,
  OVERFLOW_DIRECTIONS,
} from "../shared/wire-vocabulary.js";

export const GetCanvasOverviewInput = z.object({
  pageId: z.string().optional(),
});

export const FindNodesInput = z.object({
  query: z.string().min(1),
  nodeTypes: z.array(z.string()).optional(),
  scope: z.enum(["page", "document"]).default("page"),
  limit: z.number().int().positive().max(500).default(50),
});

const TriggerEnum = z.enum(TRIGGER_SHORTCUTS);

const KeyboardDeviceEnum = z.enum(KEYBOARD_DEVICES);

const TriggerObjectNoParam = z.object({
  type: z.enum(TRIGGER_NOPARAM_TYPES),
});
const TriggerObjectAfterTimeout = z.object({
  type: z.literal("AFTER_TIMEOUT"),
  timeout: z.number().positive().max(60),
});
const TriggerObjectMouseClick = z.object({
  type: z.enum(MOUSE_CLICK_TYPES),
  delay: z.number().nonnegative().max(60).optional(),
});
// Figma's runtime rejects `deprecatedVersion` despite the typings declaring it
// required — same typings vs runtime pattern as CustomSpringEasing.initialVelocity.
// Omit from input.
const TriggerObjectMouseHover = z.object({
  type: z.enum(MOUSE_HOVER_TYPES),
  delay: z.number().nonnegative().max(60).optional(),
});
const TriggerObjectKeyDown = z.object({
  type: z.literal("ON_KEY_DOWN"),
  device: KeyboardDeviceEnum,
  keyCodes: z.array(z.number().int().nonnegative()).min(1),
});
const TriggerObjectMediaHit = z.object({
  type: z.literal("ON_MEDIA_HIT"),
  mediaHitTime: z.number().nonnegative(),
});

export const TriggerInput = z.union([
  TriggerEnum,
  TriggerObjectNoParam,
  TriggerObjectAfterTimeout,
  TriggerObjectMouseClick,
  TriggerObjectMouseHover,
  TriggerObjectKeyDown,
  TriggerObjectMediaHit,
]);

const TransitionEnum = z.enum(TRANSITION_SHORTCUTS);

const NamedEasingEnum = z.enum(NAMED_EASINGS);

const CustomCubicBezierEasing = z.object({
  type: z.literal("CUSTOM_CUBIC_BEZIER"),
  x1: z.number().min(0).max(1),
  y1: z.number(),
  x2: z.number().min(0).max(1),
  y2: z.number(),
});

// Figma's runtime rejects initialVelocity even though it's in plugin-api.d.ts
// (typings vs runtime mismatch confirmed via live setReactionsAsync). Omit.
const CustomSpringEasing = z.object({
  type: z.literal("CUSTOM_SPRING"),
  mass: z.number().positive(),
  stiffness: z.number().positive(),
  damping: z.number().positive(),
});

const EasingInputUnion = z.union([NamedEasingEnum, CustomCubicBezierEasing, CustomSpringEasing]);

const SimpleTransitionObject = z.object({
  type: z.enum(SIMPLE_TRANSITION_TYPES),
  duration: z.number().positive().max(10).optional(),
  easing: EasingInputUnion.optional(),
});

const DirectionEnum = z.enum(DIRECTIONS);
const DirectionalTransitionObject = z.object({
  type: z.enum(DIRECTIONAL_TRANSITION_TYPES),
  direction: DirectionEnum,
  matchLayers: z.boolean().optional(),
  duration: z.number().positive().max(10).optional(),
  easing: EasingInputUnion.optional(),
});

export const TransitionInput = z.union([TransitionEnum, SimpleTransitionObject, DirectionalTransitionObject]);

const NavigateActionInput = z.object({
  type: z.literal("navigate"),
  targetFrameId: z.string().min(1),
  resetScrollPosition: z.boolean().optional(),
});

const ScrollActionInput = z.object({
  type: z.literal("scroll"),
  targetNodeId: z.string().min(1),
  resetScrollPosition: z.boolean().optional(),
});

const OverlayActionInput = z.object({
  type: z.literal("overlay"),
  targetFrameId: z.string().min(1),
  resetScrollPosition: z.boolean().optional(),
});

const CloseActionInput = z.object({
  type: z.literal("close"),
});

const BackActionInput = z.object({
  type: z.literal("back"),
});

const UrlActionInput = z.object({
  type: z.literal("url"),
  url: z.string().min(1),
  openInNewTab: z.boolean().optional(),
});

const SwapOverlayActionInput = z.object({
  type: z.literal("swap_overlay"),
  targetFrameId: z.string().min(1),
  resetScrollPosition: z.boolean().optional(),
});

const ComparisonOperator = z.enum(COMPARISON_OPERATORS);

const ConditionInput = z.object({
  variable: z.string().min(1),
  operator: ComparisonOperator,
  value: z.union([z.boolean(), z.number(), z.string()]),
});

const SetVariableActionInput = z.object({
  type: z.literal("set_variable"),
  variable: z.string().min(1),
  value: z.union([z.boolean(), z.number(), z.string()]),
});

const ToggleVariableActionInput = z.object({
  type: z.literal("toggle_variable"),
  variable: z.string().min(1),
});

// The set of action types that may appear inside a conditional then/else branch.
// Deliberately excludes ConditionalActionInput to block nesting.
// Deliberately excludes ToggleVariableActionInput — toggle_variable may not appear inside conditionals.
const NonConditionalActionInput = z.discriminatedUnion("type", [
  NavigateActionInput,
  ScrollActionInput,
  OverlayActionInput,
  CloseActionInput,
  BackActionInput,
  UrlActionInput,
  SwapOverlayActionInput,
  SetVariableActionInput,
]);

const ConditionalActionInput = z.object({
  type: z.literal("conditional"),
  condition: ConditionInput,
  then: z.array(NonConditionalActionInput).min(1),
  else: z.array(NonConditionalActionInput).min(1).optional(),
});

const ActionInput = z.discriminatedUnion("type", [
  NavigateActionInput,
  ScrollActionInput,
  OverlayActionInput,
  CloseActionInput,
  BackActionInput,
  UrlActionInput,
  SwapOverlayActionInput,
  ConditionalActionInput,
  SetVariableActionInput,
  ToggleVariableActionInput,
]);

const ConnectionInput = z.object({
  sourceNodeId: z.string().min(1),
  trigger: TriggerInput.default("ON_CLICK"),
  afterTimeoutSeconds: z.number().positive().optional(),
  transition: TransitionInput.default("INSTANT"),
  action: ActionInput,
}).refine(
  (v) => v.trigger !== "AFTER_TIMEOUT" || typeof v.afterTimeoutSeconds === "number",
  { message: "afterTimeoutSeconds is required when trigger is the string \"AFTER_TIMEOUT\" (object form uses { type: \"AFTER_TIMEOUT\", timeout })" }
);

export const CreateReactionsInput = z.object({
  connections: z.array(ConnectionInput).min(1),
  replaceExisting: z.boolean().default(false),
});

export const ListReactionsInput = z.object({
  nodeId: z.string().min(1),
});

export const ClearReactionsInput = z
  .object({
    nodeIds: z.array(z.string().min(1)).min(1),
    indices: z.array(z.number().int().nonnegative()).optional(),
  })
  .refine(
    (v) => !v.indices || v.nodeIds.length === 1,
    { message: "indices may only be specified when nodeIds has exactly 1 entry" }
  );

const OverflowDirectionEnum = z.enum(OVERFLOW_DIRECTIONS);

const SetFrameScrollEntry = z
  .object({
    frameId: z.string().min(1),
    direction: OverflowDirectionEnum.optional(),
    fixedChildren: z.number().int().min(0).optional(),
  })
  .refine(
    (v) => v.direction !== undefined || v.fixedChildren !== undefined,
    { message: "Each entry must include at least one of `direction` or `fixedChildren`" }
  );

export const SetFrameScrollInput = z.object({
  frames: z.array(SetFrameScrollEntry).min(1),
});

export type GetCanvasOverviewInput = z.infer<typeof GetCanvasOverviewInput>;
export type FindNodesInput = z.infer<typeof FindNodesInput>;
export type CreateReactionsInput = z.infer<typeof CreateReactionsInput>;
export type ListReactionsInput = z.infer<typeof ListReactionsInput>;
export type ClearReactionsInput = z.infer<typeof ClearReactionsInput>;
export type SetFrameScrollInput = z.infer<typeof SetFrameScrollInput>;
export type NonConditionalActionInput = z.infer<typeof NonConditionalActionInput>;
export type TriggerInput = z.infer<typeof TriggerInput>;
export type TransitionInput = z.infer<typeof TransitionInput>;
