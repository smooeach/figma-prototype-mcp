import type { TransitionInput } from "../mcp-server/tools.js";

export const PRESET_NAMES = [
  "M3_EMPHASIZED",
  "M3_EMPHASIZED_DECELERATE",
  "M3_EMPHASIZED_ACCELERATE",
  "M3_STANDARD",
  "M3_STANDARD_DECELERATE",
  "M3_STANDARD_ACCELERATE",
] as const;

export type PresetName = (typeof PRESET_NAMES)[number];

const PRESETS: Record<PresetName, TransitionInput> = {
  M3_EMPHASIZED: {
    type: "SMART_ANIMATE",
    duration: 0.5,
    easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 },
  },
  M3_EMPHASIZED_DECELERATE: {
    type: "SMART_ANIMATE",
    duration: 0.4,
    easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.05, y1: 0.7, x2: 0.1, y2: 1 },
  },
  M3_EMPHASIZED_ACCELERATE: {
    type: "SMART_ANIMATE",
    duration: 0.2,
    easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.3, y1: 0, x2: 0.8, y2: 0.15 },
  },
  M3_STANDARD: {
    type: "SMART_ANIMATE",
    duration: 0.3,
    easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 },
  },
  M3_STANDARD_DECELERATE: {
    type: "SMART_ANIMATE",
    duration: 0.25,
    easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0, y1: 0, x2: 0, y2: 1 },
  },
  M3_STANDARD_ACCELERATE: {
    type: "SMART_ANIMATE",
    duration: 0.2,
    easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.3, y1: 0, x2: 1, y2: 1 },
  },
};

export function isPresetName(s: string): s is PresetName {
  return (PRESET_NAMES as readonly string[]).includes(s);
}

export type MotionInput = PresetName | TransitionInput;

export function resolveMotion(m: MotionInput | undefined): TransitionInput {
  if (m === undefined) return PRESETS["M3_EMPHASIZED"];
  if (typeof m === "string") {
    if (isPresetName(m)) return PRESETS[m];
    throw new Error(`Unknown motion preset: ${m}`);
  }
  return m;
}
