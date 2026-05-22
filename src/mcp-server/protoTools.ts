import { z } from "zod";
import { TriggerInput, TransitionInput } from "./tools.js";
import { PRESET_NAMES, resolveMotion } from "../shared/motionPresets.js";
import type { MotionInput } from "../shared/motionPresets.js";
import type { CreateReactionsInput as CreateReactionsInputType } from "./tools.js";

const PresetNameEnum = z.enum(PRESET_NAMES);
const MotionInputSchema = z.union([PresetNameEnum, TransitionInput]);

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

const ProtoSetVariableEntry = z.object({
  from: z.string().min(1),
  variable: z.string().min(1),
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
  trigger: TriggerInput.optional(),
}).strict();

export const ProtoToggleVariableInput = z.object({
  toggles: z.array(ProtoToggleVariableEntry).min(1),
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
