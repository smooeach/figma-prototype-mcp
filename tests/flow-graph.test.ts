import { describe, it, expect } from "vitest";
import { assembleFlowGraph } from "../src/figma-plugin/flow-graph.js";

const page = { id: "1:1", name: "Flow" };
const frames = [
  { id: "1:10", name: "login", isStartFrame: true },
  { id: "1:20", name: "home", isStartFrame: false },
];

describe("assembleFlowGraph", () => {
  it("resolves frameName from frameId and passes interactions through", () => {
    const out = assembleFlowGraph({
      page, frames, limit: 500,
      interactions: [
        { frameId: "1:10", sourceNodeId: "1:11", sourceNodeName: "loginBtn", trigger: { type: "ON_CLICK" }, action: { type: "NODE", navigation: "NAVIGATE", destinationId: "1:20" } },
      ],
    });
    expect(out).toEqual({
      page, frames, truncated: false,
      interactions: [
        { frameId: "1:10", frameName: "login", sourceNodeId: "1:11", sourceNodeName: "loginBtn", trigger: { type: "ON_CLICK" }, action: { type: "NODE", navigation: "NAVIGATE", destinationId: "1:20" } },
      ],
    });
  });

  it("sets frameName null when frameId is null or unknown", () => {
    const out = assembleFlowGraph({
      page, frames, limit: 500,
      interactions: [
        { frameId: null, sourceNodeId: "1:99", sourceNodeName: "loose", trigger: {}, action: {} },
        { frameId: "9:99", sourceNodeId: "1:98", sourceNodeName: "orphan", trigger: {}, action: {} },
      ],
    });
    expect(out.interactions[0]!.frameName).toBeNull();
    expect(out.interactions[1]!.frameName).toBeNull();
  });

  it("applies limit and sets truncated", () => {
    const mk = (i: number) => ({ frameId: "1:10", sourceNodeId: `n${i}`, sourceNodeName: `n${i}`, trigger: {}, action: {} });
    const out = assembleFlowGraph({ page, frames, limit: 2, interactions: [mk(1), mk(2), mk(3)] });
    expect(out.interactions).toHaveLength(2);
    expect(out.truncated).toBe(true);
  });

  it("handles empty interactions", () => {
    const out = assembleFlowGraph({ page, frames, limit: 500, interactions: [] });
    expect(out.interactions).toEqual([]);
    expect(out.truncated).toBe(false);
  });
});
