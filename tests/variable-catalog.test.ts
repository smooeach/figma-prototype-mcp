import { describe, it, expect } from "vitest";
import {
  filterVariables,
  formatVariableNotFoundError,
  selectVariableMatch,
  formatAmbiguousVariableError,
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

describe("selectVariableMatch", () => {
  const cands: LocalVarDescriptor[] = [
    { name: "count", id: "VariableID:1", resolvedType: "FLOAT", collection: "mcp_test" },
    { name: "count", id: "VariableID:2", resolvedType: "FLOAT", collection: "DuMat" },
    { name: "isOpen", id: "VariableID:3", resolvedType: "BOOLEAN", collection: "modes" },
  ];

  it("returns none when no candidate matches the name", () => {
    expect(selectVariableMatch("missing", undefined, cands)).toEqual({ kind: "none" });
  });

  it("returns the single match when one name matches and no collection given", () => {
    const r = selectVariableMatch("isOpen", undefined, cands);
    expect(r).toEqual({ kind: "match", item: cands[2] });
  });

  it("returns ambiguous (with collection list) on multi-match and no collection given", () => {
    const r = selectVariableMatch("count", undefined, cands);
    expect(r).toEqual({ kind: "ambiguous", collections: ["mcp_test", "DuMat"] });
  });

  it("resolves a collision when the collection is given", () => {
    const r = selectVariableMatch("count", "DuMat", cands);
    expect(r).toEqual({ kind: "match", item: cands[1] });
  });

  it("returns none when the given collection matches no candidate (fall through to library)", () => {
    expect(selectVariableMatch("count", "nope", cands)).toEqual({ kind: "none" });
  });

  it("returns ambiguous when the same name appears twice in the given collection (defensive)", () => {
    const dupe: LocalVarDescriptor[] = [
      { name: "count", id: "VariableID:1", resolvedType: "FLOAT", collection: "dup" },
      { name: "count", id: "VariableID:2", resolvedType: "FLOAT", collection: "dup" },
    ];
    expect(selectVariableMatch("count", "dup", dupe)).toEqual({ kind: "ambiguous", collections: ["dup", "dup"] });
  });
});

describe("formatAmbiguousVariableError", () => {
  it("formats a local collision", () => {
    const msg = formatAmbiguousVariableError("count", ["mcp_test", "DuMat"], "local");
    expect(msg).toBe(
      'Variable "count" is ambiguous — it exists in multiple local collections: ' +
        "[mcp_test, DuMat]. Specify the `collection` field to disambiguate " +
        "(use list_variables to see collection names).",
    );
  });
  it("formats a library collision", () => {
    const msg = formatAmbiguousVariableError("count", ["A", "B"], "library");
    expect(msg).toBe(
      'Variable "count" is ambiguous — it exists in multiple library collections: ' +
        "[A, B]. Specify the `collection` field to disambiguate " +
        "(use list_variables to see collection names).",
    );
  });
});
