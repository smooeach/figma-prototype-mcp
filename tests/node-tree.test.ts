import { describe, it, expect } from "vitest";
import {
  findEnclosingFrameId,
  hasReactions,
  findScrollableAncestor,
  pathOf,
  findTopLevelFrameNode,
  isScreenFrame,
  collectDescendantLayerPaths,
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

describe("isScreenFrame", () => {
  const page: NodeLike = { id: "p", name: "Page", type: "PAGE", parent: null };
  it("is true for a FRAME directly under the PAGE", () => {
    expect(isScreenFrame({ id: "s", name: "S", type: "FRAME", parent: page })).toBe(true);
  });
  it("is true for a FRAME inside a SECTION (the bug: must not be missed)", () => {
    const section: NodeLike = { id: "sec", name: "Sec", type: "SECTION", parent: page };
    expect(isScreenFrame({ id: "s", name: "S", type: "FRAME", parent: section })).toBe(true);
  });
  it("is false for a FRAME nested inside another FRAME (an element, not a screen)", () => {
    const screen: NodeLike = { id: "s", name: "S", type: "FRAME", parent: page };
    expect(isScreenFrame({ id: "inner", name: "Inner", type: "FRAME", parent: screen })).toBe(false);
  });
  it("is false for a non-FRAME node", () => {
    expect(isScreenFrame({ id: "t", name: "T", type: "TEXT", parent: page })).toBe(false);
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

  // Hierarchy-aware matching: a shared name only counts when its ancestor path
  // (relative to the frame, excluding the frame's own name) also matches —
  // mirroring how Smart Animate has nothing meaningful to morph between two
  // same-named layers nested under differently-named parents.
  const nest = (parent: string, leaf: string): NodeLike => {
    const frame: NodeLike = { id: "f", name: "F", type: "FRAME", parent: null };
    const inner: NodeLike = { id: "in", name: parent, type: "FRAME", parent: frame };
    (inner as unknown as { children: NodeLike[] }).children = [{ id: "lf", name: leaf, type: "TEXT", parent: inner }];
    (frame as unknown as { children: NodeLike[] }).children = [inner];
    return frame;
  };
  it("is false when a shared leaf name sits under differently-named parents", () => {
    expect(framesShareLayer(nest("innerA", "label"), nest("innerB", "label"))).toBe(false);
  });
  it("is true when a shared leaf name sits under the same-named parent path", () => {
    expect(framesShareLayer(nest("content", "label"), nest("content", "label"))).toBe(true);
  });
  it("is true when an intermediate container name matches (Smart Animate morphs it)", () => {
    expect(framesShareLayer(nest("shared", "leafA"), nest("shared", "leafB"))).toBe(true);
  });
});

describe("collectDescendantLayerPaths", () => {
  it("returns each descendant's path relative to the node (frame name excluded)", () => {
    const frame: NodeLike = { id: "f", name: "Screen", type: "FRAME", parent: null };
    const inner: NodeLike = { id: "in", name: "Card", type: "FRAME", parent: frame };
    (inner as unknown as { children: NodeLike[] }).children = [{ id: "t", name: "Title", type: "TEXT", parent: inner }];
    (frame as unknown as { children: NodeLike[] }).children = [inner];
    expect(collectDescendantLayerPaths(frame)).toEqual(new Set(["Card", "Card/Title"]));
  });
  it("returns an empty set for a childless node", () => {
    expect(collectDescendantLayerPaths({ id: "x", name: "X", type: "FRAME", parent: null })).toEqual(new Set());
  });
});
