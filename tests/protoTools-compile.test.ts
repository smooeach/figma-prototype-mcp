import { describe, it, expect } from "vitest";
import {
  ProtoWireInput,
  ProtoOverlayInput,
  ProtoScrollInput,
  compileProtoWire,
  compileProtoOverlay,
  compileProtoScroll,
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
