import { describe, it, expect } from "vitest";
import {
  GetCanvasOverviewInput,
  FindNodesInput,
  CreateNavigateReactionsInput,
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

describe("CreateNavigateReactionsInput", () => {
  it("accepts a single connection with defaults", () => {
    const r = CreateNavigateReactionsInput.parse({
      connections: [{ sourceNodeId: "1:1", targetFrameId: "1:2" }],
    });
    expect(r.connections[0]!.trigger).toBe("ON_CLICK");
    expect(r.connections[0]!.transition).toBe("INSTANT");
    expect(r.replaceExisting).toBe(false);
  });
  it("rejects empty connections", () => {
    expect(() => CreateNavigateReactionsInput.parse({ connections: [] })).toThrow();
  });
  it("rejects invalid trigger", () => {
    expect(() =>
      CreateNavigateReactionsInput.parse({
        connections: [{ sourceNodeId: "a", targetFrameId: "b", trigger: "ON_LONG_PRESS" }],
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
