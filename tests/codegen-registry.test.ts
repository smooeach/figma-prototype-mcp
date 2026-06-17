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

import { emitReactNative as _rn } from "../src/codegen/emitters/react-native.js"; // ensure module resolves
describe("registry react-native", () => {
  it("exposes react-native and runs it", () => {
    expect(EMITTER_TARGETS).toContain("react-native");
    const files = runEmitter("react-native", SPEC);
    expect(files.some((f) => f.path === "navigation.tsx")).toBe(true);
  });
});

describe("registry swiftui", () => {
  it("exposes swiftui and runs it", () => {
    expect(EMITTER_TARGETS).toContain("swiftui");
    const files = runEmitter("swiftui", SPEC);
    expect(files.some((f) => f.path === "Router.swift")).toBe(true);
  });
});
