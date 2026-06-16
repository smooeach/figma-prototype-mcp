import { describe, it, expect } from "vitest";
import {
  ProtoWireInput,
  ProtoOverlayInput,
  ProtoScrollInput,
  ProtoBackInput,
  ProtoUrlInput,
  ProtoSetVariableInput,
  ProtoToggleVariableInput,
  ProtoConditionalInput,
  ProtoChangeToInput,
  compileProtoWire,
  compileProtoOverlay,
  compileProtoScroll,
  compileProtoBack,
  compileProtoUrl,
  compileProtoSetVariable,
  compileProtoToggleVariable,
  compileProtoConditional,
  compileProtoChangeTo,
} from "../src/mcp-server/protoTools.js";
import { CreateReactionsInput } from "../src/mcp-server/tools.js";

const M3_EMPHASIZED_TRANSITION = {
  type: "SMART_ANIMATE",
  duration: 0.5,
  easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 },
};

describe("compileProtoWire", () => {
  it("compiles a single minimal wire (defaults: ON_CLICK + M3_EMPHASIZED)", () => {
    const input = ProtoWireInput.parse({
      wires: [{ from: "1:1", to: "1:2" }],
    });
    const out = compileProtoWire(input);
    expect(out).toEqual({
      replaceExisting: false,
      connections: [{
        sourceNodeId: "1:1",
        trigger: "ON_CLICK",
        transition: M3_EMPHASIZED_TRANSITION,
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    });
    expect(CreateReactionsInput.safeParse(out).success).toBe(true);
  });

  it("compiles HIG preset (named spring, no duration)", () => {
    const input = ProtoWireInput.parse({
      wires: [{ from: "1:1", to: "1:2", motion: "HIG_SNAPPY" }],
    });
    const out = compileProtoWire(input);
    expect(out.connections[0]!.transition).toEqual({
      type: "SMART_ANIMATE",
      easing: "QUICK",
    });
  });

  it("passes through a full TransitionInput object as motion", () => {
    const input = ProtoWireInput.parse({
      wires: [{
        from: "1:1",
        to: "1:2",
        motion: { type: "DISSOLVE", duration: 0.7, easing: "EASE_OUT" },
      }],
    });
    const out = compileProtoWire(input);
    expect(out.connections[0]!.transition).toEqual({
      type: "DISSOLVE", duration: 0.7, easing: "EASE_OUT",
    });
  });

  it("forwards resetScrollPosition into the action", () => {
    const input = ProtoWireInput.parse({
      wires: [{ from: "1:1", to: "1:2", resetScrollPosition: true }],
    });
    const out = compileProtoWire(input);
    expect(out.connections[0]!.action).toEqual({
      type: "navigate", targetFrameId: "1:2", resetScrollPosition: true,
    });
  });

  it("forwards replaceExisting on the batch", () => {
    const input = ProtoWireInput.parse({
      wires: [{ from: "1:1", to: "1:2" }],
      replaceExisting: true,
    });
    expect(compileProtoWire(input).replaceExisting).toBe(true);
  });

  it("compiles a batch of multiple wires", () => {
    const input = ProtoWireInput.parse({
      wires: [
        { from: "1:1", to: "1:2" },
        { from: "1:1", to: "1:3", trigger: "ON_HOVER", motion: "M3_STANDARD" },
      ],
    });
    const out = compileProtoWire(input);
    expect(out.connections).toHaveLength(2);
    expect(out.connections[1]!.trigger).toBe("ON_HOVER");
    expect(out.connections[1]!.transition).toMatchObject({ duration: 0.3 });
  });
});

describe("compileProtoOverlay", () => {
  it("compiles mode:open → action.type=overlay", () => {
    const input = ProtoOverlayInput.parse({
      overlays: [{ mode: "open", from: "1:1", overlay: "1:9" }],
    });
    const out = compileProtoOverlay(input);
    expect(out.connections[0]!.action).toEqual({
      type: "overlay", targetFrameId: "1:9",
    });
    expect(CreateReactionsInput.safeParse(out).success).toBe(true);
  });

  it("compiles mode:swap → action.type=swap_overlay", () => {
    const input = ProtoOverlayInput.parse({
      overlays: [{ mode: "swap", from: "1:1", overlay: "1:9" }],
    });
    expect(compileProtoOverlay(input).connections[0]!.action).toEqual({
      type: "swap_overlay", targetFrameId: "1:9",
    });
  });

  it("compiles mode:close → action.type=close", () => {
    const input = ProtoOverlayInput.parse({
      overlays: [{ mode: "close", from: "1:1" }],
    });
    expect(compileProtoOverlay(input).connections[0]!.action).toEqual({
      type: "close",
    });
  });

  it("compiles a mixed batch in order", () => {
    const input = ProtoOverlayInput.parse({
      overlays: [
        { mode: "open", from: "1:1", overlay: "1:9" },
        { mode: "close", from: "1:2" },
      ],
    });
    const out = compileProtoOverlay(input);
    expect(out.connections[0]!.action.type).toBe("overlay");
    expect(out.connections[1]!.action.type).toBe("close");
  });

  // Figma rejects SMART_ANIMATE on overlay/swap/close navigation (verified live
  // 2026-05-22). compileProtoOverlay rewrites the transition.type to DISSOLVE
  // while preserving easing+duration so the designer's intent (M3/HIG feel) survives.
  describe("SMART_ANIMATE → DISSOLVE rewrite (Figma overlay constraint)", () => {
    it("rewrites M3_EMPHASIZED (default) to DISSOLVE preserving bezier+duration", () => {
      const input = ProtoOverlayInput.parse({
        overlays: [{ mode: "open", from: "1:1", overlay: "1:9" }],
      });
      const transition = compileProtoOverlay(input).connections[0]!.transition;
      expect(transition).toEqual({
        type: "DISSOLVE",
        duration: 0.5,
        easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 },
      });
    });

    it("rewrites HIG_SNAPPY to DISSOLVE preserving named-spring easing", () => {
      const input = ProtoOverlayInput.parse({
        overlays: [{ mode: "open", from: "1:1", overlay: "1:9", motion: "HIG_SNAPPY" }],
      });
      expect(compileProtoOverlay(input).connections[0]!.transition).toEqual({
        type: "DISSOLVE",
        easing: "QUICK",
      });
    });

    it("rewrites string \"SMART_ANIMATE\" to string \"DISSOLVE\"", () => {
      const input = ProtoOverlayInput.parse({
        overlays: [{ mode: "swap", from: "1:1", overlay: "1:9", motion: "SMART_ANIMATE" }],
      });
      expect(compileProtoOverlay(input).connections[0]!.transition).toBe("DISSOLVE");
    });

    it("passes through DISSOLVE-typed motion unchanged", () => {
      const input = ProtoOverlayInput.parse({
        overlays: [{
          mode: "open", from: "1:1", overlay: "1:9",
          motion: { type: "DISSOLVE", duration: 0.7, easing: "EASE_OUT" },
        }],
      });
      expect(compileProtoOverlay(input).connections[0]!.transition).toEqual({
        type: "DISSOLVE", duration: 0.7, easing: "EASE_OUT",
      });
    });

    it("passes through directional transition (MOVE_IN) unchanged", () => {
      const input = ProtoOverlayInput.parse({
        overlays: [{
          mode: "open", from: "1:1", overlay: "1:9",
          motion: { type: "MOVE_IN", direction: "BOTTOM", duration: 0.4 },
        }],
      });
      expect(compileProtoOverlay(input).connections[0]!.transition).toEqual({
        type: "MOVE_IN", direction: "BOTTOM", duration: 0.4,
      });
    });

    it("applies rewrite to close mode too", () => {
      const input = ProtoOverlayInput.parse({
        overlays: [{ mode: "close", from: "1:1", motion: "M3_STANDARD" }],
      });
      expect(compileProtoOverlay(input).connections[0]!.transition).toMatchObject({
        type: "DISSOLVE",
        duration: 0.3,
      });
    });
  });
});

describe("compileProtoScroll", () => {
  it("compiles a scroll → action.type=scroll", () => {
    const input = ProtoScrollInput.parse({
      scrolls: [{ from: "1:1", to: "1:5" }],
    });
    const out = compileProtoScroll(input);
    expect(out.connections[0]!.action).toEqual({
      type: "scroll", targetNodeId: "1:5",
    });
    expect(CreateReactionsInput.safeParse(out).success).toBe(true);
  });

  it("forwards resetScrollPosition into the action", () => {
    const input = ProtoScrollInput.parse({
      scrolls: [{ from: "1:1", to: "1:5", resetScrollPosition: false }],
    });
    expect(compileProtoScroll(input).connections[0]!.action).toEqual({
      type: "scroll", targetNodeId: "1:5", resetScrollPosition: false,
    });
  });
});

describe("compileProtoBack", () => {
  it("compiles a single back (defaults: ON_CLICK + M3_EMPHASIZED)", () => {
    const input = ProtoBackInput.parse({ backs: [{ from: "1:1" }] });
    const out = compileProtoBack(input);
    expect(out).toEqual({
      replaceExisting: false,
      connections: [{
        sourceNodeId: "1:1",
        trigger: "ON_CLICK",
        transition: M3_EMPHASIZED_TRANSITION,
        action: { type: "back" },
      }],
    });
    expect(CreateReactionsInput.safeParse(out).success).toBe(true);
  });

  it("compiles with HIG_SNAPPY motion (named spring on back)", () => {
    const input = ProtoBackInput.parse({ backs: [{ from: "1:1", motion: "HIG_SNAPPY" }] });
    const out = compileProtoBack(input);
    expect(out.connections[0]!.transition).toEqual({
      type: "SMART_ANIMATE",
      easing: "QUICK",
    });
  });

  it("forwards replaceExisting on the batch", () => {
    const input = ProtoBackInput.parse({ backs: [{ from: "1:1" }], replaceExisting: true });
    expect(compileProtoBack(input).replaceExisting).toBe(true);
  });

  it("compiles a batch of multiple backs with different triggers", () => {
    const input = ProtoBackInput.parse({
      backs: [
        { from: "1:1" },
        { from: "1:2", trigger: "ON_HOVER" },
      ],
    });
    const out = compileProtoBack(input);
    expect(out.connections).toHaveLength(2);
    expect(out.connections[0]!.trigger).toBe("ON_CLICK");
    expect(out.connections[1]!.trigger).toBe("ON_HOVER");
  });
});

describe("compileProtoUrl", () => {
  it("compiles a minimal url (no openInNewTab → defaults false; no transition)", () => {
    const input = ProtoUrlInput.parse({ urls: [{ from: "1:1", url: "https://figma.com" }] });
    const out = compileProtoUrl(input);
    expect(out.connections[0]!.action).toEqual({
      type: "url",
      url: "https://figma.com",
      openInNewTab: false,
    });
    // No `transition` in the compiled connection — create_reactions zod defaults it to "INSTANT".
    expect("transition" in out.connections[0]!).toBe(false);
    // Round-trip through create_reactions schema must succeed (transition default fires).
    expect(CreateReactionsInput.safeParse(out).success).toBe(true);
  });

  it("forwards openInNewTab when true", () => {
    const input = ProtoUrlInput.parse({
      urls: [{ from: "1:1", url: "https://figma.com", openInNewTab: true }],
    });
    expect(compileProtoUrl(input).connections[0]!.action).toEqual({
      type: "url",
      url: "https://figma.com",
      openInNewTab: true,
    });
  });

  it("forwards trigger override", () => {
    const input = ProtoUrlInput.parse({
      urls: [{ from: "1:1", url: "https://figma.com", trigger: "ON_HOVER" }],
    });
    expect(compileProtoUrl(input).connections[0]!.trigger).toBe("ON_HOVER");
  });

  it("compiles batch of multiple urls", () => {
    const input = ProtoUrlInput.parse({
      urls: [
        { from: "1:1", url: "https://a.com" },
        { from: "1:2", url: "https://b.com", openInNewTab: true },
      ],
    });
    const out = compileProtoUrl(input);
    expect(out.connections).toHaveLength(2);
    expect((out.connections[0]!.action as { url: string }).url).toBe("https://a.com");
    expect((out.connections[1]!.action as { url: string; openInNewTab: boolean }).openInNewTab).toBe(true);
  });
});

describe("compileProtoSetVariable", () => {
  it("compiles a minimal set (defaults ON_CLICK, no transition)", () => {
    const input = ProtoSetVariableInput.parse({
      sets: [{ from: "1:1", variable: "showMenu", value: true }],
    });
    const out = compileProtoSetVariable(input);
    expect(out.connections[0]!.action).toEqual({
      type: "set_variable",
      variable: "showMenu",
      value: true,
    });
    expect(out.connections[0]!.trigger).toBe("ON_CLICK");
    expect("transition" in out.connections[0]!).toBe(false);
    expect(CreateReactionsInput.safeParse(out).success).toBe(true);
  });

  it("compiles a number value", () => {
    const input = ProtoSetVariableInput.parse({
      sets: [{ from: "1:1", variable: "score", value: 100 }],
    });
    const action = compileProtoSetVariable(input).connections[0]!.action;
    expect(action).toEqual({ type: "set_variable", variable: "score", value: 100 });
  });

  it("compiles a string value (hex passthrough for COLOR)", () => {
    const input = ProtoSetVariableInput.parse({
      sets: [{ from: "1:1", variable: "bgColor", value: "#FF8800" }],
    });
    const action = compileProtoSetVariable(input).connections[0]!.action;
    expect(action).toEqual({ type: "set_variable", variable: "bgColor", value: "#FF8800" });
  });

  it("forwards trigger override", () => {
    const input = ProtoSetVariableInput.parse({
      sets: [{ from: "1:1", variable: "x", value: true, trigger: "ON_HOVER" }],
    });
    expect(compileProtoSetVariable(input).connections[0]!.trigger).toBe("ON_HOVER");
  });

  it("compiles batch of multiple sets", () => {
    const input = ProtoSetVariableInput.parse({
      sets: [
        { from: "1:1", variable: "a", value: true },
        { from: "1:2", variable: "b", value: 42 },
      ],
    });
    const out = compileProtoSetVariable(input);
    expect(out.connections).toHaveLength(2);
  });
});

describe("compileProtoToggleVariable", () => {
  it("compiles a minimal toggle (defaults ON_CLICK, no transition)", () => {
    const input = ProtoToggleVariableInput.parse({
      toggles: [{ from: "1:1", variable: "showMenu" }],
    });
    const out = compileProtoToggleVariable(input);
    expect(out.connections[0]!.action).toEqual({
      type: "toggle_variable",
      variable: "showMenu",
    });
    expect(out.connections[0]!.trigger).toBe("ON_CLICK");
    expect("transition" in out.connections[0]!).toBe(false);
    expect(CreateReactionsInput.safeParse(out).success).toBe(true);
  });

  it("forwards trigger override", () => {
    const input = ProtoToggleVariableInput.parse({
      toggles: [{ from: "1:1", variable: "showMenu", trigger: "ON_PRESS" }],
    });
    expect(compileProtoToggleVariable(input).connections[0]!.trigger).toBe("ON_PRESS");
  });

  it("compiles batch of multiple toggles", () => {
    const input = ProtoToggleVariableInput.parse({
      toggles: [
        { from: "1:1", variable: "a" },
        { from: "1:2", variable: "b" },
      ],
    });
    expect(compileProtoToggleVariable(input).connections).toHaveLength(2);
  });
});

describe("compileProtoConditional — basic shape", () => {
  it("compiles minimal (then only, no else, default ON_CLICK)", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { variable: "showMenu", value: true },
        then: { close: true },
      }],
    });
    const out = compileProtoConditional(input);
    expect(out.connections[0]!.action).toEqual({
      type: "conditional",
      condition: { variable: "showMenu", operator: "==", value: true },
      then: [{ type: "close" }],
    });
    // No `else` key in low-level action when else omitted at proto level.
    expect("else" in (out.connections[0]!.action as object)).toBe(false);
    expect(out.connections[0]!.trigger).toBe("ON_CLICK");
    expect(CreateReactionsInput.safeParse(out).success).toBe(true);
  });

  it("emits operator '==' explicitly even when proto-level omitted", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { variable: "x", value: true },         // operator omitted
        then: { close: true },
      }],
    });
    const action = compileProtoConditional(input).connections[0]!.action as {
      type: string; condition: { operator: string };
    };
    expect(action.condition.operator).toBe("==");
  });

  it("preserves explicit operator '>='", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { variable: "step", operator: ">=", value: 2 },
        then: { close: true },
      }],
    });
    const action = compileProtoConditional(input).connections[0]!.action as {
      condition: { operator: string };
    };
    expect(action.condition.operator).toBe(">=");
  });

  it("preserves explicit operator '!='", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { variable: "state", operator: "!=", value: "idle" },
        then: { close: true },
      }],
    });
    const action = compileProtoConditional(input).connections[0]!.action as {
      condition: { operator: string };
    };
    expect(action.condition.operator).toBe("!=");
  });

  it("compiles both then and else", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { variable: "loggedIn", value: true },
        then: { navigate: "home:1" },
        else: { navigate: "login:1" },
      }],
    });
    const action = compileProtoConditional(input).connections[0]!.action as {
      then: unknown[]; else?: unknown[];
    };
    expect(action.then).toEqual([{ type: "navigate", targetFrameId: "home:1" }]);
    expect(action.else).toEqual([{ type: "navigate", targetFrameId: "login:1" }]);
  });

  it("forwards trigger override", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        trigger: "ON_HOVER",
        if: { variable: "x", value: true },
        then: { close: true },
      }],
    });
    expect(compileProtoConditional(input).connections[0]!.trigger).toBe("ON_HOVER");
  });
});

describe("compileProtoConditional — branch sugar mapping (8 entries)", () => {
  function compileWithThen(then: unknown) {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { variable: "x", value: true },
        then,
      }],
    });
    return (compileProtoConditional(input).connections[0]!.action as {
      then: unknown[];
    }).then[0];
  }

  it("navigate → { type: 'navigate', targetFrameId }", () => {
    expect(compileWithThen({ navigate: "frame:1" }))
      .toEqual({ type: "navigate", targetFrameId: "frame:1" });
  });

  it("navigate with resetScrollPosition forwarded", () => {
    expect(compileWithThen({ navigate: "frame:1", resetScrollPosition: true }))
      .toEqual({ type: "navigate", targetFrameId: "frame:1", resetScrollPosition: true });
  });

  it("scroll → { type: 'scroll', targetNodeId }", () => {
    expect(compileWithThen({ scroll: "node:1" }))
      .toEqual({ type: "scroll", targetNodeId: "node:1" });
  });

  it("scroll with resetScrollPosition forwarded", () => {
    expect(compileWithThen({ scroll: "node:1", resetScrollPosition: true }))
      .toEqual({ type: "scroll", targetNodeId: "node:1", resetScrollPosition: true });
  });

  it("overlay → { type: 'overlay', targetFrameId }", () => {
    expect(compileWithThen({ overlay: "frame:1" }))
      .toEqual({ type: "overlay", targetFrameId: "frame:1" });
  });

  it("swap → { type: 'swap_overlay', targetFrameId }", () => {
    expect(compileWithThen({ swap: "frame:1" }))
      .toEqual({ type: "swap_overlay", targetFrameId: "frame:1" });
  });

  it("close → { type: 'close' }", () => {
    expect(compileWithThen({ close: true })).toEqual({ type: "close" });
  });

  it("back → { type: 'back' }", () => {
    expect(compileWithThen({ back: true })).toEqual({ type: "back" });
  });

  it("url → { type: 'url', url, openInNewTab default false }", () => {
    expect(compileWithThen({ url: "https://x.com" }))
      .toEqual({ type: "url", url: "https://x.com", openInNewTab: false });
  });

  it("url with openInNewTab true forwarded", () => {
    expect(compileWithThen({ url: "https://x.com", openInNewTab: true }))
      .toEqual({ type: "url", url: "https://x.com", openInNewTab: true });
  });

  it("set → { type: 'set_variable', variable, value }", () => {
    expect(compileWithThen({ set: { variable: "x", value: 42 } }))
      .toEqual({ type: "set_variable", variable: "x", value: 42 });
  });
});

describe("compileProtoConditional — overlay/swap rewrite", () => {
  it("rewrites SMART_ANIMATE → DISSOLVE when then is overlay", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        motion: "SMART_ANIMATE",
        if: { variable: "x", value: true },
        then: { overlay: "frame:1" },
      }],
    });
    const transition = compileProtoConditional(input).connections[0]!.transition as { type?: string } | string;
    if (typeof transition === "string") {
      expect(transition).toBe("DISSOLVE");
    } else {
      expect(transition.type).toBe("DISSOLVE");
    }
  });

  it("rewrites SMART_ANIMATE → DISSOLVE when else is swap", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        motion: "SMART_ANIMATE",
        if: { variable: "x", value: true },
        then: { navigate: "f:1" },
        else: { swap: "f:2" },
      }],
    });
    const transition = compileProtoConditional(input).connections[0]!.transition as { type?: string } | string;
    if (typeof transition === "string") {
      expect(transition).toBe("DISSOLVE");
    } else {
      expect(transition.type).toBe("DISSOLVE");
    }
  });

  it("does NOT rewrite when neither branch is overlay/swap", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        motion: "SMART_ANIMATE",
        if: { variable: "x", value: true },
        then: { navigate: "f:1" },
        else: { navigate: "f:2" },
      }],
    });
    const transition = compileProtoConditional(input).connections[0]!.transition as { type?: string } | string;
    if (typeof transition === "string") {
      expect(transition).toBe("SMART_ANIMATE");
    } else {
      expect(transition.type).toBe("SMART_ANIMATE");
    }
  });

  it("preserves M3_STANDARD motion (DISSOLVE-based; not rewritten)", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        motion: "M3_STANDARD",
        if: { variable: "x", value: true },
        then: { navigate: "f:1" },
      }],
    });
    const out = compileProtoConditional(input);
    expect(CreateReactionsInput.safeParse(out).success).toBe(true);
    // M3_STANDARD resolves to a SMART_ANIMATE-based motion preset (object form with type SMART_ANIMATE)
    const transition = out.connections[0]!.transition as { type?: string } | string;
    if (typeof transition === "string") {
      expect(transition).toBe("SMART_ANIMATE");
    } else {
      expect(transition.type).toBe("SMART_ANIMATE");
    }
  });
});

describe("compileProtoConditional — batch", () => {
  it("compiles multiple conditions", () => {
    const input = ProtoConditionalInput.parse({
      conditions: [
        { from: "1:1", if: { variable: "a", value: true }, then: { close: true } },
        { from: "1:2", if: { variable: "b", value: 1 }, then: { back: true } },
      ],
    });
    const out = compileProtoConditional(input);
    expect(out.connections).toHaveLength(2);
  });
});

describe("collection disambiguation threading", () => {
  it("forwards collection on proto_set_variable", () => {
    const out = compileProtoSetVariable(
      ProtoSetVariableInput.parse({ sets: [{ from: "1:1", variable: "count", collection: "mcp_test", value: 3 }] }),
    );
    expect(out.connections[0]!.action).toEqual({ type: "set_variable", variable: "count", collection: "mcp_test", value: 3 });
  });

  it("omits the collection key when not provided (set_variable)", () => {
    const out = compileProtoSetVariable(
      ProtoSetVariableInput.parse({ sets: [{ from: "1:1", variable: "count", value: 3 }] }),
    );
    expect(out.connections[0]!.action).toEqual({ type: "set_variable", variable: "count", value: 3 });
    expect("collection" in (out.connections[0]!.action as object)).toBe(false);
  });

  it("forwards collection on proto_toggle_variable", () => {
    const out = compileProtoToggleVariable(
      ProtoToggleVariableInput.parse({ toggles: [{ from: "1:1", variable: "isOpen", collection: "modes" }] }),
    );
    expect(out.connections[0]!.action).toEqual({ type: "toggle_variable", variable: "isOpen", collection: "modes" });
  });

  it("forwards collection on conditional if + set branch", () => {
    const out = compileProtoConditional(
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "count", collection: "mcp_test", value: 1 },
          then: { set: { variable: "flag", collection: "DuMat", value: true } },
        }],
      }),
    );
    const action = out.connections[0]!.action as any;
    expect(action.condition).toEqual({ variable: "count", collection: "mcp_test", operator: "==", value: 1 });
    expect(action.then[0]).toEqual({ type: "set_variable", variable: "flag", collection: "DuMat", value: true });
  });

  it("omits the collection key when not provided (toggle_variable)", () => {
    const out = compileProtoToggleVariable(
      ProtoToggleVariableInput.parse({ toggles: [{ from: "1:1", variable: "isOpen" }] }),
    );
    expect(out.connections[0]!.action).toEqual({ type: "toggle_variable", variable: "isOpen" });
    expect("collection" in (out.connections[0]!.action as object)).toBe(false);
  });

  it("omits the collection key when not provided (conditional if + branch set)", () => {
    const out = compileProtoConditional(
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "count", value: 1 },
          then: { set: { variable: "flag", value: true } },
        }],
      }),
    );
    const action = out.connections[0]!.action as any;
    expect("collection" in (action.condition as object)).toBe(false);
    expect("collection" in (action.then[0] as object)).toBe(false);
  });

  it("forwards collection through the conditional else branch set", () => {
    const out = compileProtoConditional(
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "count", value: 1 },
          then: { set: { variable: "flag", value: true } },
          else: { set: { variable: "flag", collection: "DuMat", value: false } },
        }],
      }),
    );
    const action = out.connections[0]!.action as any;
    expect(action.else[0]).toEqual({ type: "set_variable", variable: "flag", collection: "DuMat", value: false });
  });
});

describe("compileProtoChangeTo", () => {
  it("maps a change entry to a change_to connection with defaults", () => {
    const out = compileProtoChangeTo(ProtoChangeToInput.parse({
      changes: [{ from: "i1", to: "v1" }],
    }));
    expect(out.connections[0]!.sourceNodeId).toBe("i1");
    expect(out.connections[0]!.trigger).toBe("ON_CLICK");
    expect(out.connections[0]!.action).toEqual({ type: "change_to", targetVariantId: "v1" });
  });
  it("threads replaceExisting", () => {
    const out = compileProtoChangeTo(ProtoChangeToInput.parse({
      changes: [{ from: "i1", to: "v1" }], replaceExisting: true,
    }));
    expect(out.replaceExisting).toBe(true);
  });
  it("defaults motion to a SMART_ANIMATE transition", () => {
    const out = compileProtoChangeTo(ProtoChangeToInput.parse({ changes: [{ from: "i1", to: "v1" }] }));
    const t = out.connections[0]!.transition;
    const type = typeof t === "string" ? t : (t as { type: string }).type;
    expect(type).toBe("SMART_ANIMATE");
  });
});

describe("degradeTo threading", () => {
  it("compileProtoWire carries degradeTo onto the connection", () => {
    const out = compileProtoWire(ProtoWireInput.parse({
      wires: [{ from: "a", to: "b", degradeTo: "INSTANT" }],
    }));
    expect(out.connections[0]!.degradeTo).toBe("INSTANT");
  });
  it("compileProtoWire omits degradeTo when not given", () => {
    const out = compileProtoWire(ProtoWireInput.parse({ wires: [{ from: "a", to: "b" }] }));
    expect(out.connections[0]!.degradeTo).toBeUndefined();
  });
  it("compileProtoConditional carries degradeTo onto the connection", () => {
    const out = compileProtoConditional(ProtoConditionalInput.parse({
      conditions: [{
        from: "a", degradeTo: "DISSOLVE",
        if: { variable: "v", value: true },
        then: { navigate: "b" },
      }],
    }));
    expect(out.connections[0]!.degradeTo).toBe("DISSOLVE");
  });
});

describe("compileProtoConditional — compound", () => {
  it("maps an `all` if-condition to a compound condition on the connection", () => {
    const out = compileProtoConditional(ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { all: [
          { variable: "loggedIn", value: true },          // operator defaults to "=="
          { variable: "step", operator: ">=", value: 2 },
        ] },
        then: { back: true },
      }],
    }));
    const cond = (out.connections[0]!.action as any).condition;
    expect(cond.all).toEqual([
      { variable: "loggedIn", operator: "==", value: true },
      { variable: "step", operator: ">=", value: 2 },
    ]);
  });

  it("maps an `any` if-condition to a compound `any` condition", () => {
    const out = compileProtoConditional(ProtoConditionalInput.parse({
      conditions: [{ from: "1:1", if: { any: [
        { variable: "a", value: true }, { variable: "b", value: false },
      ] }, then: { back: true } }],
    }));
    expect((out.connections[0]!.action as any).condition.any).toHaveLength(2);
  });

  it("still maps a single if-condition (regression)", () => {
    const out = compileProtoConditional(ProtoConditionalInput.parse({
      conditions: [{ from: "1:1", if: { variable: "x", value: true }, then: { back: true } }],
    }));
    expect((out.connections[0]!.action as any).condition).toEqual({ variable: "x", operator: "==", value: true });
  });
});

describe("compileProtoWire fromScreen", () => {
  it("threads fromScreen into the connection", () => {
    const out = compileProtoWire({
      wires: [{ from: "Submit", to: "Home", fromScreen: "Login" }],
      replaceExisting: false,
    } as any);
    expect(out.connections[0]!.fromScreen).toBe("Login");
    expect(out.connections[0]!.sourceNodeId).toBe("Submit");
  });
  it("omits fromScreen when not given", () => {
    const out = compileProtoWire({ wires: [{ from: "a", to: "b" }], replaceExisting: false } as any);
    expect(out.connections[0]!.fromScreen).toBeUndefined();
  });
});

describe("proto cluster fromScreen threading", () => {
  it("compileProtoBack threads fromScreen", () => {
    const out = compileProtoBack({ backs: [{ from: "Back", fromScreen: "Detail" }], replaceExisting: false } as any);
    expect(out.connections[0]!.fromScreen).toBe("Detail");
  });
  it("compileProtoUrl threads fromScreen", () => {
    const out = compileProtoUrl({ urls: [{ from: "Link", url: "https://x.com", fromScreen: "Home" }], replaceExisting: false } as any);
    expect(out.connections[0]!.fromScreen).toBe("Home");
  });
  it("compileProtoOverlay threads fromScreen (open)", () => {
    const out = compileProtoOverlay({ overlays: [{ mode: "open", from: "Btn", overlay: "Sheet", fromScreen: "Home" }], replaceExisting: false } as any);
    expect(out.connections[0]!.fromScreen).toBe("Home");
  });
  it("compileProtoScroll threads fromScreen", () => {
    const out = compileProtoScroll({ scrolls: [{ from: "Btn", to: "Anchor", fromScreen: "Home" }], replaceExisting: false } as any);
    expect(out.connections[0]!.fromScreen).toBe("Home");
  });
  it("omits fromScreen when not given (back)", () => {
    const out = compileProtoBack({ backs: [{ from: "Back" }], replaceExisting: false } as any);
    expect(out.connections[0]!.fromScreen).toBeUndefined();
  });
});
