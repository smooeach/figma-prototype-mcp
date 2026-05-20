import { describe, it, expect } from "vitest";
import { buildNavigateReaction, buildTransition, buildScrollReaction, buildOverlayReaction, buildCloseReaction } from "../src/figma-plugin/reaction-builder.js";

describe("buildNavigateReaction", () => {
  it("builds ON_CLICK + INSTANT by default", () => {
    const r = buildNavigateReaction({
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
      transition: null,
      preserveScrollPosition: false,
    });
  });

  it("uses SMART_ANIMATE with default duration & easing", () => {
    const r = buildNavigateReaction({
      targetFrameId: "b",
      trigger: "ON_CLICK",
      transition: "SMART_ANIMATE",
    });
    const action = r.actions[0]!;
    if (action.type !== "NODE") throw new Error("expected NODE action");
    expect(action.transition).toMatchObject({
      type: "SMART_ANIMATE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });

  it("uses DISSOLVE with default duration", () => {
    const r = buildNavigateReaction({
      targetFrameId: "b",
      trigger: "ON_HOVER",
      transition: "DISSOLVE",
    });
    expect(r.trigger).toEqual({ type: "ON_HOVER" });
    const action = r.actions[0]!;
    if (action.type !== "NODE") throw new Error("expected NODE action");
    expect(action.transition).toMatchObject({
      type: "DISSOLVE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });
});

describe("buildTransition", () => {
  it("returns null for INSTANT", () => {
    expect(buildTransition("INSTANT")).toBeNull();
  });

  it("returns DISSOLVE with duration and EASE_OUT easing", () => {
    expect(buildTransition("DISSOLVE")).toEqual({
      type: "DISSOLVE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });

  it("returns SMART_ANIMATE with duration and EASE_OUT easing", () => {
    expect(buildTransition("SMART_ANIMATE")).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });
});

describe("buildScrollReaction", () => {
  it("builds ON_CLICK + INSTANT SCROLL_TO by default", () => {
    const r = buildScrollReaction({
      targetNodeId: "1:5",
      trigger: "ON_CLICK",
      transition: "INSTANT",
    });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toEqual({
      type: "NODE",
      destinationId: "1:5",
      navigation: "SCROLL_TO",
      transition: null,
      preserveScrollPosition: false,
    });
  });

  it("uses DISSOLVE transition shape when requested", () => {
    const r = buildScrollReaction({
      targetNodeId: "1:5",
      trigger: "ON_CLICK",
      transition: "DISSOLVE",
    });
    const action = r.actions[0]!;
    if (action.type !== "NODE") throw new Error("expected NODE action");
    expect(action.transition).toEqual({
      type: "DISSOLVE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });

  it("honors non-default trigger", () => {
    const r = buildScrollReaction({
      targetNodeId: "1:5",
      trigger: "ON_HOVER",
      transition: "INSTANT",
    });
    expect(r.trigger).toEqual({ type: "ON_HOVER" });
  });
});

describe("buildOverlayReaction", () => {
  it("builds ON_CLICK + INSTANT OVERLAY by default", () => {
    const r = buildOverlayReaction({
      targetFrameId: "1:7",
      trigger: "ON_CLICK",
      transition: "INSTANT",
    });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toEqual({
      type: "NODE",
      destinationId: "1:7",
      navigation: "OVERLAY",
      transition: null,
      preserveScrollPosition: false,
      overlayRelativePosition: { x: 0, y: 0 },
      overlayBackgroundInteraction: "CLOSE_ON_CLICK_OUTSIDE",
      overlayBackground: { type: "NONE" },
    });
  });

  it("uses DISSOLVE transition shape when requested", () => {
    const r = buildOverlayReaction({
      targetFrameId: "1:7",
      trigger: "ON_CLICK",
      transition: "DISSOLVE",
    });
    const action = r.actions[0]!;
    if (action.type !== "NODE") throw new Error("expected NODE action");
    expect(action.transition).toEqual({
      type: "DISSOLVE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });
});

describe("buildCloseReaction", () => {
  it("builds a CLOSE action with the given trigger", () => {
    const r = buildCloseReaction({ trigger: "ON_CLICK" });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toEqual({ type: "CLOSE" });
  });

  it("honors non-default trigger", () => {
    const r = buildCloseReaction({ trigger: "ON_HOVER" });
    expect(r.trigger).toEqual({ type: "ON_HOVER" });
  });
});
