import { describe, it, expect } from "vitest";
import {
  findEnclosingFrameId,
  hasReactions,
  findScrollableAncestor,
  pathOf,
  findTopLevelFrameNode,
  collectDescendantLayerNames,
  framesShareLayer,
  type NodeLike,
} from "../src/figma-plugin/node-tree.js";

// Build a top-down chain: doc -> frame -> child
const doc: NodeLike = { id: "0", name: "Document", type: "DOCUMENT", parent: null };
const frame: NodeLike = { id: "f1", name: "Frame", type: "FRAME", parent: doc };
const child: NodeLike = { id: "c1", name: "Child", type: "TEXT", parent: frame };

describe("findEnclosingFrameId", () => {
  it("returns the nearest FRAME ancestor id", () => {
    expect(findEnclosingFrameId(child)).toBe("f1");
  });
  it("returns null when no FRAME ancestor exists", () => {
    expect(findEnclosingFrameId(frame)).toBe(null); // frame's only ancestor is the DOCUMENT
  });
});

describe("hasReactions", () => {
  it("is true for a non-empty reactions array", () => {
    expect(hasReactions({ id: "a", name: "a", type: "TEXT", parent: null, reactions: [{}] })).toBe(true);
  });
  it("is false for an empty reactions array", () => {
    expect(hasReactions({ id: "a", name: "a", type: "TEXT", parent: null, reactions: [] })).toBe(false);
  });
  it("is false when reactions is absent", () => {
    expect(hasReactions({ id: "a", name: "a", type: "TEXT", parent: null })).toBe(false);
  });
});

describe("findScrollableAncestor", () => {
  it("returns the nearest ancestor whose overflowDirection is not NONE", () => {
    const scroll: NodeLike = { id: "s1", name: "Scroll", type: "FRAME", parent: doc, overflowDirection: "VERTICAL" };
    const leaf: NodeLike = { id: "l1", name: "Leaf", type: "TEXT", parent: scroll };
    expect(findScrollableAncestor(leaf)).toBe(scroll);
  });
  it("skips ancestors with overflowDirection NONE and returns null when none scroll", () => {
    const noscroll: NodeLike = { id: "n1", name: "NoScroll", type: "FRAME", parent: doc, overflowDirection: "NONE" };
    const leaf: NodeLike = { id: "l2", name: "Leaf", type: "TEXT", parent: noscroll };
    expect(findScrollableAncestor(leaf)).toBe(null);
  });
});

describe("pathOf", () => {
  it("joins names from the node up to (but excluding) the DOCUMENT", () => {
    expect(pathOf(child)).toBe("Frame > Child");
  });
});

describe("findTopLevelFrameNode", () => {
  const page: NodeLike = { id: "p", name: "Page", type: "PAGE", parent: null };
  const screen: NodeLike = { id: "s", name: "Screen", type: "FRAME", parent: page };
  const inner: NodeLike = { id: "i", name: "Inner", type: "FRAME", parent: screen };
  const btn: NodeLike = { id: "b", name: "Btn", type: "INSTANCE", parent: inner };

  it("returns the frame whose parent is a PAGE", () => {
    expect(findTopLevelFrameNode(btn)).toBe(screen);
  });
  it("treats a SECTION parent as top-level too", () => {
    const section: NodeLike = { id: "sec", name: "Sec", type: "SECTION", parent: page };
    const f: NodeLike = { id: "f", name: "F", type: "FRAME", parent: section };
    const leaf: NodeLike = { id: "l", name: "L", type: "TEXT", parent: f };
    expect(findTopLevelFrameNode(leaf)).toBe(f);
  });
  it("returns null when no frame has a PAGE/SECTION parent", () => {
    const orphan: NodeLike = { id: "o", name: "O", type: "TEXT", parent: null };
    expect(findTopLevelFrameNode(orphan)).toBe(null);
  });
});

describe("collectDescendantLayerNames", () => {
  it("gathers all descendant names, excluding the node itself", () => {
    const leafA: NodeLike = { id: "a", name: "Title", type: "TEXT", parent: null };
    const leafB: NodeLike = { id: "b", name: "CTA", type: "TEXT", parent: null };
    const frame: NodeLike = { id: "f", name: "Frame", type: "FRAME", parent: null, children: [leafA, leafB] };
    expect(collectDescendantLayerNames(frame)).toEqual(new Set(["Title", "CTA"]));
  });
  it("recurses into nested children", () => {
    const deep: NodeLike = { id: "d", name: "Deep", type: "TEXT", parent: null };
    const mid: NodeLike = { id: "m", name: "Mid", type: "GROUP", parent: null, children: [deep] };
    const frame: NodeLike = { id: "f", name: "Frame", type: "FRAME", parent: null, children: [mid] };
    expect(collectDescendantLayerNames(frame)).toEqual(new Set(["Mid", "Deep"]));
  });
  it("returns an empty set for a childless node", () => {
    expect(collectDescendantLayerNames({ id: "x", name: "X", type: "FRAME", parent: null })).toEqual(new Set());
  });
});

describe("framesShareLayer", () => {
  const mk = (names: string[]): NodeLike => ({
    id: "f", name: "F", type: "FRAME", parent: null,
    children: names.map((n, i) => ({ id: `c${i}`, name: n, type: "TEXT", parent: null })),
  });
  it("is true when a descendant name is shared", () => {
    expect(framesShareLayer(mk(["Header", "Body"]), mk(["Header", "Footer"]))).toBe(true);
  });
  it("is false when no descendant name is shared", () => {
    expect(framesShareLayer(mk(["A", "B"]), mk(["C", "D"]))).toBe(false);
  });
});
