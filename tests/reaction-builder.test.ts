import { describe, it, expect } from "vitest";
import { buildNavigateReaction } from "../src/figma-plugin/reaction-builder.js";

describe("buildNavigateReaction", () => {
  it("builds ON_CLICK + INSTANT by default", () => {
    const r = buildNavigateReaction({
      sourceNodeId: "1:1",
      targetFrameId: "1:2",
      trigger: "ON_CLICK",
      transition: "INSTANT",
    });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toMatchObject({
      type: "NODE",
      destinationId: "1:2",
      navigation: "NAVIGATE",
      transition: { type: "INSTANT" },
      preserveScrollPosition: false,
    });
  });

  it("uses SMART_ANIMATE with default duration & easing", () => {
    const r = buildNavigateReaction({
      sourceNodeId: "a",
      targetFrameId: "b",
      trigger: "ON_CLICK",
      transition: "SMART_ANIMATE",
    });
    expect(r.actions[0]!.transition).toMatchObject({
      type: "SMART_ANIMATE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });

  it("uses DISSOLVE with default duration", () => {
    const r = buildNavigateReaction({
      sourceNodeId: "a",
      targetFrameId: "b",
      trigger: "ON_HOVER",
      transition: "DISSOLVE",
    });
    expect(r.trigger).toEqual({ type: "ON_HOVER" });
    expect(r.actions[0]!.transition).toMatchObject({
      type: "DISSOLVE",
      duration: 0.3,
    });
  });
});
