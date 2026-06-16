import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  validateVariableLiteralCompat,
  buildCreateVariableValue,
} from "../src/figma-plugin/variable-literal.js";

describe("hexToRgb", () => {
  it("parses #000000 to all-zero with a=1", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("parses #FFFFFF to all-one with a=1", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("defaults a to 1 for 6-char hex", () => {
    expect(hexToRgb("#FF0000").a).toBe(1);
  });

  it("extracts alpha from 8-char hex (#FFFFFF80 ≈ 0.5)", () => {
    const { a } = hexToRgb("#FFFFFF80");
    expect(a).toBeCloseTo(128 / 255, 5);
  });

  it("parses channels independently (#102030)", () => {
    expect(hexToRgb("#102030")).toEqual({
      r: 16 / 255,
      g: 32 / 255,
      b: 48 / 255,
      a: 1,
    });
  });

  it("is case-insensitive (#ffffff === #FFFFFF)", () => {
    expect(hexToRgb("#ffffff")).toEqual(hexToRgb("#FFFFFF"));
  });
});

describe("rgbToHex", () => {
  it("serializes opaque black to #000000 (alpha hidden when a≈1)", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe("#000000");
  });

  it("serializes opaque white to #FFFFFF", () => {
    expect(rgbToHex({ r: 1, g: 1, b: 1 })).toBe("#FFFFFF");
  });

  it("hides alpha when a is undefined", () => {
    expect(rgbToHex({ r: 1, g: 0, b: 0 })).toBe("#FF0000");
  });

  it("emits #RRGGBBAA when alpha is not ≈1", () => {
    expect(rgbToHex({ r: 1, g: 1, b: 1, a: 128 / 255 })).toBe("#FFFFFF80");
  });

  it("clamps out-of-range channels", () => {
    expect(rgbToHex({ r: 2, g: -1, b: 0 })).toBe("#FF0000");
  });

  it("round-trips a hex through rgb and back", () => {
    expect(rgbToHex(hexToRgb("#1A2B3C"))).toBe("#1A2B3C");
    expect(rgbToHex(hexToRgb("#1A2B3C80"))).toBe("#1A2B3C80");
  });
});

describe("validateVariableLiteralCompat — matching types", () => {
  it("BOOLEAN accepts a boolean", () => {
    expect(validateVariableLiteralCompat({ name: "b", resolvedType: "BOOLEAN" }, true, "assignment"))
      .toEqual({ type: "BOOLEAN", resolvedType: "BOOLEAN", value: true });
  });

  it("FLOAT accepts a number", () => {
    expect(validateVariableLiteralCompat({ name: "n", resolvedType: "FLOAT" }, 42, "comparison"))
      .toEqual({ type: "FLOAT", resolvedType: "FLOAT", value: 42 });
  });

  it("STRING accepts a string", () => {
    expect(validateVariableLiteralCompat({ name: "s", resolvedType: "STRING" }, "hi", "assignment"))
      .toEqual({ type: "STRING", resolvedType: "STRING", value: "hi" });
  });

  it("COLOR accepts a hex string in assignment context and parses to RGBA", () => {
    expect(validateVariableLiteralCompat({ name: "c", resolvedType: "COLOR" }, "#FF0000", "assignment"))
      .toEqual({ type: "COLOR", resolvedType: "COLOR", value: { r: 1, g: 0, b: 0, a: 1 } });
  });

  it("COLOR accepts an 8-char hex (with alpha) in assignment", () => {
    const r = validateVariableLiteralCompat({ name: "c", resolvedType: "COLOR" }, "#00FF0080", "assignment") as {
      value: { a: number };
    };
    expect(r.value.a).toBeCloseTo(128 / 255, 5);
  });
});

describe("validateVariableLiteralCompat — rejections", () => {
  it("BOOLEAN rejects a number", () => {
    expect(() => validateVariableLiteralCompat({ name: "b", resolvedType: "BOOLEAN" }, 1, "assignment"))
      .toThrow(/is BOOLEAN; cannot assign number/);
  });

  it("FLOAT rejects a string", () => {
    expect(() => validateVariableLiteralCompat({ name: "n", resolvedType: "FLOAT" }, "x", "comparison"))
      .toThrow(/is FLOAT; cannot compare against string/);
  });

  it("STRING rejects a boolean", () => {
    expect(() => validateVariableLiteralCompat({ name: "s", resolvedType: "STRING" }, true, "assignment"))
      .toThrow(/is STRING; cannot assign boolean/);
  });

  it("COLOR rejects comparison context entirely", () => {
    expect(() => validateVariableLiteralCompat({ name: "c", resolvedType: "COLOR" }, "#FFFFFF", "comparison"))
      .toThrow(/COLOR; conditional comparison against COLOR/);
  });

  it("COLOR rejects a non-string value in assignment", () => {
    expect(() => validateVariableLiteralCompat({ name: "c", resolvedType: "COLOR" }, 123, "assignment"))
      .toThrow(/COLOR; cannot assign number literal \(expected hex string\)/);
  });

  it("COLOR rejects an invalid hex string", () => {
    expect(() => validateVariableLiteralCompat({ name: "c", resolvedType: "COLOR" }, "#GGG", "assignment"))
      .toThrow(/must be a hex string like #RRGGBB/);
  });

  it("uses the variable name in the error message", () => {
    expect(() => validateVariableLiteralCompat({ name: "myVar", resolvedType: "BOOLEAN" }, 1, "assignment"))
      .toThrow(/"myVar"/);
  });
});

describe("buildCreateVariableValue", () => {
  it("returns type defaults when value omitted", () => {
    expect(buildCreateVariableValue("flag", "BOOLEAN")).toBe(false);
    expect(buildCreateVariableValue("count", "FLOAT")).toBe(0);
    expect(buildCreateVariableValue("label", "STRING")).toBe("");
    expect(buildCreateVariableValue("tint", "COLOR")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("passes provided values through validateVariableLiteralCompat", () => {
    expect(buildCreateVariableValue("flag", "BOOLEAN", true)).toBe(true);
    expect(buildCreateVariableValue("count", "FLOAT", 3)).toBe(3);
    expect(buildCreateVariableValue("label", "STRING", "hi")).toBe("hi");
    expect(buildCreateVariableValue("tint", "COLOR", "#FF0000")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it("rejects a value whose type mismatches the variable type", () => {
    expect(() => buildCreateVariableValue("flag", "BOOLEAN", "true")).toThrow(/cannot assign string/);
    expect(() => buildCreateVariableValue("tint", "COLOR", "nothex")).toThrow(/hex string/);
  });
});
