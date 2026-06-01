// Pure "variable literal" logic: check a JS literal against a Figma variable's
// resolvedType and coerce it into Figma VariableData. No `figma.*` API access —
// callers resolve the variable first and pass a minimal descriptor, so this
// module is unit-testable without the Figma sandbox.

export type VariableResolvedType = "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";

/** The minimal variable info this module needs (a subset of Figma's Variable). */
export interface VariableDescriptor {
  name: string;
  resolvedType: VariableResolvedType;
}

/** Whether the literal is being assigned (Set Variable) or compared (Conditional). */
export type LiteralContext = "comparison" | "assignment";

/** Figma VariableData for a validated literal. */
export type LiteralVariableData =
  | { type: "BOOLEAN"; resolvedType: "BOOLEAN"; value: boolean }
  | { type: "FLOAT"; resolvedType: "FLOAT"; value: number }
  | { type: "STRING"; resolvedType: "STRING"; value: string }
  | { type: "COLOR"; resolvedType: "COLOR"; value: { r: number; g: number; b: number; a: number } };

const HEX_REGEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

/**
 * Parse a hex string (#RRGGBB or #RRGGBBAA) into Figma's RGBA float shape.
 * Caller must validate against HEX_REGEX before calling.
 *
 * Figma's runtime requires the `a` field on COLOR VariableData even though
 * typings declare it optional — so 6-char inputs default `a` to 1.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.slice(1);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const a = clean.length === 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

/**
 * Serialize an RGBA float object to a hex string.
 * When a ≈ 1 (rounds to 255), emits #RRGGBB (alpha hidden).
 * Otherwise emits #RRGGBBAA.
 */
export function rgbToHex(rgb: { r: number; g: number; b: number; a?: number }): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n * 255))).toString(16).padStart(2, "0").toUpperCase();
  const base = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  if (rgb.a === undefined || Math.round(rgb.a * 255) === 255) return base;
  return base + toHex(rgb.a);
}

/**
 * Validate that a JS literal's type matches a variable's resolvedType and return
 * the corresponding VariableData wrapping. Throws with a precise message on
 * mismatch or unsupported variable type. Shared by conditional's comparison and
 * set_variable's assignment paths.
 *
 * COLOR variables accept hex string values (#RRGGBB or #RRGGBBAA) in assignment
 * context. Conditional comparison against COLOR is rejected (v1.18 non-goal —
 * exact float matching is fragile and uncommon in prototypes).
 */
export function validateVariableLiteralCompat(
  variable: VariableDescriptor,
  value: boolean | number | string,
  context: LiteralContext,
): LiteralVariableData {
  const valueType = typeof value;

  if (variable.resolvedType === "COLOR") {
    if (context === "comparison") {
      throw new Error(`Variable "${variable.name}" is COLOR; conditional comparison against COLOR variables is not supported in v1.18 (use BOOLEAN/FLOAT/STRING for condition.value)`);
    }
    // assignment context
    if (valueType !== "string") {
      throw new Error(`Variable "${variable.name}" is COLOR; cannot assign ${valueType} literal (expected hex string)`);
    }
    if (!HEX_REGEX.test(value as string)) {
      throw new Error(`Variable "${variable.name}" is COLOR; value must be a hex string like #RRGGBB or #RRGGBBAA (got "${value}")`);
    }
    return { type: "COLOR", resolvedType: "COLOR", value: hexToRgb(value as string) };
  }

  const expected =
    variable.resolvedType === "BOOLEAN" ? "boolean"
    : variable.resolvedType === "FLOAT" ? "number"
    : variable.resolvedType === "STRING" ? "string"
    : "unknown";
  if (expected === "unknown") {
    throw new Error(`Variable "${variable.name}" has unsupported type ${variable.resolvedType} for ${context} (supported: BOOLEAN, FLOAT, STRING, COLOR)`);
  }
  if (valueType !== expected) {
    const action = context === "comparison" ? "compare against" : "assign";
    throw new Error(`Variable "${variable.name}" is ${variable.resolvedType}; cannot ${action} ${valueType} literal (expected ${expected})`);
  }

  // Explicit narrowing to discriminated union based on expected type
  if (expected === "boolean") {
    return { type: "BOOLEAN", resolvedType: "BOOLEAN", value: value as boolean };
  }
  if (expected === "number") {
    return { type: "FLOAT", resolvedType: "FLOAT", value: value as number };
  }
  // expected === "string"
  return { type: "STRING", resolvedType: "STRING", value: value as string };
}
