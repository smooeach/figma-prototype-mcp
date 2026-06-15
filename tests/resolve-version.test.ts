import { describe, it, expect } from "vitest";
import { resolveVersion } from "../src/server/run.js";

describe("resolveVersion", () => {
  it("prefers the build-injected version when present", () => {
    expect(resolveVersion("1.2.3", () => "9.9.9")).toBe("1.2.3");
  });

  it("reads package.json when no injected version", () => {
    expect(resolveVersion(undefined, () => "0.32.0")).toBe("0.32.0");
  });

  it("falls back to 0.0.0 when the read throws", () => {
    expect(resolveVersion(undefined, () => { throw new Error("no package.json"); })).toBe("0.0.0");
  });
});
