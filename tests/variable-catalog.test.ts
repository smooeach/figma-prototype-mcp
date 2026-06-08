import { describe, it, expect } from "vitest";
import {
  filterVariables,
  formatVariableNotFoundError,
  type LocalVarDescriptor,
  type LibraryVarDescriptor,
} from "../src/figma-plugin/variable-catalog.js";

const local: LocalVarDescriptor[] = [
  { name: "isOpen", id: "VariableID:1", resolvedType: "BOOLEAN", collection: "modes" },
  { name: "count", id: "VariableID:2", resolvedType: "FLOAT", collection: "modes" },
];
const library: LibraryVarDescriptor[] = [
  { name: "corner-radius/8", key: "k1", resolvedType: "FLOAT", collection: "radius", libraryName: "DS" },
  { name: "brand/primary", key: "k2", resolvedType: "COLOR", collection: "color", libraryName: "DS" },
];

describe("filterVariables", () => {
  it("returns everything when no filters are given", () => {
    expect(filterVariables(local, {})).toHaveLength(2);
  });
  it("filters by resolvedType", () => {
    const r = filterVariables(local, { resolvedType: "BOOLEAN" });
    expect(r.map((v) => v.name)).toEqual(["isOpen"]);
  });
  it("filters by case-insensitive name substring", () => {
    const r = filterVariables(library, { nameQuery: "CORNER" });
    expect(r.map((v) => v.name)).toEqual(["corner-radius/8"]);
  });
  it("applies type and name filters together", () => {
    expect(filterVariables(library, { resolvedType: "COLOR", nameQuery: "brand" })).toHaveLength(1);
    expect(filterVariables(library, { resolvedType: "FLOAT", nameQuery: "brand" })).toHaveLength(0);
  });
});

describe("formatVariableNotFoundError", () => {
  it("lists local and library candidates", () => {
    const msg = formatVariableNotFoundError("corner-radius/9", ["isOpen"], ["corner-radius/8", "brand/primary"]);
    expect(msg).toBe(
      'Variable "corner-radius/9" not found. Available — local: [isOpen]; ' +
        "library: [corner-radius/8, brand/primary]. Use list_variables to inspect.",
    );
  });
  it("renders empty candidate lists as (none)", () => {
    const msg = formatVariableNotFoundError("x", [], []);
    expect(msg).toBe(
      'Variable "x" not found. Available — local: (none); library: (none). Use list_variables to inspect.',
    );
  });
});
