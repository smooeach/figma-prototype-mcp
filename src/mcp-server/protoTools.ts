import { z } from "zod";
import { TriggerInput, TransitionInput } from "./tools.js";
import { PRESET_NAMES, resolveMotion } from "../shared/motionPresets.js";
import type { MotionInput } from "../shared/motionPresets.js";
import { COMPARISON_OPERATORS } from "../shared/wire-vocabulary.js";
import type { CreateReactionsInput as CreateReactionsInputType } from "./tools.js";

const PresetNameEnum = z.enum(PRESET_NAMES);
const MotionInputSchema = z.union([PresetNameEnum, TransitionInput]).describe(
  "How it animates: a preset name OR a full TransitionInput. Natural-language → preset (KO/EN): " +
    "부드럽게/자연스럽게/smooth → M3_STANDARD; 강조/묵직/emphasized → M3_EMPHASIZED (default); " +
    "튀는/통통/스프링/bouncy → HIG_BOUNCY; 빠르게/스냅/snappy → HIG_SNAPPY; 느리게/여유/slow → HIG_SMOOTH; " +
    "iOS/애플 → HIG_DEFAULT; Material/안드로이드 → M3_*. " +
    "All 10 presets are SMART_ANIMATE (morph). A directional feel (옆으로/슬라이드/다음으로/넘기듯/push,slide) " +
    "or a fade (서서히/흐려지며/fade) is NOT a preset — pass a TransitionInput instead: " +
    "{type:'PUSH'|'SLIDE_IN'|'SLIDE_OUT', direction} or {type:'DISSOLVE'}. " +
    "Duration cues (for a custom TransitionInput, not presets): 빠르게≈0.1–0.15s, 보통≈0.15s, 부드럽게≈0.25s, 느리게≈0.4s. " +
    "Full vocabulary: docs/dictionaries/.",
);

const ProtoWireEntry = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  trigger: TriggerInput.optional(),
  motion: MotionInputSchema.optional(),
  resetScrollPosition: z.boolean().optional(),
});

export const ProtoWireInput = z.object({
  wires: z.array(ProtoWireEntry).min(1),
  replaceExisting: z.boolean().default(false),
});

const ProtoOverlayOpenEntry = z.object({
  mode: z.literal("open"),
  from: z.string().min(1),
  overlay: z.string().min(1),
  trigger: TriggerInput.optional(),
  motion: MotionInputSchema.optional(),
}).strict();

const ProtoOverlaySwapEntry = z.object({
  mode: z.literal("swap"),
  from: z.string().min(1),
  overlay: z.string().min(1),
  trigger: TriggerInput.optional(),
  motion: MotionInputSchema.optional(),
}).strict();

const ProtoOverlayCloseEntry = z.object({
  mode: z.literal("close"),
  from: z.string().min(1),
  trigger: TriggerInput.optional(),
  motion: MotionInputSchema.optional(),
}).strict();

const ProtoOverlayEntry = z.discriminatedUnion("mode", [
  ProtoOverlayOpenEntry,
  ProtoOverlaySwapEntry,
  ProtoOverlayCloseEntry,
]);

export const ProtoOverlayInput = z.object({
  overlays: z.array(ProtoOverlayEntry).min(1),
  replaceExisting: z.boolean().default(false),
});

const ProtoScrollEntry = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  trigger: TriggerInput.optional(),
  motion: MotionInputSchema.optional(),
  resetScrollPosition: z.boolean().optional(),
});

export const ProtoScrollInput = z.object({
  scrolls: z.array(ProtoScrollEntry).min(1),
  replaceExisting: z.boolean().default(false),
});

// Non-strict to match ProtoWireEntry / ProtoScrollEntry pattern (v1.20 convention).
// ProtoUrlEntry below is .strict() because it specifically enforces no-motion.
const ProtoBackEntry = z.object({
  from: z.string().min(1),
  trigger: TriggerInput.optional(),
  motion: MotionInputSchema.optional(),
});

export const ProtoBackInput = z.object({
  backs: z.array(ProtoBackEntry).min(1),
  replaceExisting: z.boolean().default(false),
});

const ProtoUrlEntry = z.object({
  from: z.string().min(1),
  url: z.string().min(1),
  openInNewTab: z.boolean().optional(),
  trigger: TriggerInput.optional(),
}).strict();

export const ProtoUrlInput = z.object({
  urls: z.array(ProtoUrlEntry).min(1),
  replaceExisting: z.boolean().default(false),
});

const COLLECTION_FIELD = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Only needed when the same variable name exists in multiple collections. " +
      "Use list_variables to find the collection name and pass it here. " +
      "Omitting it on a collision returns an error.",
  );

const ProtoSetVariableEntry = z.object({
  from: z.string().min(1),
  variable: z.string().min(1),
  collection: COLLECTION_FIELD,
  value: z.union([z.boolean(), z.number(), z.string()]),
  trigger: TriggerInput.optional(),
}).strict();

export const ProtoSetVariableInput = z.object({
  sets: z.array(ProtoSetVariableEntry).min(1),
  replaceExisting: z.boolean().default(false),
});

const ProtoToggleVariableEntry = z.object({
  from: z.string().min(1),
  variable: z.string().min(1),
  collection: COLLECTION_FIELD,
  trigger: TriggerInput.optional(),
}).strict();

export const ProtoToggleVariableInput = z.object({
  toggles: z.array(ProtoToggleVariableEntry).min(1),
  replaceExisting: z.boolean().default(false),
});

const ComparisonOperator = z.enum(COMPARISON_OPERATORS);

const ProtoConditionIf = z.object({
  variable: z.string().min(1),
  collection: COLLECTION_FIELD,
  operator: ComparisonOperator.default("=="),
  value: z.union([z.boolean(), z.number(), z.string()]),
}).strict();

const BranchNavigate = z.object({
  navigate: z.string().min(1),
  resetScrollPosition: z.boolean().optional(),
}).strict();

const BranchScroll = z.object({
  scroll: z.string().min(1),
  resetScrollPosition: z.boolean().optional(),
}).strict();

const BranchOverlay = z.object({
  overlay: z.string().min(1),
}).strict();

const BranchSwap = z.object({
  swap: z.string().min(1),
}).strict();

const BranchClose = z.object({
  close: z.literal(true),
}).strict();

const BranchBack = z.object({
  back: z.literal(true),
}).strict();

const BranchUrl = z.object({
  url: z.string().min(1),
  openInNewTab: z.boolean().optional(),
}).strict();

const BranchSet = z.object({
  set: z.object({
    variable: z.string().min(1),
    collection: COLLECTION_FIELD,
    value: z.union([z.boolean(), z.number(), z.string()]),
  }).strict(),
}).strict();

const BranchAction = z.union([
  BranchNavigate, BranchScroll, BranchOverlay, BranchSwap,
  BranchClose, BranchBack, BranchUrl, BranchSet,
]);

const ProtoConditionalEntry = z.object({
  from: z.string().min(1),
  trigger: TriggerInput.optional(),
  motion: MotionInputSchema.optional(),
  if: ProtoConditionIf,
  then: BranchAction,
  else: BranchAction.optional(),
}).strict();

export const ProtoConditionalInput = z.object({
  conditions: z.array(ProtoConditionalEntry).min(1),
  replaceExisting: z.boolean().default(false),
});

export const ProtoGetLastHistoryInput = z.object({
  count: z.number().int().min(1).max(10).default(1),
});

export type ProtoWireInput = z.infer<typeof ProtoWireInput>;
export type ProtoOverlayInput = z.infer<typeof ProtoOverlayInput>;
export type ProtoScrollInput = z.infer<typeof ProtoScrollInput>;
export type ProtoBackInput = z.infer<typeof ProtoBackInput>;
export type ProtoUrlInput = z.infer<typeof ProtoUrlInput>;
export type ProtoSetVariableInput = z.infer<typeof ProtoSetVariableInput>;
export type ProtoToggleVariableInput = z.infer<typeof ProtoToggleVariableInput>;
export type ProtoConditionalInput = z.infer<typeof ProtoConditionalInput>;
export type ProtoGetLastHistoryInput = z.infer<typeof ProtoGetLastHistoryInput>;

type Connection = CreateReactionsInputType["connections"][number];

const DEFAULT_TRIGGER = "ON_CLICK" as const;

function buildConnection(
  from: string,
  triggerArg: Connection["trigger"] | undefined,
  motionArg: MotionInput | undefined,
  action: Connection["action"],
  transformTransition?: (t: Connection["transition"]) => Connection["transition"],
): Connection {
  const baseTransition = resolveMotion(motionArg);
  return {
    sourceNodeId: from,
    trigger: triggerArg ?? DEFAULT_TRIGGER,
    transition: transformTransition ? transformTransition(baseTransition) : baseTransition,
    action,
  };
}

// Figma's runtime rejects SMART_ANIMATE transitions on OVERLAY/SWAP/CLOSE navigation
// actions (the UI also hides Smart Animate from the overlay transition dropdown).
// Rewrite to DISSOLVE preserving duration/easing so the designer's motion intent
// (e.g. M3 emphasized curve, HIG snappy spring) is preserved within Figma's overlay
// transition constraint. Verified live 2026-05-22 via diag-overlay probe.
function rewriteForOverlay(t: Connection["transition"]): Connection["transition"] {
  if (t === "SMART_ANIMATE") return "DISSOLVE";
  if (typeof t !== "string" && t.type === "SMART_ANIMATE") {
    return { ...t, type: "DISSOLVE" };
  }
  return t;
}

export function compileProtoWire(input: ProtoWireInput): CreateReactionsInputType {
  const connections: Connection[] = input.wires.map((w) => {
    const action: Connection["action"] = w.resetScrollPosition === undefined
      ? { type: "navigate", targetFrameId: w.to }
      : { type: "navigate", targetFrameId: w.to, resetScrollPosition: w.resetScrollPosition };
    return buildConnection(w.from, w.trigger, w.motion, action);
  });
  return { connections, replaceExisting: input.replaceExisting };
}

export function compileProtoOverlay(input: ProtoOverlayInput): CreateReactionsInputType {
  const connections: Connection[] = input.overlays.map((o) => {
    let action: Connection["action"];
    if (o.mode === "open") {
      action = { type: "overlay", targetFrameId: o.overlay };
    } else if (o.mode === "swap") {
      action = { type: "swap_overlay", targetFrameId: o.overlay };
    } else {
      action = { type: "close" };
    }
    return buildConnection(o.from, o.trigger, o.motion, action, rewriteForOverlay);
  });
  return { connections, replaceExisting: input.replaceExisting };
}

export function compileProtoScroll(input: ProtoScrollInput): CreateReactionsInputType {
  const connections: Connection[] = input.scrolls.map((s) => {
    const action: Connection["action"] = s.resetScrollPosition === undefined
      ? { type: "scroll", targetNodeId: s.to }
      : { type: "scroll", targetNodeId: s.to, resetScrollPosition: s.resetScrollPosition };
    return buildConnection(s.from, s.trigger, s.motion, action);
  });
  return { connections, replaceExisting: input.replaceExisting };
}

export function compileProtoBack(input: ProtoBackInput): CreateReactionsInputType {
  const connections: Connection[] = input.backs.map((b) => {
    const action: Connection["action"] = { type: "back" };
    return buildConnection(b.from, b.trigger, b.motion, action);
  });
  return { connections, replaceExisting: input.replaceExisting };
}

export function compileProtoUrl(input: ProtoUrlInput): CreateReactionsInputType {
  const connections: Connection[] = input.urls.map((u) => {
    const action: Connection["action"] = {
      type: "url",
      url: u.url,
      openInNewTab: u.openInNewTab ?? false,
    };
    // Deliberately do NOT set `transition` — let create_reactions zod default it to "INSTANT".
    // The Connection type requires `transition` (post-parse), but we're returning the PRE-parse
    // shape that create_reactions consumes, where `transition: TransitionInput.default("INSTANT")`.
    return {
      sourceNodeId: u.from,
      trigger: u.trigger ?? DEFAULT_TRIGGER,
      action,
    } as Connection;
  });
  return { connections, replaceExisting: input.replaceExisting };
}

export function compileProtoSetVariable(input: ProtoSetVariableInput): CreateReactionsInputType {
  const connections: Connection[] = input.sets.map((s) => {
    const action: Connection["action"] = {
      type: "set_variable",
      variable: s.variable,
      ...(s.collection !== undefined && { collection: s.collection }),
      value: s.value,
    };
    // No `transition` — create_reactions zod schema defaults it to "INSTANT".
    return {
      sourceNodeId: s.from,
      trigger: s.trigger ?? DEFAULT_TRIGGER,
      action,
    } as Connection;
  });
  return { connections, replaceExisting: input.replaceExisting };
}

export function compileProtoToggleVariable(input: ProtoToggleVariableInput): CreateReactionsInputType {
  const connections: Connection[] = input.toggles.map((t) => {
    const action: Connection["action"] = {
      type: "toggle_variable",
      variable: t.variable,
      ...(t.collection !== undefined && { collection: t.collection }),
    };
    return {
      sourceNodeId: t.from,
      trigger: t.trigger ?? DEFAULT_TRIGGER,
      action,
    } as Connection;
  });
  return { connections, replaceExisting: input.replaceExisting };
}

type NonConditionalAction = Extract<
  Connection["action"],
  { type: "navigate" | "scroll" | "overlay" | "close" | "back" | "url" | "swap_overlay" | "set_variable" }
>;

function compileBranchAction(b: z.infer<typeof BranchAction>): NonConditionalAction {
  if ("navigate" in b) {
    return b.resetScrollPosition === undefined
      ? { type: "navigate", targetFrameId: b.navigate }
      : { type: "navigate", targetFrameId: b.navigate, resetScrollPosition: b.resetScrollPosition };
  }
  if ("scroll" in b) {
    return b.resetScrollPosition === undefined
      ? { type: "scroll", targetNodeId: b.scroll }
      : { type: "scroll", targetNodeId: b.scroll, resetScrollPosition: b.resetScrollPosition };
  }
  if ("overlay" in b) return { type: "overlay", targetFrameId: b.overlay };
  if ("swap" in b)    return { type: "swap_overlay", targetFrameId: b.swap };
  if ("close" in b)   return { type: "close" };
  if ("back" in b)    return { type: "back" };
  if ("url" in b)     return { type: "url", url: b.url, openInNewTab: b.openInNewTab ?? false };
  if ("set" in b)     return {
    type: "set_variable",
    variable: b.set.variable,
    ...(b.set.collection !== undefined && { collection: b.set.collection }),
    value: b.set.value,
  };
  throw new Error("unreachable: zod parse guarantees BranchAction coverage");
}

function branchUsesOverlayOrSwap(b: z.infer<typeof BranchAction>): boolean {
  return "overlay" in b || "swap" in b;
}

export function compileProtoConditional(input: ProtoConditionalInput): CreateReactionsInputType {
  const connections: Connection[] = input.conditions.map((c) => {
    const baseTransition = resolveMotion(c.motion);
    const needsOverlayRewrite =
      branchUsesOverlayOrSwap(c.then) ||
      (c.else !== undefined && branchUsesOverlayOrSwap(c.else));
    const transition = needsOverlayRewrite ? rewriteForOverlay(baseTransition) : baseTransition;

    const action: Connection["action"] = {
      type: "conditional",
      condition: {
        variable: c.if.variable,
        ...(c.if.collection !== undefined && { collection: c.if.collection }),
        operator: c.if.operator,        // zod already applied default "=="
        value: c.if.value,
      },
      then: [compileBranchAction(c.then)],
      ...(c.else !== undefined && { else: [compileBranchAction(c.else)] }),
    };

    return {
      sourceNodeId: c.from,
      trigger: c.trigger ?? DEFAULT_TRIGGER,
      transition,
      action,
    } as Connection;
  });
  return { connections, replaceExisting: input.replaceExisting };
}
