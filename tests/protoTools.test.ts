import { describe, it, expect } from "vitest";
import {
  ProtoWireInput,
  ProtoOverlayInput,
  ProtoScrollInput,
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
