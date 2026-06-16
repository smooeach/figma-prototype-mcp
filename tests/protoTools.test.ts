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
} from "../src/mcp-server/protoTools.js";

describe("ProtoWireInput", () => {
  it("accepts a minimal wire (from + to)", () => {
    const r = ProtoWireInput.parse({
      wires: [{ from: "1:1", to: "1:2" }],
    });
    expect(r.wires[0]).toMatchObject({ from: "1:1", to: "1:2" });
    expect(r.replaceExisting).toBe(false);
  });

  it("accepts trigger / motion / resetScrollPosition overrides", () => {
    const r = ProtoWireInput.parse({
      wires: [{
        from: "1:1",
        to: "1:2",
        trigger: "ON_HOVER",
        motion: "M3_STANDARD",
        resetScrollPosition: true,
      }],
      replaceExisting: true,
    });
    expect(r.wires[0]!.motion).toBe("M3_STANDARD");
    expect(r.wires[0]!.trigger).toBe("ON_HOVER");
    expect(r.replaceExisting).toBe(true);
  });

  it("accepts a full TransitionInput object as motion", () => {
    const r = ProtoWireInput.parse({
      wires: [{
        from: "1:1",
        to: "1:2",
        motion: { type: "DISSOLVE", duration: 0.7, easing: "EASE_OUT" },
      }],
    });
    expect(r.wires[0]!.motion).toEqual({ type: "DISSOLVE", duration: 0.7, easing: "EASE_OUT" });
  });

  it("rejects empty wires array", () => {
    expect(() => ProtoWireInput.parse({ wires: [] })).toThrow();
  });

  it("rejects missing `to`", () => {
    expect(() => ProtoWireInput.parse({ wires: [{ from: "1:1" }] })).toThrow();
  });
});

describe("ProtoOverlayInput", () => {
  it("accepts mode:open with overlay", () => {
    const r = ProtoOverlayInput.parse({
      overlays: [{ mode: "open", from: "1:1", overlay: "1:9" }],
    });
    expect(r.overlays[0]).toMatchObject({ mode: "open", overlay: "1:9" });
  });

  it("accepts mode:swap with overlay", () => {
    const r = ProtoOverlayInput.parse({
      overlays: [{ mode: "swap", from: "1:1", overlay: "1:9" }],
    });
    expect(r.overlays[0]!.mode).toBe("swap");
  });

  it("accepts mode:close without overlay", () => {
    const r = ProtoOverlayInput.parse({
      overlays: [{ mode: "close", from: "1:1" }],
    });
    expect(r.overlays[0]!.mode).toBe("close");
  });

  it("rejects mode:open without overlay", () => {
    expect(() =>
      ProtoOverlayInput.parse({ overlays: [{ mode: "open", from: "1:1" }] }),
    ).toThrow();
  });

  it("rejects mode:close with overlay (close has no overlay field)", () => {
    expect(() =>
      ProtoOverlayInput.parse({
        overlays: [{ mode: "close", from: "1:1", overlay: "1:9" }],
      }),
    ).toThrow();
  });

  it("accepts a mixed batch (open + swap + close)", () => {
    const r = ProtoOverlayInput.parse({
      overlays: [
        { mode: "open", from: "1:1", overlay: "1:9" },
        { mode: "swap", from: "1:2", overlay: "1:10" },
        { mode: "close", from: "1:3" },
      ],
    });
    expect(r.overlays).toHaveLength(3);
  });
});

describe("ProtoScrollInput", () => {
  it("accepts a minimal scroll (from + to)", () => {
    const r = ProtoScrollInput.parse({
      scrolls: [{ from: "1:1", to: "1:5" }],
    });
    expect(r.scrolls[0]).toMatchObject({ from: "1:1", to: "1:5" });
  });

  it("rejects empty scrolls array", () => {
    expect(() => ProtoScrollInput.parse({ scrolls: [] })).toThrow();
  });
});

describe("ProtoBackInput", () => {
  it("accepts a minimal back (from only)", () => {
    const r = ProtoBackInput.parse({
      backs: [{ from: "1:1" }],
    });
    expect(r.backs[0]).toMatchObject({ from: "1:1" });
    expect(r.replaceExisting).toBe(false);
  });

  it("accepts trigger and motion overrides", () => {
    const r = ProtoBackInput.parse({
      backs: [{ from: "1:1", trigger: "ON_HOVER", motion: "HIG_SNAPPY" }],
      replaceExisting: true,
    });
    expect(r.backs[0]!.trigger).toBe("ON_HOVER");
    expect(r.backs[0]!.motion).toBe("HIG_SNAPPY");
    expect(r.replaceExisting).toBe(true);
  });

  it("rejects empty backs array", () => {
    expect(() => ProtoBackInput.parse({ backs: [] })).toThrow();
  });

  it("rejects missing `from`", () => {
    expect(() => ProtoBackInput.parse({ backs: [{}] })).toThrow();
  });
});

describe("ProtoUrlInput", () => {
  it("accepts a minimal url entry (from + url)", () => {
    const r = ProtoUrlInput.parse({
      urls: [{ from: "1:1", url: "https://figma.com" }],
    });
    expect(r.urls[0]).toMatchObject({ from: "1:1", url: "https://figma.com" });
    expect(r.replaceExisting).toBe(false);
  });

  it("accepts openInNewTab and trigger overrides", () => {
    const r = ProtoUrlInput.parse({
      urls: [{ from: "1:1", url: "https://figma.com", openInNewTab: true, trigger: "ON_HOVER" }],
    });
    expect(r.urls[0]!.openInNewTab).toBe(true);
    expect(r.urls[0]!.trigger).toBe("ON_HOVER");
  });

  it("rejects empty urls array", () => {
    expect(() => ProtoUrlInput.parse({ urls: [] })).toThrow();
  });

  it("rejects empty url string", () => {
    expect(() => ProtoUrlInput.parse({ urls: [{ from: "1:1", url: "" }] })).toThrow();
  });

  it("rejects unknown `motion` field on a url entry (strict)", () => {
    expect(() =>
      ProtoUrlInput.parse({
        urls: [{ from: "1:1", url: "https://figma.com", motion: "M3_EMPHASIZED" }],
      }),
    ).toThrow();
  });
});

describe("ProtoSetVariableInput", () => {
  it("accepts a minimal set (boolean value)", () => {
    const r = ProtoSetVariableInput.parse({
      sets: [{ from: "1:1", variable: "showMenu", value: true }],
    });
    expect(r.sets[0]).toMatchObject({ from: "1:1", variable: "showMenu", value: true });
    expect(r.replaceExisting).toBe(false);
  });

  it("accepts number value", () => {
    const r = ProtoSetVariableInput.parse({
      sets: [{ from: "1:1", variable: "score", value: 42 }],
    });
    expect(r.sets[0]!.value).toBe(42);
  });

  it("accepts string value (hex for COLOR variables)", () => {
    const r = ProtoSetVariableInput.parse({
      sets: [{ from: "1:1", variable: "bgColor", value: "#FF8800" }],
    });
    expect(r.sets[0]!.value).toBe("#FF8800");
  });

  it("accepts trigger override", () => {
    const r = ProtoSetVariableInput.parse({
      sets: [{ from: "1:1", variable: "showMenu", value: true, trigger: "ON_HOVER" }],
    });
    expect(r.sets[0]!.trigger).toBe("ON_HOVER");
  });

  it("rejects empty sets array", () => {
    expect(() => ProtoSetVariableInput.parse({ sets: [] })).toThrow();
  });

  it("rejects missing variable", () => {
    expect(() => ProtoSetVariableInput.parse({ sets: [{ from: "1:1", value: true }] })).toThrow();
  });

  it("rejects missing value", () => {
    expect(() => ProtoSetVariableInput.parse({ sets: [{ from: "1:1", variable: "x" }] })).toThrow();
  });

  it("rejects unknown `motion` field on a set entry (.strict)", () => {
    expect(() =>
      ProtoSetVariableInput.parse({
        sets: [{ from: "1:1", variable: "x", value: true, motion: "M3_EMPHASIZED" }],
      }),
    ).toThrow();
  });
});

describe("ProtoToggleVariableInput", () => {
  it("accepts a minimal toggle (from + variable)", () => {
    const r = ProtoToggleVariableInput.parse({
      toggles: [{ from: "1:1", variable: "showMenu" }],
    });
    expect(r.toggles[0]).toMatchObject({ from: "1:1", variable: "showMenu" });
    expect(r.replaceExisting).toBe(false);
  });

  it("accepts trigger override", () => {
    const r = ProtoToggleVariableInput.parse({
      toggles: [{ from: "1:1", variable: "showMenu", trigger: "ON_PRESS" }],
    });
    expect(r.toggles[0]!.trigger).toBe("ON_PRESS");
  });

  it("rejects empty toggles array", () => {
    expect(() => ProtoToggleVariableInput.parse({ toggles: [] })).toThrow();
  });

  it("rejects missing variable", () => {
    expect(() => ProtoToggleVariableInput.parse({ toggles: [{ from: "1:1" }] })).toThrow();
  });

  it("rejects unknown `motion` field on a toggle entry (.strict)", () => {
    expect(() =>
      ProtoToggleVariableInput.parse({
        toggles: [{ from: "1:1", variable: "showMenu", motion: "M3_EMPHASIZED" }],
      }),
    ).toThrow();
  });
});

describe("ProtoConditionalInput — happy paths", () => {
  it("accepts a minimal entry (then only, no else, operator default '==')", () => {
    const r = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { variable: "showMenu", value: true },
        then: { close: true },
      }],
    });
    expect((r.conditions[0]!.if as any).operator).toBe("==");
    expect((r.conditions[0]!.if as any).variable).toBe("showMenu");
    expect((r.conditions[0]!.if as any).value).toBe(true);
    expect(r.conditions[0]!.then).toEqual({ close: true });
    expect(r.conditions[0]!.else).toBeUndefined();
    expect(r.replaceExisting).toBe(false);
  });

  it("accepts an explicit operator '!='", () => {
    const r = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { variable: "step", operator: "!=", value: 1 },
        then: { back: true },
      }],
    });
    expect((r.conditions[0]!.if as any).operator).toBe("!=");
  });

  it("accepts each of the 6 comparison operators", () => {
    for (const op of ["==", "!=", "<", "<=", ">", ">="] as const) {
      const r = ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "n", operator: op, value: 5 },
          then: { back: true },
        }],
      });
      expect((r.conditions[0]!.if as any).operator).toBe(op);
    }
  });

  it("accepts each branch sugar key (8 keys) as then", () => {
    const branches = [
      { navigate: "frame:1" },
      { scroll: "node:1" },
      { overlay: "frame:1" },
      { swap: "frame:1" },
      { close: true as const },
      { back: true as const },
      { url: "https://example.com" },
      { set: { variable: "x", value: 1 } },
    ];
    for (const then of branches) {
      const r = ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "x", value: true },
          then,
        }],
      });
      expect(r.conditions[0]!.then).toMatchObject(then);
    }
  });

  it("accepts both then and else (different sugar keys allowed)", () => {
    const r = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        if: { variable: "loggedIn", value: true },
        then: { navigate: "home:1" },
        else: { navigate: "login:1" },
      }],
    });
    expect(r.conditions[0]!.then).toEqual({ navigate: "home:1" });
    expect(r.conditions[0]!.else).toEqual({ navigate: "login:1" });
  });

  it("accepts trigger override on the entry", () => {
    const r = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        trigger: "ON_HOVER",
        if: { variable: "x", value: true },
        then: { close: true },
      }],
    });
    expect(r.conditions[0]!.trigger).toBe("ON_HOVER");
  });

  it("accepts motion preset on the entry", () => {
    const r = ProtoConditionalInput.parse({
      conditions: [{
        from: "1:1",
        motion: "M3_STANDARD",
        if: { variable: "x", value: true },
        then: { navigate: "f:1" },
      }],
    });
    expect(r.conditions[0]!.motion).toBe("M3_STANDARD");
  });
});

describe("ProtoConditionalInput — rejections", () => {
  it("rejects empty conditions array", () => {
    expect(() =>
      ProtoConditionalInput.parse({ conditions: [] }),
    ).toThrow();
  });

  it("rejects missing then", () => {
    expect(() =>
      ProtoConditionalInput.parse({
        conditions: [{ from: "1:1", if: { variable: "x", value: true } }],
      }),
    ).toThrow();
  });

  it("rejects empty then object (no discriminator sugar key)", () => {
    expect(() =>
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "x", value: true },
          then: {},
        }],
      }),
    ).toThrow();
  });

  it("rejects unknown `motion` field inside a branch sugar (.strict)", () => {
    expect(() =>
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "x", value: true },
          then: { navigate: "f:1", motion: "M3_STANDARD" },
        }],
      }),
    ).toThrow();
  });

  it("rejects unknown `trigger` field inside a branch sugar (.strict)", () => {
    expect(() =>
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "x", value: true },
          then: { close: true, trigger: "ON_HOVER" },
        }],
      }),
    ).toThrow();
  });

  it("rejects unknown top-level entry field (.strict)", () => {
    expect(() =>
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "x", value: true },
          then: { close: true },
          unknown: "x",
        }],
      }),
    ).toThrow();
  });

  it("rejects invalid operator value", () => {
    expect(() =>
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "x", operator: "===", value: 1 },
          then: { close: true },
        }],
      }),
    ).toThrow();
  });

  it("rejects if.value of object/array type", () => {
    expect(() =>
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "x", value: { nested: true } },
          then: { close: true },
        }],
      }),
    ).toThrow();
  });

  it("rejects `close: false` (must be literal true)", () => {
    expect(() =>
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "x", value: true },
          then: { close: false },
        }],
      }),
    ).toThrow();
  });

  it("rejects then with two sugar keys (navigate + overlay) — strict prevents ambiguity", () => {
    expect(() =>
      ProtoConditionalInput.parse({
        conditions: [{
          from: "1:1",
          if: { variable: "x", value: true },
          then: { navigate: "f:1", overlay: "f:2" },
        }],
      }),
    ).toThrow();
  });
});

describe("ProtoWireInput fromScreen", () => {
  it("accepts an optional fromScreen", () => {
    const r = ProtoWireInput.parse({ wires: [{ from: "Submit", to: "Home", fromScreen: "Login" }] });
    expect(r.wires[0]!.fromScreen).toBe("Login");
  });
  it("works without fromScreen", () => {
    const r = ProtoWireInput.parse({ wires: [{ from: "1:1", to: "2:2" }] });
    expect(r.wires[0]!.fromScreen).toBeUndefined();
  });
});
