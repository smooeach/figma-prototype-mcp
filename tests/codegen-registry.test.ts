import { describe, it, expect } from "vitest";
import { runEmitter, EMITTER_TARGETS } from "../src/codegen/registry.js";

const SPEC = {
  schemaVersion: "1.0" as const,
  page: { id: "p1", name: "Page 1" },
  screens: [{ id: "1:1", name: "Home", interactions: [] }],
  requestedScreens: ["1:1"],
  missingScreens: [],
  unsupported: [],
  truncated: false,
};

describe("registry", () => {
  it("exposes react as a target", () => {
    expect(EMITTER_TARGETS).toContain("react");
  });
  it("runEmitter('react') returns files", () => {
    const files = runEmitter("react", SPEC);
    expect(files.some((f) => f.path === "routes.tsx")).toBe(true);
  });
  it("throws on an unknown target", () => {
    expect(() => runEmitter("vue", SPEC)).toThrow(/unknown target/i);
  });
});
