import { describe, it, expect } from "vitest";
import { selectModeMatch, type CollectionModesDescriptor } from "../src/figma-plugin/mode-catalog.js";

const cols: CollectionModesDescriptor[] = [
  { id: "c1", name: "Theme", modes: [
    { name: "Light", modeId: "m1", isDefault: true }, { name: "Dark", modeId: "m2", isDefault: false } ] },
  { id: "c2", name: "Density", modes: [
    { name: "Comfortable", modeId: "m3", isDefault: true }, { name: "Compact", modeId: "m4", isDefault: false } ] },
];

describe("selectModeMatch", () => {
  it("resolves a unique mode name without a collection", () => {
    expect(selectModeMatch(cols, "Dark")).toEqual({ kind: "match", collectionId: "c1", modeId: "m2" });
  });
  it("resolves within a named collection", () => {
    expect(selectModeMatch(cols, "Compact", "Density")).toEqual({ kind: "match", collectionId: "c2", modeId: "m4" });
  });
  it("not_found when no collection has the mode", () => {
    expect(selectModeMatch(cols, "Sepia").kind).toBe("not_found");
  });
  it("not_found when the named collection lacks the mode", () => {
    expect(selectModeMatch(cols, "Dark", "Density").kind).toBe("not_found");
  });
  it("not_found when the named collection does not exist", () => {
    expect(selectModeMatch(cols, "Dark", "Nope").kind).toBe("not_found");
  });
  it("ambiguous when two collections share a mode name and no collection is given", () => {
    const dup: CollectionModesDescriptor[] = [
      { id: "a", name: "A", modes: [{ name: "On", modeId: "x", isDefault: true }] },
      { id: "b", name: "B", modes: [{ name: "On", modeId: "y", isDefault: true }] },
    ];
    const r = selectModeMatch(dup, "On");
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") { expect(r.message).toContain("A"); expect(r.message).toContain("B"); }
  });
});
