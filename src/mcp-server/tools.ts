import { z } from "zod";

export const GetCanvasOverviewInput = z.object({
  pageId: z.string().optional(),
});

export const FindNodesInput = z.object({
  query: z.string().min(1),
  nodeTypes: z.array(z.string()).optional(),
  scope: z.enum(["page", "document"]).default("page"),
  limit: z.number().int().positive().max(500).default(50),
});

const TriggerEnum = z.enum(["ON_CLICK", "ON_HOVER", "ON_PRESS", "AFTER_TIMEOUT"]);
const TransitionEnum = z.enum(["INSTANT", "DISSOLVE", "SMART_ANIMATE"]);

const NamedEasingEnum = z.enum([
  "LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT",
  "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK",
  "GENTLE", "QUICK", "BOUNCY", "SLOW",
]);

const CustomCubicBezierEasing = z.object({
  type: z.literal("CUSTOM_CUBIC_BEZIER"),
  x1: z.number().min(0).max(1),
  y1: z.number(),
  x2: z.number().min(0).max(1),
  y2: z.number(),
});

const CustomSpringEasing = z.object({
  type: z.literal("CUSTOM_SPRING"),
  mass: z.number().positive(),
  stiffness: z.number().positive(),
  damping: z.number().positive(),
  initialVelocity: z.number(),
});

const EasingInputUnion = z.union([NamedEasingEnum, CustomCubicBezierEasing, CustomSpringEasing]);

const SimpleTransitionObject = z.object({
  type: z.enum(["DISSOLVE", "SMART_ANIMATE", "SCROLL_ANIMATE"]),
  duration: z.number().positive().max(10).optional(),
  easing: EasingInputUnion.optional(),
});

const TransitionInput = z.union([TransitionEnum, SimpleTransitionObject]);

const NavigateActionInput = z.object({
  type: z.literal("navigate"),
  targetFrameId: z.string().min(1),
});

const ScrollActionInput = z.object({
  type: z.literal("scroll"),
  targetNodeId: z.string().min(1),
});

const OverlayActionInput = z.object({
  type: z.literal("overlay"),
  targetFrameId: z.string().min(1),
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
});

const ActionInput = z.discriminatedUnion("type", [
  NavigateActionInput,
  ScrollActionInput,
  OverlayActionInput,
  CloseActionInput,
  BackActionInput,
  UrlActionInput,
  SwapOverlayActionInput,
]);

const ConnectionInput = z.object({
  sourceNodeId: z.string().min(1),
  trigger: TriggerEnum.default("ON_CLICK"),
  afterTimeoutSeconds: z.number().positive().optional(),
  transition: TransitionInput.default("INSTANT"),
  action: ActionInput,
}).refine(
  (v) => v.trigger !== "AFTER_TIMEOUT" || typeof v.afterTimeoutSeconds === "number",
  { message: "afterTimeoutSeconds is required when trigger is AFTER_TIMEOUT" }
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

export type GetCanvasOverviewInput = z.infer<typeof GetCanvasOverviewInput>;
export type FindNodesInput = z.infer<typeof FindNodesInput>;
export type CreateReactionsInput = z.infer<typeof CreateReactionsInput>;
export type ListReactionsInput = z.infer<typeof ListReactionsInput>;
export type ClearReactionsInput = z.infer<typeof ClearReactionsInput>;
