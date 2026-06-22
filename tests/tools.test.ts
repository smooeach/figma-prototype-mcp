import { describe, it, expect } from "vitest";
import {
  GetCanvasOverviewInput,
  GetPrototypeFlowInput,
  FindNodesInput,
  CreateReactionsInput,
  ListReactionsInput,
  ClearReactionsInput,
  SetFrameScrollInput,
  ListVariablesInput,
  CreateVariableInput,
  GenerateInteractionCodeInput,
} from "../src/mcp-server/tools.js";
import { makeTools } from "../src/server/tools.js";
import { HistoryStore } from "../src/server/history.js";

describe("GetCanvasOverviewInput", () => {
  it("accepts empty input", () => {
    expect(GetCanvasOverviewInput.parse({})).toEqual({});
  });
  it("accepts pageId", () => {
    expect(GetCanvasOverviewInput.parse({ pageId: "1:2" })).toEqual({ pageId: "1:2" });
  });
});

describe("FindNodesInput", () => {
  it("accepts minimal query", () => {
    const r = FindNodesInput.parse({ query: "Continue" });
    expect(r.query).toBe("Continue");
    expect(r.scope).toBe("page"); // default
    expect(r.limit).toBe(50);     // default
  });
  it("rejects missing query", () => {
    expect(() => FindNodesInput.parse({})).toThrow();
  });
  it("accepts nodeTypes filter and limit override", () => {
    const r = FindNodesInput.parse({ query: "btn", nodeTypes: ["INSTANCE"], limit: 10 });
    expect(r.nodeTypes).toEqual(["INSTANCE"]);
    expect(r.limit).toBe(10);
  });
});

describe("CreateReactionsInput", () => {
  it("accepts a navigate connection with defaults", () => {
    const r = CreateReactionsInput.parse({
      connections: [
        { sourceNodeId: "1:1", action: { type: "navigate", targetFrameId: "1:2" } },
      ],
    });
    expect(r.connections[0]!.action).toEqual({ type: "navigate", targetFrameId: "1:2" });
    expect(r.connections[0]!.trigger).toBe("ON_CLICK");
    expect(r.connections[0]!.transition).toBe("INSTANT");
    expect(r.replaceExisting).toBe(false);
  });

  it("accepts a scroll connection", () => {
    const r = CreateReactionsInput.parse({
      connections: [
        { sourceNodeId: "1:1", action: { type: "scroll", targetNodeId: "1:9" } },
      ],
    });
    expect(r.connections[0]!.action).toEqual({ type: "scroll", targetNodeId: "1:9" });
  });

  it("accepts a mixed batch of navigate and scroll", () => {
    const r = CreateReactionsInput.parse({
      connections: [
        { sourceNodeId: "1:1", action: { type: "navigate", targetFrameId: "1:2" } },
        { sourceNodeId: "1:3", action: { type: "scroll", targetNodeId: "1:9" } },
      ],
    });
    expect(r.connections).toHaveLength(2);
  });

  it("rejects empty connections", () => {
    expect(() => CreateReactionsInput.parse({ connections: [] })).toThrow();
  });

  it("rejects connection without action", () => {
    expect(() =>
      CreateReactionsInput.parse({ connections: [{ sourceNodeId: "1:1" }] })
    ).toThrow();
  });

  it("rejects scroll action missing targetNodeId", () => {
    expect(() =>
      CreateReactionsInput.parse({
        connections: [{ sourceNodeId: "1:1", action: { type: "scroll" } }],
      })
    ).toThrow();
  });

  it("rejects navigate action with the wrong key (targetNodeId)", () => {
    expect(() =>
      CreateReactionsInput.parse({
        connections: [
          { sourceNodeId: "1:1", action: { type: "navigate", targetNodeId: "1:5" } },
        ],
      })
    ).toThrow();
  });

  it("rejects invalid trigger", () => {
    expect(() =>
      CreateReactionsInput.parse({
        connections: [
          { sourceNodeId: "a", trigger: "ON_LONG_PRESS", action: { type: "navigate", targetFrameId: "b" } },
        ],
      })
    ).toThrow();
  });
});

describe("CreateReactionsInput overlay + close", () => {
  it("accepts an overlay connection", () => {
    const r = CreateReactionsInput.parse({
      connections: [
        { sourceNodeId: "1:1", action: { type: "overlay", targetFrameId: "1:7" } },
      ],
    });
    expect(r.connections[0]!.action).toEqual({ type: "overlay", targetFrameId: "1:7" });
  });

  it("accepts a close connection (no destination)", () => {
    const r = CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "1:1", action: { type: "close" } }],
    });
    expect(r.connections[0]!.action).toEqual({ type: "close" });
  });

  it("accepts a mixed 4-action batch", () => {
    const r = CreateReactionsInput.parse({
      connections: [
        { sourceNodeId: "1:1", action: { type: "navigate", targetFrameId: "1:2" } },
        { sourceNodeId: "1:3", action: { type: "scroll", targetNodeId: "1:9" } },
        { sourceNodeId: "1:4", action: { type: "overlay", targetFrameId: "1:7" } },
        { sourceNodeId: "1:5", action: { type: "close" } },
      ],
    });
    expect(r.connections).toHaveLength(4);
  });

  it("rejects overlay missing targetFrameId", () => {
    expect(() =>
      CreateReactionsInput.parse({
        connections: [{ sourceNodeId: "1:1", action: { type: "overlay" } }],
      })
    ).toThrow();
  });
});

describe("ListReactionsInput", () => {
  it("requires nodeId", () => {
    expect(() => ListReactionsInput.parse({})).toThrow();
    expect(ListReactionsInput.parse({ nodeId: "1:1" }).nodeId).toBe("1:1");
  });
});

describe("ClearReactionsInput", () => {
  it("requires non-empty nodeIds", () => {
    expect(() => ClearReactionsInput.parse({ nodeIds: [] })).toThrow();
  });
  it("rejects indices when multiple nodeIds", () => {
    expect(() =>
      ClearReactionsInput.parse({ nodeIds: ["a", "b"], indices: [0] })
    ).toThrow();
  });
  it("accepts indices with single nodeId", () => {
    const r = ClearReactionsInput.parse({ nodeIds: ["a"], indices: [0, 1] });
    expect(r.indices).toEqual([0, 1]);
  });
});

describe("CreateReactionsInput back/url/swap", () => {
  it("accepts a back connection (no destination)", () => {
    const r = CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "1:1", action: { type: "back" } }],
    });
    expect(r.connections[0]!.action).toEqual({ type: "back" });
  });

  it("accepts a url connection", () => {
    const r = CreateReactionsInput.parse({
      connections: [
        { sourceNodeId: "1:1", action: { type: "url", url: "https://figma.com" } },
      ],
    });
    expect(r.connections[0]!.action).toEqual({ type: "url", url: "https://figma.com" });
  });

  it("accepts a swap_overlay connection", () => {
    const r = CreateReactionsInput.parse({
      connections: [
        { sourceNodeId: "1:1", action: { type: "swap_overlay", targetFrameId: "1:9" } },
      ],
    });
    expect(r.connections[0]!.action).toEqual({ type: "swap_overlay", targetFrameId: "1:9" });
  });

  it("rejects url missing url field", () => {
    expect(() =>
      CreateReactionsInput.parse({
        connections: [{ sourceNodeId: "1:1", action: { type: "url" } }],
      })
    ).toThrow();
  });

  it("rejects swap_overlay missing targetFrameId", () => {
    expect(() =>
      CreateReactionsInput.parse({
        connections: [{ sourceNodeId: "1:1", action: { type: "swap_overlay" } }],
      })
    ).toThrow();
  });
});

describe("CreateReactionsInput url openInNewTab", () => {
  it("accepts a url connection with openInNewTab true", () => {
    const r = CreateReactionsInput.parse({
      connections: [
        {
          sourceNodeId: "1:1",
          action: { type: "url", url: "https://figma.com", openInNewTab: true },
        },
      ],
    });
    expect(r.connections[0]!.action).toEqual({
      type: "url",
      url: "https://figma.com",
      openInNewTab: true,
    });
  });
});

describe("CreateReactionsInput AFTER_TIMEOUT trigger", () => {
  it("accepts a connection with AFTER_TIMEOUT trigger and afterTimeoutSeconds", () => {
    const r = CreateReactionsInput.parse({
      connections: [
        {
          sourceNodeId: "1:1",
          trigger: "AFTER_TIMEOUT",
          afterTimeoutSeconds: 2,
          action: { type: "navigate", targetFrameId: "1:2" },
        },
      ],
    });
    expect(r.connections[0]!.trigger).toBe("AFTER_TIMEOUT");
    expect(r.connections[0]!.afterTimeoutSeconds).toBe(2);
  });

  it("rejects AFTER_TIMEOUT trigger without afterTimeoutSeconds", () => {
    expect(() =>
      CreateReactionsInput.parse({
        connections: [
          {
            sourceNodeId: "1:1",
            trigger: "AFTER_TIMEOUT",
            action: { type: "navigate", targetFrameId: "1:2" },
          },
        ],
      })
    ).toThrow();
  });

  it("rejects non-positive afterTimeoutSeconds", () => {
    expect(() =>
      CreateReactionsInput.parse({
        connections: [
          {
            sourceNodeId: "1:1",
            trigger: "AFTER_TIMEOUT",
            afterTimeoutSeconds: 0,
            action: { type: "navigate", targetFrameId: "1:2" },
          },
        ],
      })
    ).toThrow();
  });
});

describe("CreateReactionsInput transition Phase 1", () => {
  it("accepts nested transition with duration + easing", () => {
    const r = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: { type: "DISSOLVE", duration: 0.5, easing: "EASE_OUT_BACK" },
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    });
    expect(r.connections[0]!.transition).toEqual({
      type: "DISSOLVE", duration: 0.5, easing: "EASE_OUT_BACK",
    });
  });

  it("accepts nested transition with only type (defaults applied later by builder)", () => {
    const r = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: { type: "SMART_ANIMATE" },
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    });
    expect(r.connections[0]!.transition).toEqual({ type: "SMART_ANIMATE" });
  });

  it("rejects nested transition with unknown easing", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: { type: "DISSOLVE", easing: "EASE_OUT_BOUNCE" as any },
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    })).toThrow();
  });

  it("rejects nested transition with non-positive duration", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: { type: "DISSOLVE", duration: 0 },
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    })).toThrow();
  });

  it("rejects nested transition with duration > 10", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: { type: "DISSOLVE", duration: 15 },
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    })).toThrow();
  });

  it("still accepts the INSTANT/DISSOLVE/SMART_ANIMATE shortcut strings", () => {
    const r = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: "SMART_ANIMATE",
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    });
    expect(r.connections[0]!.transition).toBe("SMART_ANIMATE");
  });
});

describe("CreateReactionsInput — new trigger object variants", () => {
  const base = { sourceNodeId: "1:1", action: { type: "navigate", targetFrameId: "2:2" } };
  it("ON_DRAG object trigger", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "ON_DRAG" } }],
    });
    expect(r.success).toBe(true);
  });
  it("MOUSE_UP with delay", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "MOUSE_UP", delay: 0.2 } }],
    });
    expect(r.success).toBe(true);
  });
  it("MOUSE_ENTER without optional fields", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "MOUSE_ENTER" } }],
    });
    expect(r.success).toBe(true);
  });
  it("ON_KEY_DOWN requires device + keyCodes", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "ON_KEY_DOWN", device: "KEYBOARD", keyCodes: [32] } }],
    });
    expect(r.success).toBe(true);
  });
  it("ON_KEY_DOWN fails without keyCodes", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "ON_KEY_DOWN", device: "KEYBOARD" } }],
    });
    expect(r.success).toBe(false);
  });
  it("ON_KEY_DOWN fails with empty keyCodes", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "ON_KEY_DOWN", device: "KEYBOARD", keyCodes: [] } }],
    });
    expect(r.success).toBe(false);
  });
  it("ON_MEDIA_HIT requires mediaHitTime", () => {
    const ok = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "ON_MEDIA_HIT", mediaHitTime: 5 } }],
    });
    expect(ok.success).toBe(true);
    const bad = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "ON_MEDIA_HIT" } }],
    });
    expect(bad.success).toBe(false);
  });
  it("ON_MEDIA_END no params", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "ON_MEDIA_END" } }],
    });
    expect(r.success).toBe(true);
  });
  it("AFTER_TIMEOUT object self-contained (no top-level afterTimeoutSeconds needed)", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "AFTER_TIMEOUT", timeout: 2 } }],
    });
    expect(r.success).toBe(true);
  });
  it("AFTER_TIMEOUT object missing timeout fails", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: { type: "AFTER_TIMEOUT" } }],
    });
    expect(r.success).toBe(false);
  });
  it("string AFTER_TIMEOUT still requires top-level afterTimeoutSeconds (backward compat)", () => {
    const ok = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: "AFTER_TIMEOUT", afterTimeoutSeconds: 2 }],
    });
    expect(ok.success).toBe(true);
    const bad = CreateReactionsInput.safeParse({
      connections: [{ ...base, trigger: "AFTER_TIMEOUT" }],
    });
    expect(bad.success).toBe(false);
  });
});

describe("CreateReactionsInput — directional transitions", () => {
  const base = { sourceNodeId: "1:1", action: { type: "navigate", targetFrameId: "2:2" } };
  it("MOVE_IN with direction accepted", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, transition: { type: "MOVE_IN", direction: "RIGHT" } }],
    });
    expect(r.success).toBe(true);
  });
  it("PUSH with matchLayers + easing", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base,
        transition: { type: "PUSH", direction: "LEFT", matchLayers: true, easing: "BOUNCY" } }],
    });
    expect(r.success).toBe(true);
  });
  it("SLIDE_IN missing direction fails", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, transition: { type: "SLIDE_IN" } }],
    });
    expect(r.success).toBe(false);
  });
  it("invalid direction value fails", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{ ...base, transition: { type: "MOVE_OUT", direction: "DIAGONAL" } }],
    });
    expect(r.success).toBe(false);
  });
});

describe("CreateReactionsInput easing spring + custom", () => {
  it("accepts each of the 4 spring presets", () => {
    for (const easing of ["GENTLE", "QUICK", "BOUNCY", "SLOW"] as const) {
      const r = CreateReactionsInput.parse({
        connections: [{
          sourceNodeId: "1:1",
          transition: { type: "SMART_ANIMATE", easing },
          action: { type: "navigate", targetFrameId: "1:2" },
        }],
      });
      expect((r.connections[0]!.transition as any).easing).toBe(easing);
    }
  });

  it("accepts CUSTOM_CUBIC_BEZIER flat shape", () => {
    const r = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: {
          type: "SMART_ANIMATE",
          easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 },
        },
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    });
    expect((r.connections[0]!.transition as any).easing).toEqual({
      type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1,
    });
  });

  it("accepts CUSTOM_SPRING flat shape", () => {
    const r = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: {
          type: "SMART_ANIMATE",
          easing: { type: "CUSTOM_SPRING", mass: 1, stiffness: 600, damping: 10 },
        },
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    });
    expect((r.connections[0]!.transition as any).easing).toEqual({
      type: "CUSTOM_SPRING", mass: 1, stiffness: 600, damping: 10,
    });
  });

  it("rejects CUSTOM_CUBIC_BEZIER with x1 > 1", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: {
          type: "SMART_ANIMATE",
          easing: { type: "CUSTOM_CUBIC_BEZIER", x1: 1.5, y1: 0, x2: 0, y2: 1 },
        },
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    })).toThrow();
  });

  it("rejects CUSTOM_SPRING with negative mass", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        transition: {
          type: "SMART_ANIMATE",
          easing: { type: "CUSTOM_SPRING", mass: -1, stiffness: 100, damping: 10 },
        },
        action: { type: "navigate", targetFrameId: "1:2" },
      }],
    })).toThrow();
  });
});

describe("SetFrameScrollInput", () => {
  it("accepts single frame with VERTICAL", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [{ frameId: "1:1", direction: "VERTICAL" }],
    });
    expect(r.success).toBe(true);
  });
  it("accepts batch with all 4 directions", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [
        { frameId: "1:1", direction: "NONE" },
        { frameId: "1:2", direction: "HORIZONTAL" },
        { frameId: "1:3", direction: "VERTICAL" },
        { frameId: "1:4", direction: "BOTH" },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty frames array", () => {
    const r = SetFrameScrollInput.safeParse({ frames: [] });
    expect(r.success).toBe(false);
  });
  it("rejects invalid direction value", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [{ frameId: "1:1", direction: "DIAGONAL" }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects empty frameId", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [{ frameId: "", direction: "VERTICAL" }],
    });
    expect(r.success).toBe(false);
  });
  it("accepts fixedChildren-only entry (no direction)", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [{ frameId: "1:1", fixedChildren: 1 }],
    });
    expect(r.success).toBe(true);
  });
  it("accepts both direction and fixedChildren", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [{ frameId: "1:1", direction: "VERTICAL", fixedChildren: 2 }],
    });
    expect(r.success).toBe(true);
  });
  it("rejects entry with neither direction nor fixedChildren", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [{ frameId: "1:1" }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects negative fixedChildren", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [{ frameId: "1:1", fixedChildren: -1 }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects non-integer fixedChildren", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [{ frameId: "1:1", fixedChildren: 1.5 }],
    });
    expect(r.success).toBe(false);
  });
  it("accepts fixedChildren: 0 (explicit unfix)", () => {
    const r = SetFrameScrollInput.safeParse({
      frames: [{ frameId: "1:1", fixedChildren: 0 }],
    });
    expect(r.success).toBe(true);
  });
});

describe("CreateReactionsInput — conditional action MVP", () => {
  const trigger = "ON_CLICK" as const;
  const baseCond = { variable: "loggedIn", operator: "==", value: true } as const;
  const navHome = { type: "navigate", targetFrameId: "home" } as const;
  const navLogin = { type: "navigate", targetFrameId: "login" } as const;

  it("accepts conditional with then only", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "conditional", condition: baseCond, then: [navHome] },
      }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts conditional with then + else", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "conditional", condition: baseCond, then: [navHome], else: [navLogin] },
      }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts each of 6 operators", () => {
    const ops = ["==", "!=", "<", "<=", ">", ">="] as const;
    for (const op of ops) {
      const r = CreateReactionsInput.safeParse({
        connections: [{
          sourceNodeId: "1:1", trigger,
          action: { type: "conditional",
            condition: { variable: "x", operator: op, value: 1 },
            then: [navHome] },
        }],
      });
      expect(r.success).toBe(true);
    }
  });

  it("accepts boolean, number, and string literal values", () => {
    for (const v of [true, 42, "gold"] as const) {
      const r = CreateReactionsInput.safeParse({
        connections: [{
          sourceNodeId: "1:1", trigger,
          action: { type: "conditional",
            condition: { variable: "x", operator: "==", value: v },
            then: [navHome] },
        }],
      });
      expect(r.success).toBe(true);
    }
  });

  it("rejects empty then array", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "conditional", condition: baseCond, then: [] },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty else array (must omit or have at least 1)", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "conditional", condition: baseCond,
          then: [navHome], else: [] },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown operator", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "conditional",
          condition: { variable: "x", operator: "===" as any, value: true },
          then: [navHome] },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects missing variable name", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "conditional",
          condition: { variable: "", operator: "==", value: true } as any,
          then: [navHome] },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects nested conditional inside then", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "conditional", condition: baseCond,
          then: [{ type: "conditional", condition: baseCond, then: [navHome] } as any] },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects nested conditional inside else", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "conditional", condition: baseCond, then: [navHome],
          else: [{ type: "conditional", condition: baseCond, then: [navHome] } as any] },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("accepts then with multiple actions (e.g. close + navigate)", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "conditional", condition: baseCond,
          then: [{ type: "close" }, navHome] },
      }],
    });
    expect(r.success).toBe(true);
  });
});

describe("CreateReactionsInput — resetScrollPosition option", () => {
  const trigger = "ON_CLICK" as const;
  it("accepts navigate with resetScrollPosition: false", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "navigate", targetFrameId: "2:2", resetScrollPosition: false },
      }],
    });
    expect(r.success).toBe(true);
  });
  it("accepts scroll with resetScrollPosition: true", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "scroll", targetNodeId: "2:2", resetScrollPosition: true },
      }],
    });
    expect(r.success).toBe(true);
  });
  it("accepts overlay with resetScrollPosition: false", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "overlay", targetFrameId: "2:2", resetScrollPosition: false },
      }],
    });
    expect(r.success).toBe(true);
  });
  it("accepts swap_overlay with resetScrollPosition: true", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "swap_overlay", targetFrameId: "2:2", resetScrollPosition: true },
      }],
    });
    expect(r.success).toBe(true);
  });
});

describe("CreateReactionsInput — set_variable + toggle_variable", () => {
  const trigger = "ON_CLICK" as const;

  it("accepts set_variable with boolean value", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "set_variable", variable: "showMenu", value: true },
      }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts set_variable with number value", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "set_variable", variable: "count", value: 42 },
      }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts set_variable with string value", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "set_variable", variable: "tier", value: "gold" },
      }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects set_variable with empty variable name", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "set_variable", variable: "", value: true },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects set_variable with unsupported value type (object)", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "set_variable", variable: "x", value: { nested: true } as any },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("accepts toggle_variable top-level", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "toggle_variable", variable: "showMenu" },
      }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects toggle_variable with empty variable name", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "toggle_variable", variable: "" },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("accepts set_variable inside conditional then/else", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: {
          type: "conditional",
          condition: { variable: "x", operator: "==", value: true },
          then: [{ type: "set_variable", variable: "y", value: false }],
          else: [{ type: "set_variable", variable: "y", value: true }],
        },
      }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects toggle_variable inside conditional then", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: {
          type: "conditional",
          condition: { variable: "x", operator: "==", value: true },
          then: [{ type: "toggle_variable", variable: "y" } as any],
        },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects toggle_variable inside conditional else", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: {
          type: "conditional",
          condition: { variable: "x", operator: "==", value: true },
          then: [{ type: "set_variable", variable: "y", value: true }],
          else: [{ type: "toggle_variable", variable: "y" } as any],
        },
      }],
    });
    expect(r.success).toBe(false);
  });

  it("accepts set_variable with hex string value (will be interpreted as COLOR at plugin runtime)", () => {
    const r = CreateReactionsInput.safeParse({
      connections: [{
        sourceNodeId: "1:1", trigger,
        action: { type: "set_variable", variable: "bgColor", value: "#FF4040" },
      }],
    });
    expect(r.success).toBe(true);
  });
});

import { ProtoGetLastHistoryInput } from "../src/mcp-server/protoTools.js";

describe("ProtoGetLastHistoryInput", () => {
  it("accepts empty input — count defaults to 1", () => {
    const r = ProtoGetLastHistoryInput.parse({});
    expect(r.count).toBe(1);
  });

  it("accepts count: 5", () => {
    expect(ProtoGetLastHistoryInput.parse({ count: 5 }).count).toBe(5);
  });

  it("accepts count: 1 (boundary min)", () => {
    expect(ProtoGetLastHistoryInput.parse({ count: 1 }).count).toBe(1);
  });

  it("accepts count: 10 (boundary max)", () => {
    expect(ProtoGetLastHistoryInput.parse({ count: 10 }).count).toBe(10);
  });

  it("rejects count: 0", () => {
    expect(() => ProtoGetLastHistoryInput.parse({ count: 0 })).toThrow();
  });

  it("rejects count: 11 (above max 10)", () => {
    expect(() => ProtoGetLastHistoryInput.parse({ count: 11 })).toThrow();
  });
});

describe("ListVariablesInput", () => {
  it("accepts empty input with includeRemote defaulting to true", () => {
    const r = ListVariablesInput.parse({});
    expect(r.includeRemote).toBe(true);
  });
  it("accepts a resolvedType filter and nameQuery", () => {
    const r = ListVariablesInput.parse({ resolvedType: "FLOAT", nameQuery: "corner" });
    expect(r.resolvedType).toBe("FLOAT");
    expect(r.nameQuery).toBe("corner");
  });
  it("allows includeRemote to be disabled", () => {
    expect(ListVariablesInput.parse({ includeRemote: false }).includeRemote).toBe(false);
  });
  it("rejects an unknown resolvedType", () => {
    expect(() => ListVariablesInput.parse({ resolvedType: "VECTOR" })).toThrow();
  });
  it("rejects unknown keys (strict)", () => {
    expect(() => ListVariablesInput.parse({ bogus: 1 })).toThrow();
  });
});

describe("ConnectionInput.degradeTo", () => {
  it("accepts DISSOLVE and INSTANT", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "a", action: { type: "navigate", targetFrameId: "f" }, degradeTo: "INSTANT" }],
    });
    expect(parsed.connections[0]!.degradeTo).toBe("INSTANT");
  });
  it("rejects an unknown degradeTo value", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "a", action: { type: "navigate", targetFrameId: "f" }, degradeTo: "FADE" }],
    })).toThrow();
  });
  it("leaves degradeTo undefined when omitted", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "a", action: { type: "navigate", targetFrameId: "f" } }],
    });
    expect(parsed.connections[0]!.degradeTo).toBeUndefined();
  });
});

describe("change_to action", () => {
  it("accepts a change_to action with targetVariantId", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "i1", action: { type: "change_to", targetVariantId: "v1" } }],
    });
    expect(parsed.connections[0]!.action).toEqual({ type: "change_to", targetVariantId: "v1" });
  });
  it("rejects change_to without targetVariantId", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{ sourceNodeId: "i1", action: { type: "change_to" } }],
    })).toThrow();
  });
  it("allows change_to inside a conditional then-branch", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "i1",
        action: {
          type: "conditional",
          condition: { variable: "v", operator: "==", value: true },
          then: [{ type: "change_to", targetVariantId: "v1" }],
        },
      }],
    });
    expect((parsed.connections[0]!.action as { then: unknown[] }).then[0]).toEqual({
      type: "change_to", targetVariantId: "v1",
    });
  });
});

describe("ConditionInput compound", () => {
  it("accepts an `all` compound condition inside a conditional action", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        action: {
          type: "conditional",
          condition: { all: [
            { variable: "loggedIn", operator: "==", value: true },
            { variable: "step", operator: ">=", value: 2 },
          ] },
          then: [{ type: "back" }],
        },
      }],
    });
    const cond = (parsed.connections[0]!.action as any).condition;
    expect(cond.all).toHaveLength(2);
  });

  it("accepts an `any` compound condition", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        action: { type: "conditional", condition: { any: [
          { variable: "a", operator: "==", value: true },
          { variable: "b", operator: "==", value: false },
        ] }, then: [{ type: "back" }] },
      }],
    });
    expect(((parsed.connections[0]!.action as any).condition).any).toHaveLength(2);
  });

  it("rejects an `all` with fewer than 2 comparisons", () => {
    expect(() => CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        action: { type: "conditional", condition: { all: [{ variable: "x", operator: "==", value: true }] }, then: [{ type: "back" }] },
      }],
    })).toThrow();
  });

  it("still accepts a single comparison condition (regression)", () => {
    const parsed = CreateReactionsInput.parse({
      connections: [{
        sourceNodeId: "1:1",
        action: { type: "conditional", condition: { variable: "x", operator: "==", value: true }, then: [{ type: "back" }] },
      }],
    });
    expect((parsed.connections[0]!.action as any).condition.variable).toBe("x");
  });
});

describe("GetPrototypeFlowInput", () => {
  it("defaults limit to 500 and allows optional pageId", () => {
    expect(GetPrototypeFlowInput.parse({})).toEqual({ limit: 500 });
    expect(GetPrototypeFlowInput.parse({ pageId: "1:2" })).toEqual({ pageId: "1:2", limit: 500 });
  });
  it("rejects a non-positive limit", () => {
    expect(() => GetPrototypeFlowInput.parse({ limit: 0 })).toThrow();
  });
});

describe("CreateVariableInput", () => {
  it("requires name and type", () => {
    expect(() => CreateVariableInput.parse({ name: "isOpen" })).toThrow();
    expect(() => CreateVariableInput.parse({ type: "BOOLEAN" })).toThrow();
  });
  it("leaves collection and value optional (no default)", () => {
    const r = CreateVariableInput.parse({ name: "isOpen", type: "BOOLEAN" });
    expect(r.collection).toBeUndefined();
    expect(r.value).toBeUndefined();
  });
  it("accepts an explicit value and collection", () => {
    const r = CreateVariableInput.parse({ name: "tint", type: "COLOR", value: "#FF0000", collection: "Theme" });
    expect(r.value).toBe("#FF0000");
    expect(r.collection).toBe("Theme");
  });
  it("rejects unknown keys and bad type", () => {
    expect(() => CreateVariableInput.parse({ name: "x", type: "BOOLEAN", nope: 1 })).toThrow();
    expect(() => CreateVariableInput.parse({ name: "x", type: "DATE" })).toThrow();
  });
});

describe("GenerateInteractionCodeInput", () => {
  it("requires screens and target", () => {
    expect(() => GenerateInteractionCodeInput.parse({ screens: ["1:1"] })).toThrow();
    expect(() => GenerateInteractionCodeInput.parse({ target: "react" })).toThrow();
  });
  it("accepts screens + target react + optional pageId", () => {
    const r = GenerateInteractionCodeInput.parse({ screens: ["1:1"], target: "react", pageId: "p1" });
    expect(r.screens).toEqual(["1:1"]);
    expect(r.target).toBe("react");
    expect(r.pageId).toBe("p1");
  });
  it("rejects empty screens, bad target, and unknown keys", () => {
    expect(() => GenerateInteractionCodeInput.parse({ screens: [], target: "react" })).toThrow();
    expect(() => GenerateInteractionCodeInput.parse({ screens: ["1:1"], target: "vue" })).toThrow();
    expect(() => GenerateInteractionCodeInput.parse({ screens: ["1:1"], target: "react", nope: 1 })).toThrow();
  });
});

describe("GenerateInteractionCodeInput react-native", () => {
  it("accepts target react-native", () => {
    expect(GenerateInteractionCodeInput.parse({ screens: ["1:1"], target: "react-native" }).target).toBe("react-native");
  });
});

describe("GenerateInteractionCodeInput swiftui", () => {
  it("accepts target swiftui", () => {
    expect(GenerateInteractionCodeInput.parse({ screens: ["1:1"], target: "swiftui" }).target).toBe("swiftui");
  });
});

describe("GenerateInteractionCodeInput compose", () => {
  it("accepts target compose", () => {
    expect(GenerateInteractionCodeInput.parse({ screens: ["1:1"], target: "compose" }).target).toBe("compose");
  });
});

describe("GenerateInteractionCodeInput flutter", () => {
  it("accepts target flutter", () => {
    expect(GenerateInteractionCodeInput.parse({ screens: ["1:1"], target: "flutter" }).target).toBe("flutter");
  });
});

describe("proto_set_variable_mode registration", () => {
  it("registers proto_set_variable_mode and advertises modes on list_variables", () => {
    const tools = makeTools(new HistoryStore());
    expect(tools.find((t) => t.name === "proto_set_variable_mode")).toBeTruthy();
    expect(tools.find((t) => t.name === "list_variables")!.description).toContain("collections");
  });
});

describe("orient-skip steering", () => {
  const tools = makeTools(new HistoryStore());
  const desc = (name: string) => tools.find((t) => t.name === name)!.description;

  it("name-accepting proto_* tools carry the orient-skip clause", () => {
    for (const name of ["proto_wire", "proto_overlay", "proto_scroll", "proto_back", "proto_url"]) {
      expect(desc(name)).toContain("get_canvas_overview or find_nodes first");
    }
  });
  it("get_canvas_overview no longer mandates being the first call", () => {
    expect(desc("get_canvas_overview")).not.toContain("first call in any scenario");
    expect(desc("get_canvas_overview")).toContain("Optional orientation");
  });

  it("get_canvas_overview advertises includeElements for one-call element discovery", () => {
    expect(desc("get_canvas_overview")).toContain("includeElements:true");
    expect(desc("get_canvas_overview")).toContain("elementsTruncated");
  });

  it("GetCanvasOverviewInput accepts includeElements", () => {
    expect(GetCanvasOverviewInput.parse({ includeElements: true })).toEqual({ includeElements: true });
    expect(GetCanvasOverviewInput.parse({})).toEqual({}); // still optional
  });
});

describe("media action (create_reactions)", () => {
  const wrap = (action: unknown) => ({
    connections: [{ sourceNodeId: "1:1", action }],
  });

  it("accepts a simple media action with no params", () => {
    const r = CreateReactionsInput.safeParse(wrap({ type: "media", mediaAction: "TOGGLE_PLAY_PAUSE" }));
    expect(r.success).toBe(true);
  });

  it("accepts a media action with a target name", () => {
    const r = CreateReactionsInput.safeParse(wrap({ type: "media", mediaAction: "PLAY", target: "Hero Video" }));
    expect(r.success).toBe(true);
  });

  it("accepts SKIP_FORWARD with amountToSkip", () => {
    const r = CreateReactionsInput.safeParse(wrap({ type: "media", mediaAction: "SKIP_FORWARD", amountToSkip: 5 }));
    expect(r.success).toBe(true);
  });

  it("accepts SKIP_TO with newTimestamp", () => {
    const r = CreateReactionsInput.safeParse(wrap({ type: "media", mediaAction: "SKIP_TO", newTimestamp: 12 }));
    expect(r.success).toBe(true);
  });

  it("rejects SKIP_FORWARD without amountToSkip", () => {
    const r = CreateReactionsInput.safeParse(wrap({ type: "media", mediaAction: "SKIP_FORWARD" }));
    expect(r.success).toBe(false);
  });

  it("rejects amountToSkip on a simple action", () => {
    const r = CreateReactionsInput.safeParse(wrap({ type: "media", mediaAction: "PLAY", amountToSkip: 5 }));
    expect(r.success).toBe(false);
  });

  it("rejects SKIP_TO without newTimestamp", () => {
    const r = CreateReactionsInput.safeParse(wrap({ type: "media", mediaAction: "SKIP_TO" }));
    expect(r.success).toBe(false);
  });

  it("rejects newTimestamp on a skip-forward action", () => {
    const r = CreateReactionsInput.safeParse(wrap({ type: "media", mediaAction: "SKIP_FORWARD", amountToSkip: 5, newTimestamp: 1 }));
    expect(r.success).toBe(false);
  });

  it("rejects an unknown mediaAction", () => {
    const r = CreateReactionsInput.safeParse(wrap({ type: "media", mediaAction: "REWIND" }));
    expect(r.success).toBe(false);
  });
});
