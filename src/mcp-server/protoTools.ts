import { z } from "zod";
import { TriggerInput, TransitionInput } from "./tools.js";
import { PRESET_NAMES } from "../shared/motionPresets.js";

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

import { resolveMotion } from "../shared/motionPresets.js";
import type { CreateReactionsInput as CreateReactionsInputType } from "./tools.js";

type Connection = CreateReactionsInputType["connections"][number];

const DEFAULT_TRIGGER = "ON_CLICK" as const;

function buildConnection(
  from: string,
  triggerArg: Connection["trigger"] | undefined,
  motionArg: unknown,
  action: Connection["action"],
): Connection {
  return {
    sourceNodeId: from,
    trigger: triggerArg ?? DEFAULT_TRIGGER,
    transition: resolveMotion(motionArg as Parameters<typeof resolveMotion>[0]),
    action,
  };
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
    return buildConnection(o.from, o.trigger, o.motion, action);
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
