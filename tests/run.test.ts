import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/server/run.js";

describe("parseArgs", () => {
  it("defaults to sse when no flag is present", () => {
    expect(parseArgs([])).toEqual({ mode: "sse" });
    expect(parseArgs(["foo", "bar"])).toEqual({ mode: "sse" });
  });

  it("selects stdio when --stdio is present (any position)", () => {
    expect(parseArgs(["--stdio"])).toEqual({ mode: "stdio" });
    expect(parseArgs(["--x", "--stdio", "--y"])).toEqual({ mode: "stdio" });
  });
});
