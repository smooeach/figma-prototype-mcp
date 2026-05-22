import { describe, it, expect } from "vitest";
import { resolveMotion, PRESET_NAMES } from "../src/shared/motionPresets.js";
import { TransitionInput } from "../src/mcp-server/tools.js";

describe("motionPresets — M3", () => {
  it("M3_EMPHASIZED → 0.5s, bezier (0.2, 0, 0, 1), SMART_ANIMATE", () => {
    const t = resolveMotion("M3_EMPHASIZED");
    expect(t).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.5,
      easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 },
    });
  });

  it("M3_EMPHASIZED_DECELERATE → 0.4s, bezier (0.05, 0.7, 0.1, 1)", () => {
    expect(resolveMotion("M3_EMPHASIZED_DECELERATE")).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.4,
      easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.05, y1: 0.7, x2: 0.1, y2: 1 },
    });
  });

  it("M3_EMPHASIZED_ACCELERATE → 0.2s, bezier (0.3, 0, 0.8, 0.15)", () => {
    expect(resolveMotion("M3_EMPHASIZED_ACCELERATE")).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.2,
      easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.3, y1: 0, x2: 0.8, y2: 0.15 },
    });
  });

  it("M3_STANDARD → 0.3s, bezier (0.2, 0, 0, 1)", () => {
    expect(resolveMotion("M3_STANDARD")).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.3,
      easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 },
    });
  });

  it("M3_STANDARD_DECELERATE → 0.25s, bezier (0, 0, 0, 1)", () => {
    expect(resolveMotion("M3_STANDARD_DECELERATE")).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.25,
      easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0, y1: 0, x2: 0, y2: 1 },
    });
  });

  it("M3_STANDARD_ACCELERATE → 0.2s, bezier (0.3, 0, 1, 1)", () => {
    expect(resolveMotion("M3_STANDARD_ACCELERATE")).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.2,
      easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.3, y1: 0, x2: 1, y2: 1 },
    });
  });

  it("every M3 preset passes the TransitionInput zod schema", () => {
    const m3 = PRESET_NAMES.filter((n) => n.startsWith("M3_"));
    expect(m3.length).toBe(6);
    for (const name of m3) {
      const parsed = TransitionInput.safeParse(resolveMotion(name));
      expect(parsed.success, `${name} should pass TransitionInput`).toBe(true);
    }
  });
});
