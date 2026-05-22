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

describe("motionPresets — HIG", () => {
  it("HIG_DEFAULT → SMART_ANIMATE + GENTLE (no duration)", () => {
    expect(resolveMotion("HIG_DEFAULT")).toEqual({
      type: "SMART_ANIMATE",
      easing: "GENTLE",
    });
  });

  it("HIG_SMOOTH → SMART_ANIMATE + SLOW", () => {
    expect(resolveMotion("HIG_SMOOTH")).toEqual({
      type: "SMART_ANIMATE",
      easing: "SLOW",
    });
  });

  it("HIG_SNAPPY → SMART_ANIMATE + QUICK", () => {
    expect(resolveMotion("HIG_SNAPPY")).toEqual({
      type: "SMART_ANIMATE",
      easing: "QUICK",
    });
  });

  it("HIG_BOUNCY → SMART_ANIMATE + BOUNCY", () => {
    expect(resolveMotion("HIG_BOUNCY")).toEqual({
      type: "SMART_ANIMATE",
      easing: "BOUNCY",
    });
  });

  it("HIG presets have no `duration` field (springs ignore duration in Figma runtime)", () => {
    for (const name of ["HIG_DEFAULT", "HIG_SMOOTH", "HIG_SNAPPY", "HIG_BOUNCY"] as const) {
      const t = resolveMotion(name) as Record<string, unknown>;
      expect(t).not.toHaveProperty("duration");
    }
  });

  it("every HIG preset passes the TransitionInput zod schema", () => {
    for (const name of ["HIG_DEFAULT", "HIG_SMOOTH", "HIG_SNAPPY", "HIG_BOUNCY"] as const) {
      const parsed = TransitionInput.safeParse(resolveMotion(name));
      expect(parsed.success, `${name} should pass TransitionInput`).toBe(true);
    }
  });
});

describe("motionPresets — resolveMotion fallbacks", () => {
  it("undefined → defaults to M3_EMPHASIZED", () => {
    expect(resolveMotion(undefined)).toEqual(resolveMotion("M3_EMPHASIZED"));
  });

  it("a full TransitionInput object passes through unchanged", () => {
    const custom: import("../src/mcp-server/tools.js").TransitionInput = {
      type: "DISSOLVE",
      duration: 0.7,
      easing: "EASE_OUT",
    };
    expect(resolveMotion(custom)).toEqual(custom);
  });

  it("PRESET_NAMES length is 10", () => {
    expect(PRESET_NAMES.length).toBe(10);
  });

  it("raw TransitionEnum strings pass through (\"INSTANT\" / \"DISSOLVE\" / \"SMART_ANIMATE\")", () => {
    // These are valid TransitionInput values that happen to be strings but are not preset names.
    // resolveMotion must return them as-is so they survive zod parsing downstream.
    expect(resolveMotion("INSTANT")).toBe("INSTANT");
    expect(resolveMotion("DISSOLVE")).toBe("DISSOLVE");
    expect(resolveMotion("SMART_ANIMATE")).toBe("SMART_ANIMATE");
  });
});
