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

export type ProtoWireInput = z.infer<typeof ProtoWireInput>;
export type ProtoOverlayInput = z.infer<typeof ProtoOverlayInput>;
export type ProtoScrollInput = z.infer<typeof ProtoScrollInput>;

export const ProtoGetLastHistoryInput = z.object({
  count: z.number().int().min(1).max(10).default(1),
});

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
