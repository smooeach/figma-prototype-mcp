import { describe, it, expect } from "vitest";
import {
  findEnclosingFrameId,
  hasReactions,
  findScrollableAncestor,
  pathOf,
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
