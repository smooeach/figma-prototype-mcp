import { describe, it, expect } from "vitest";
import { analyzeFlow } from "../src/server/validate-flow.js";

const clean = {
  page: { id: "0:1", name: "Flow" },
  frames: [
    { id: "A", name: "Home", isStartFrame: true },
    { id: "B", name: "Detail", isStartFrame: false },
  ],
  interactions: [
    { frameId: "A", sourceNodeId: "a1", sourceNodeName: "btn", trigger: { type: "ON_CLICK" },
      actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: "B", destinationName: "Detail" }] },
    { frameId: "B", sourceNodeId: "b1", sourceNodeName: "back", trigger: { type: "ON_CLICK" },
      actions: [{ type: "BACK" }] },
  ],
  truncated: false,
};

describe("analyzeFlow — broken-reference & start-frame", () => {
  it("clean two-frame flow has no issues and ok:true", () => {
    const r = analyzeFlow(clean);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.summary).toEqual({ errors: 0, warnings: 0, frames: 2, interactions: 2 });
    expect(r.page).toEqual({ id: "0:1", name: "Flow" });
    expect(r.truncated).toBe(false);
  });

  it("flags a navigate to a non-existent frame as broken-reference error", () => {
    const flow = {
      ...clean,
      interactions: [
        { frameId: "A", sourceNodeId: "a1", sourceNodeName: "btn", trigger: { type: "ON_CLICK" },
          actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: "GHOST", destinationName: "Gone" }] },
      ],
    };
    const r = analyzeFlow(flow);
    const broken = r.issues.filter((i) => i.rule === "broken-reference");
    expect(broken).toHaveLength(1);
    expect(broken[0]).toMatchObject({ severity: "error", frameId: "A", sourceNodeId: "a1" });
    expect(r.ok).toBe(false);
  });

  it("flags zero start frames as a start-frame warning", () => {
    const flow = {
      ...clean,
      frames: [
        { id: "A", name: "Home", isStartFrame: false },
        { id: "B", name: "Detail", isStartFrame: false },
      ],
    };
    const r = analyzeFlow(flow);
    const sf = r.issues.filter((i) => i.rule === "start-frame");
    expect(sf).toHaveLength(1);
    expect(sf[0]!.severity).toBe("warning");
  });

  it("flags multiple start frames as a start-frame warning", () => {
    const flow = {
      ...clean,
      frames: [
        { id: "A", name: "Home", isStartFrame: true },
        { id: "B", name: "Detail", isStartFrame: true },
      ],
    };
    const r = analyzeFlow(flow);
    const sf = r.issues.filter((i) => i.rule === "start-frame");
    expect(sf).toHaveLength(1);
    expect(sf[0]!.message).toContain("2");
  });

  it("does NOT flag changeVariant or scrollTo as broken-reference", () => {
    const flow = {
      ...clean,
      interactions: [
        { frameId: "A", sourceNodeId: "a1", sourceNodeName: "tab", trigger: { type: "ON_CLICK" },
          actions: [{ type: "NODE", navigation: "CHANGE_TO", destinationId: "VARIANT", destinationName: "v2" }] },
        { frameId: "B", sourceNodeId: "b1", sourceNodeName: "list", trigger: { type: "ON_CLICK" },
          actions: [{ type: "NODE", navigation: "SCROLL_TO", destinationId: "INNER", destinationName: "row" }] },
      ],
    };
    const r = analyzeFlow(flow);
    expect(r.issues.filter((i) => i.rule === "broken-reference")).toEqual([]);
  });
});

describe("analyzeFlow — unreachable", () => {
  const base = {
    page: { id: "0:1", name: "Flow" },
    frames: [
      { id: "A", name: "Home", isStartFrame: true },
      { id: "B", name: "Detail", isStartFrame: false },
      { id: "C", name: "Orphan", isStartFrame: false },
    ],
    interactions: [
      { frameId: "A", sourceNodeId: "a1", sourceNodeName: "btn", trigger: { type: "ON_CLICK" },
        actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: "B", destinationName: "Detail" }] },
    ],
    truncated: false,
  };

  it("flags a frame not reachable from any start frame as unreachable error", () => {
    const r = analyzeFlow(base);
    const un = r.issues.filter((i) => i.rule === "unreachable");
    expect(un).toHaveLength(1);
    expect(un[0]).toMatchObject({ severity: "error", frameId: "C" });
  });

  it("does NOT flag the start frame itself as unreachable", () => {
    const r = analyzeFlow(base);
    expect(r.issues.filter((i) => i.rule === "unreachable" && i.frameId === "A")).toEqual([]);
  });

  it("skips the unreachable check entirely when there are zero start frames", () => {
    const flow = { ...base, frames: base.frames.map((f) => ({ ...f, isStartFrame: false })) };
    const r = analyzeFlow(flow);
    expect(r.issues.filter((i) => i.rule === "unreachable")).toEqual([]);
  });

  it("reaches frames via conditional then/else branches", () => {
    const flow = {
      ...base,
      interactions: [
        { frameId: "A", sourceNodeId: "a1", sourceNodeName: "btn", trigger: { type: "ON_CLICK" },
          actions: [{ type: "CONDITIONAL",
            condition: { variable: "x", operator: "EQ", value: true },
            then: [{ type: "NODE", navigation: "NAVIGATE", destinationId: "B", destinationName: "Detail" }],
            else: [{ type: "NODE", navigation: "NAVIGATE", destinationId: "C", destinationName: "Orphan" }] }] },
      ],
    };
    const r = analyzeFlow(flow);
    expect(r.issues.filter((i) => i.rule === "unreachable")).toEqual([]);
  });
});
