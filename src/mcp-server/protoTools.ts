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
