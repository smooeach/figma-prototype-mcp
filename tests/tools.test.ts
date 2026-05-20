import { describe, it, expect } from "vitest";
import {
  GetCanvasOverviewInput,
  FindNodesInput,
  CreateReactionsInput,
  ListReactionsInput,
  ClearReactionsInput,
} from "../src/mcp-server/tools.js";

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
