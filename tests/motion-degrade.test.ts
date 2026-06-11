import { describe, it, expect } from "vitest";
import { resolveNavigateTransition } from "../src/figma-plugin/motion-degrade.js";
import type { NodeLike } from "../src/figma-plugin/node-tree.js";

const page: NodeLike = { id: "p", name: "Page", type: "PAGE", parent: null };
function screen(name: string, layers: string[]): NodeLike {
  const frame: NodeLike = { id: name, name, type: "FRAME", parent: page, children: [] };
  (frame as unknown as { children: NodeLike[] }).children = layers.map((n, i) => ({
    id: `${name}-${i}`, name: n, type: "TEXT", parent: frame,
  }));
  return frame;
}

describe("resolveNavigateTransition", () => {
  it("degrades SMART_ANIMATE to DISSOLVE when frames share no layers", () => {
    const home = screen("home", ["HomeTitle", "HomeList"]);
    const detail = screen("detail", ["DetailHeader", "DetailBody"]);
    const btn: NodeLike = { id: "btn", name: "Btn", type: "INSTANCE", parent: home };
    const r = resolveNavigateTransition({ source: btn, destFrame: detail, transition: "SMART_ANIMATE", degradeTo: undefined });
    expect(r.transition).toBe("DISSOLVE");
    expect(r.warning).toContain("no matching layers");
  });
  it("honours degradeTo INSTANT", () => {
    const a = screen("a", ["X"]);
    const b = screen("b", ["Y"]);
    const btn: NodeLike = { id: "btn", name: "Btn", type: "INSTANCE", parent: a };
    expect(resolveNavigateTransition({ source: btn, destFrame: b, transition: "SMART_ANIMATE", degradeTo: "INSTANT" }).transition).toBe("INSTANT");
  });
  it("keeps SMART_ANIMATE when frames share a layer", () => {
    const a = screen("a", ["NavBar", "BodyA"]);
    const b = screen("b", ["NavBar", "BodyB"]);
    const btn: NodeLike = { id: "btn", name: "Btn", type: "INSTANCE", parent: a };
    const r = resolveNavigateTransition({ source: btn, destFrame: b, transition: "SMART_ANIMATE", degradeTo: undefined });
    expect(r.transition).toBe("SMART_ANIMATE");
    expect(r.warning).toBeUndefined();
  });
  it("leaves non-SMART_ANIMATE transitions untouched", () => {
    const a = screen("a", ["X"]);
    const b = screen("b", ["Y"]);
    const btn: NodeLike = { id: "btn", name: "Btn", type: "INSTANCE", parent: a };
    expect(resolveNavigateTransition({ source: btn, destFrame: b, transition: "DISSOLVE", degradeTo: undefined }).transition).toBe("DISSOLVE");
  });
  it("does not degrade when the source has no top-level frame", () => {
    const orphan: NodeLike = { id: "o", name: "O", type: "TEXT", parent: null };
    const b = screen("b", ["Y"]);
    const r = resolveNavigateTransition({ source: orphan, destFrame: b, transition: "SMART_ANIMATE", degradeTo: undefined });
    expect(r.transition).toBe("SMART_ANIMATE");
  });
});
