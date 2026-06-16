import { describe, it, expect } from "vitest";
import {
  buildScreenIdentities,
  collectVariables,
  renderCondition,
  emitStore,
} from "../src/codegen/emitters/react-shared.js";

const SPEC = {
  schemaVersion: "1.0" as const,
  page: { id: "p", name: "P" },
  screens: [
    { id: "9:1", name: "Home", interactions: [
      { source: { id: "n1", name: "Flip" }, trigger: { type: "ON_CLICK" }, actions: [{ type: "toggleVariable", variable: "isOpen" }] },
    ] },
    { id: "9:2", name: "Home", interactions: [] },
  ],
  requestedScreens: ["9:1", "9:2"], missingScreens: [], unsupported: [], truncated: false,
};

describe("react-shared", () => {
  it("collectVariables gathers names", () => {
    expect(collectVariables(SPEC as any)).toEqual(["isOpen"]);
  });
  it("buildScreenIdentities dedups duplicate names", () => {
    const m = buildScreenIdentities(SPEC as any);
    expect(m.get("9:1")!.component).not.toBe(m.get("9:2")!.component);
  });
  it("renderCondition maps real operators", () => {
    expect(renderCondition({ variable: "c", operator: "!=", value: 0 })).toBe('vars["c"] !== 0');
    expect(renderCondition({ variable: "c", operator: ">=", value: 3 })).toBe('vars["c"] >= 3');
  });
  it("emitStore emits the context", () => {
    expect(emitStore(SPEC as any)).toContain("useProtoStore");
  });
});
