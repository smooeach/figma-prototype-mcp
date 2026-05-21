import { describe, it, expect } from "vitest";
import {
  buildNavigateReaction,
  buildTransition,
  buildTrigger,
  buildScrollReaction,
  buildOverlayReaction,
  buildCloseReaction,
  buildBackReaction,
  buildUrlReaction,
  buildSwapOverlayReaction,
  buildConditionalReaction,
  resolveEasing,
  type BuiltAction,
} from "../src/figma-plugin/reaction-builder.js";

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
    });
    // When input has no resetScrollPosition, output omits the key (conditional spread)
    if (r.actions[0]!.type === "NODE") {
      expect("resetScrollPosition" in r.actions[0]!).toBe(false);
    }
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

  it("accepts the \"INSTANT\" string shortcut and returns null", () => {
    expect(buildTransition("INSTANT")).toBeNull();
  });

  it("expands the \"DISSOLVE\" string shortcut with defaults", () => {
    expect(buildTransition("DISSOLVE")).toEqual({
      type: "DISSOLVE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });

  it("expands the \"SMART_ANIMATE\" string shortcut with defaults", () => {
    expect(buildTransition("SMART_ANIMATE")).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });

  it("accepts a nested DISSOLVE with custom duration and easing", () => {
    expect(buildTransition({ type: "DISSOLVE", duration: 0.5, easing: "EASE_OUT_BACK" })).toEqual({
      type: "DISSOLVE",
      duration: 0.5,
      easing: { type: "EASE_OUT_BACK" },
    });
  });

  it("fills missing duration with 0.3 default on nested object", () => {
    expect(buildTransition({ type: "SMART_ANIMATE", easing: "EASE_IN_AND_OUT" })).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.3,
      easing: { type: "EASE_IN_AND_OUT" },
    });
  });

  it("fills missing easing with EASE_OUT default on nested object", () => {
    expect(buildTransition({ type: "DISSOLVE", duration: 1.2 })).toEqual({
      type: "DISSOLVE",
      duration: 1.2,
      easing: { type: "EASE_OUT" },
    });
  });

  it("accepts SCROLL_ANIMATE as a valid nested type", () => {
    expect(buildTransition({ type: "SCROLL_ANIMATE" })).toEqual({
      type: "SCROLL_ANIMATE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });

  it("accepts all 7 easing names", () => {
    const names = [
      "LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT",
      "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK",
    ] as const;
    for (const n of names) {
      expect(buildTransition({ type: "DISSOLVE", easing: n })!.easing).toEqual({ type: n });
    }
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
    });
    // When input has no resetScrollPosition, output omits the key (conditional spread)
    if (r.actions[0]!.type === "NODE") {
      expect("resetScrollPosition" in r.actions[0]!).toBe(false);
    }
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
    });
    // When input has no resetScrollPosition, output omits the key (conditional spread)
    if (r.actions[0]!.type === "NODE") {
      expect("resetScrollPosition" in r.actions[0]!).toBe(false);
    }
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

describe("buildBackReaction", () => {
  it("builds a BACK action with the given trigger", () => {
    const r = buildBackReaction({ trigger: "ON_CLICK" });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toEqual({ type: "BACK" });
  });

  it("honors non-default trigger", () => {
    const r = buildBackReaction({ trigger: "ON_PRESS" });
    expect(r.trigger).toEqual({ type: "ON_PRESS" });
  });
});

describe("buildUrlReaction", () => {
  it("builds a URL action with the given url and trigger", () => {
    const r = buildUrlReaction({ trigger: "ON_CLICK", url: "https://figma.com" });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toEqual({ type: "URL", url: "https://figma.com", openInNewTab: false });
  });

  it("preserves the exact url string", () => {
    const r = buildUrlReaction({ trigger: "ON_CLICK", url: "https://example.com/path?q=1" });
    const action = r.actions[0]!;
    if (action.type !== "URL") throw new Error("expected URL action");
    expect(action.url).toBe("https://example.com/path?q=1");
  });
});

describe("buildUrlReaction openInNewTab", () => {
  it("defaults openInNewTab to false when not provided", () => {
    const r = buildUrlReaction({ trigger: "ON_CLICK", url: "https://figma.com" });
    expect(r.actions[0]).toEqual({
      type: "URL",
      url: "https://figma.com",
      openInNewTab: false,
    });
  });

  it("emits openInNewTab true when requested", () => {
    const r = buildUrlReaction({ trigger: "ON_CLICK", url: "https://figma.com", openInNewTab: true });
    expect(r.actions[0]).toEqual({
      type: "URL",
      url: "https://figma.com",
      openInNewTab: true,
    });
  });
});

describe("buildSwapOverlayReaction", () => {
  it("builds ON_CLICK + INSTANT SWAP by default", () => {
    const r = buildSwapOverlayReaction({
      targetFrameId: "1:9",
      trigger: "ON_CLICK",
      transition: "INSTANT",
    });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toEqual({
      type: "NODE",
      destinationId: "1:9",
      navigation: "SWAP",
      transition: null,
    });
    // When input has no resetScrollPosition, output omits the key (conditional spread)
    if (r.actions[0]!.type === "NODE") {
      expect("resetScrollPosition" in r.actions[0]!).toBe(false);
    }
  });

  it("uses DISSOLVE transition shape when requested", () => {
    const r = buildSwapOverlayReaction({
      targetFrameId: "1:9",
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

describe("buildTrigger", () => {
  it("emits { type: \"ON_CLICK\" } for click trigger", () => {
    expect(buildTrigger("ON_CLICK")).toEqual({ type: "ON_CLICK" });
  });

  it("emits { type: \"ON_HOVER\" } and { type: \"ON_PRESS\" } passthrough", () => {
    expect(buildTrigger("ON_HOVER")).toEqual({ type: "ON_HOVER" });
    expect(buildTrigger("ON_PRESS")).toEqual({ type: "ON_PRESS" });
  });

  it("emits { type: \"AFTER_TIMEOUT\", timeout } when given seconds", () => {
    expect(buildTrigger("AFTER_TIMEOUT", 2)).toEqual({ type: "AFTER_TIMEOUT", timeout: 2 });
  });

  it("throws when AFTER_TIMEOUT is requested without seconds", () => {
    expect(() => buildTrigger("AFTER_TIMEOUT")).toThrow(/afterTimeoutSeconds/);
  });

  it("string ON_CLICK → { type: ON_CLICK }", () => {
    expect(buildTrigger("ON_CLICK")).toEqual({ type: "ON_CLICK" });
  });
  it("string AFTER_TIMEOUT requires legacy afterTimeoutSeconds", () => {
    expect(() => buildTrigger("AFTER_TIMEOUT")).toThrow(/afterTimeoutSeconds/);
    expect(buildTrigger("AFTER_TIMEOUT", 2.5)).toEqual({
      type: "AFTER_TIMEOUT", timeout: 2.5,
    });
  });
  it("object { type: ON_CLICK } → { type: ON_CLICK }", () => {
    expect(buildTrigger({ type: "ON_CLICK" })).toEqual({ type: "ON_CLICK" });
  });
  it("object ON_DRAG no params", () => {
    expect(buildTrigger({ type: "ON_DRAG" })).toEqual({ type: "ON_DRAG" });
  });
  it("object MOUSE_UP with delay", () => {
    expect(buildTrigger({ type: "MOUSE_UP", delay: 0.2 })).toEqual({
      type: "MOUSE_UP", delay: 0.2,
    });
  });
  it("object MOUSE_UP default delay 0", () => {
    expect(buildTrigger({ type: "MOUSE_UP" })).toEqual({
      type: "MOUSE_UP", delay: 0,
    });
  });
  it("object MOUSE_ENTER defaults delay 0 (deprecatedVersion dropped — Figma runtime rejects)", () => {
    expect(buildTrigger({ type: "MOUSE_ENTER" })).toEqual({
      type: "MOUSE_ENTER", delay: 0,
    });
  });
  it("object MOUSE_LEAVE with explicit delay", () => {
    expect(buildTrigger({ type: "MOUSE_LEAVE", delay: 0.5 })).toEqual({
      type: "MOUSE_LEAVE", delay: 0.5,
    });
  });
  it("object ON_KEY_DOWN with device + keyCodes", () => {
    expect(buildTrigger({ type: "ON_KEY_DOWN", device: "KEYBOARD", keyCodes: [32] })).toEqual({
      type: "ON_KEY_DOWN", device: "KEYBOARD", keyCodes: [32],
    });
  });
  it("object ON_MEDIA_HIT with mediaHitTime", () => {
    expect(buildTrigger({ type: "ON_MEDIA_HIT", mediaHitTime: 5 })).toEqual({
      type: "ON_MEDIA_HIT", mediaHitTime: 5,
    });
  });
  it("object ON_MEDIA_END no params", () => {
    expect(buildTrigger({ type: "ON_MEDIA_END" })).toEqual({ type: "ON_MEDIA_END" });
  });
  it("object AFTER_TIMEOUT self-contained (legacy arg ignored)", () => {
    expect(buildTrigger({ type: "AFTER_TIMEOUT", timeout: 3 })).toEqual({
      type: "AFTER_TIMEOUT", timeout: 3,
    });
  });
});

describe("buildNavigateReaction with AFTER_TIMEOUT trigger", () => {
  it("emits the AFTER_TIMEOUT trigger object through the builder", () => {
    const r = buildNavigateReaction({
      targetFrameId: "1:2",
      trigger: "AFTER_TIMEOUT",
      transition: "INSTANT",
      afterTimeoutSeconds: 2,
    });
    expect(r.trigger).toEqual({ type: "AFTER_TIMEOUT", timeout: 2 });
    const action = r.actions[0]!;
    if (action.type !== "NODE") throw new Error("expected NODE action");
    expect(action.destinationId).toBe("1:2");
    expect(action.navigation).toBe("NAVIGATE");
  });
});

describe("resolveEasing", () => {
  it("returns { type: EASE_OUT } for undefined (default)", () => {
    expect(resolveEasing(undefined)).toEqual({ type: "EASE_OUT" });
  });

  it("returns { type } for a named easing string", () => {
    for (const name of [
      "LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT",
      "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK",
      "GENTLE", "QUICK", "BOUNCY", "SLOW",
    ] as const) {
      expect(resolveEasing(name)).toEqual({ type: name });
    }
  });

  it("wraps CUSTOM_CUBIC_BEZIER flat input into easingFunctionCubicBezier", () => {
    const r = resolveEasing({ type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 });
    expect(r).toEqual({
      type: "CUSTOM_CUBIC_BEZIER",
      easingFunctionCubicBezier: { x1: 0.2, y1: 0, x2: 0, y2: 1 },
    });
  });

  it("wraps CUSTOM_SPRING flat input into easingFunctionSpring", () => {
    const r = resolveEasing({ type: "CUSTOM_SPRING", mass: 1, stiffness: 600, damping: 10 });
    expect(r).toEqual({
      type: "CUSTOM_SPRING",
      easingFunctionSpring: { mass: 1, stiffness: 600, damping: 10 },
    });
  });
});

describe("buildTransition with spring + custom easings", () => {
  it("accepts BOUNCY spring preset", () => {
    expect(buildTransition({ type: "SMART_ANIMATE", duration: 0.4, easing: "BOUNCY" })).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.4,
      easing: { type: "BOUNCY" },
    });
  });

  it("accepts CUSTOM_CUBIC_BEZIER", () => {
    expect(buildTransition({
      type: "SMART_ANIMATE",
      duration: 0.5,
      easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 },
    })).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.5,
      easing: {
        type: "CUSTOM_CUBIC_BEZIER",
        easingFunctionCubicBezier: { x1: 0.2, y1: 0, x2: 0, y2: 1 },
      },
    });
  });

  it("accepts CUSTOM_SPRING", () => {
    expect(buildTransition({
      type: "SMART_ANIMATE",
      duration: 0.6,
      easing: { type: "CUSTOM_SPRING", mass: 1, stiffness: 600, damping: 10 },
    })).toEqual({
      type: "SMART_ANIMATE",
      duration: 0.6,
      easing: {
        type: "CUSTOM_SPRING",
        easingFunctionSpring: { mass: 1, stiffness: 600, damping: 10 },
      },
    });
  });
});

describe("buildTransition directional", () => {
  it("MOVE_IN RIGHT with explicit fields", () => {
    expect(buildTransition({
      type: "MOVE_IN", direction: "RIGHT", matchLayers: true, duration: 0.4, easing: "EASE_OUT",
    })).toEqual({
      type: "MOVE_IN", direction: "RIGHT", matchLayers: true, duration: 0.4, easing: { type: "EASE_OUT" },
    });
  });

  it("PUSH LEFT defaults (matchLayers=false, duration=0.3, easing=EASE_OUT)", () => {
    expect(buildTransition({ type: "PUSH", direction: "LEFT" })).toEqual({
      type: "PUSH", direction: "LEFT", matchLayers: false, duration: 0.3, easing: { type: "EASE_OUT" },
    });
  });

  it("SLIDE_IN BOTTOM with BOUNCY easing", () => {
    expect(buildTransition({ type: "SLIDE_IN", direction: "BOTTOM", easing: "BOUNCY" })).toEqual({
      type: "SLIDE_IN", direction: "BOTTOM", matchLayers: false, duration: 0.3, easing: { type: "BOUNCY" },
    });
  });

  it("MOVE_OUT TOP with duration", () => {
    expect(buildTransition({ type: "MOVE_OUT", direction: "TOP", duration: 0.5 })).toEqual({
      type: "MOVE_OUT", direction: "TOP", matchLayers: false, duration: 0.5, easing: { type: "EASE_OUT" },
    });
  });

  it("SLIDE_OUT RIGHT defaults", () => {
    expect(buildTransition({ type: "SLIDE_OUT", direction: "RIGHT" })).toEqual({
      type: "SLIDE_OUT", direction: "RIGHT", matchLayers: false, duration: 0.3, easing: { type: "EASE_OUT" },
    });
  });

  it("directional accepts CUSTOM_CUBIC_BEZIER easing (passes through resolveEasing)", () => {
    expect(buildTransition({
      type: "MOVE_IN", direction: "LEFT",
      easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 },
    })).toEqual({
      type: "MOVE_IN", direction: "LEFT", matchLayers: false, duration: 0.3,
      easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.2, y1: 0, x2: 0, y2: 1 } },
    });
  });
});

describe("NODE action — resetScrollPosition", () => {
  const t = "ON_CLICK" as const;
  it("buildNavigateReaction emits resetScrollPosition when true", () => {
    const r = buildNavigateReaction({
      targetFrameId: "1:1", trigger: t, transition: "INSTANT", resetScrollPosition: true,
    });
    expect(r.actions[0]).toMatchObject({ type: "NODE", resetScrollPosition: true });
  });
  it("buildNavigateReaction emits resetScrollPosition when false", () => {
    const r = buildNavigateReaction({
      targetFrameId: "1:1", trigger: t, transition: "INSTANT", resetScrollPosition: false,
    });
    expect(r.actions[0]).toMatchObject({ type: "NODE", resetScrollPosition: false });
  });
  it("buildNavigateReaction omits resetScrollPosition when undefined", () => {
    const r = buildNavigateReaction({
      targetFrameId: "1:1", trigger: t, transition: "INSTANT",
    });
    expect(r.actions[0]!.type).toBe("NODE");
    expect("resetScrollPosition" in r.actions[0]!).toBe(false);
  });
  it("buildScrollReaction emits resetScrollPosition when true", () => {
    const r = buildScrollReaction({
      targetNodeId: "1:1", trigger: t, transition: "INSTANT", resetScrollPosition: true,
    });
    expect(r.actions[0]).toMatchObject({ type: "NODE", resetScrollPosition: true });
  });
  it("buildOverlayReaction emits resetScrollPosition when false", () => {
    const r = buildOverlayReaction({
      targetFrameId: "1:1", trigger: t, transition: "INSTANT", resetScrollPosition: false,
    });
    expect(r.actions[0]).toMatchObject({ type: "NODE", resetScrollPosition: false });
  });
  it("buildSwapOverlayReaction emits resetScrollPosition when true", () => {
    const r = buildSwapOverlayReaction({
      targetFrameId: "1:1", trigger: t, transition: "INSTANT", resetScrollPosition: true,
    });
    expect(r.actions[0]).toMatchObject({ type: "NODE", resetScrollPosition: true });
  });
});

describe("buildConditionalReaction", () => {
  // Pre-built actions to use as then/else contents. We use BuiltAction shapes
  // directly because handleCreateReactions builds these in advance and passes
  // them in (variable lookup is plugin-side, not builder-side).
  const navHome: BuiltAction = {
    type: "NODE", destinationId: "1:home", navigation: "NAVIGATE", transition: null,
  };
  const navLogin: BuiltAction = {
    type: "NODE", destinationId: "1:login", navigation: "NAVIGATE", transition: null,
  };
  const closeAct: BuiltAction = { type: "CLOSE" };

  // A "condition" VariableData — same as what plugin's buildCondition() returns.
  // We use a literal placeholder id here; the real plugin resolves names to ids.
  const condEquals = {
    type: "EXPRESSION", resolvedType: "BOOLEAN",
    value: {
      expressionFunction: "EQUALS",
      expressionArguments: [
        { type: "VARIABLE_ALIAS", resolvedType: "BOOLEAN",
          value: { type: "VARIABLE_ALIAS", id: "VARIABLE_ID:loggedIn" } },
        { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true },
      ],
    },
  };

  it("emits CONDITIONAL action with then-only block", () => {
    const r = buildConditionalReaction({
      trigger: "ON_CLICK",
      condition: condEquals as any,
      thenActions: [navHome],
    });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
    expect(r.actions).toHaveLength(1);
    const action = r.actions[0]!;
    if (action.type !== "CONDITIONAL") throw new Error("expected CONDITIONAL");
    expect(action.conditionalBlocks).toHaveLength(1);
    expect(action.conditionalBlocks[0]!.condition).toEqual(condEquals);
    expect(action.conditionalBlocks[0]!.actions).toEqual([navHome]);
  });

  it("emits CONDITIONAL with both then and else blocks", () => {
    const r = buildConditionalReaction({
      trigger: "ON_CLICK",
      condition: condEquals as any,
      thenActions: [navHome],
      elseActions: [navLogin],
    });
    const action = r.actions[0]!;
    if (action.type !== "CONDITIONAL") throw new Error("expected CONDITIONAL");
    expect(action.conditionalBlocks).toHaveLength(2);
    expect(action.conditionalBlocks[0]!.condition).toEqual(condEquals);
    expect(action.conditionalBlocks[0]!.actions).toEqual([navHome]);
    expect(action.conditionalBlocks[1]!.condition).toBeUndefined();
    expect(action.conditionalBlocks[1]!.actions).toEqual([navLogin]);
  });

  it("emits then-block with multiple actions in order", () => {
    const r = buildConditionalReaction({
      trigger: "ON_CLICK",
      condition: condEquals as any,
      thenActions: [closeAct, navHome],
    });
    const action = r.actions[0]!;
    if (action.type !== "CONDITIONAL") throw new Error("expected CONDITIONAL");
    expect(action.conditionalBlocks[0]!.actions).toEqual([closeAct, navHome]);
  });

  it("omits else block when elseActions is undefined or empty array", () => {
    const a = buildConditionalReaction({
      trigger: "ON_CLICK", condition: condEquals as any, thenActions: [navHome],
    });
    const b = buildConditionalReaction({
      trigger: "ON_CLICK", condition: condEquals as any, thenActions: [navHome], elseActions: [],
    });
    for (const r of [a, b]) {
      const action = r.actions[0]!;
      if (action.type !== "CONDITIONAL") throw new Error("expected CONDITIONAL");
      expect(action.conditionalBlocks).toHaveLength(1);
    }
  });
});
