import { describe, it, expect } from "vitest";
import {
  selectNodeMatch,
  formatNodeNotFoundError,
  formatAmbiguousNodeError,
  type NodeCandidate,
} from "../src/figma-plugin/node-catalog.js";

const pool: NodeCandidate[] = [
  { id: "1:1", name: "Submit", screen: "Login" },
  { id: "2:2", name: "Submit", screen: "Signup" },
  { id: "3:3", name: "Cancel", screen: "Login" },
];

describe("selectNodeMatch", () => {
  it("returns none when no name matches", () => {
    expect(selectNodeMatch("Nope", pool)).toEqual({ kind: "none" });
  });
  it("returns match (id) for a unique name (case-insensitive)", () => {
    expect(selectNodeMatch("cancel", pool)).toEqual({ kind: "match", id: "3:3" });
  });
  it("returns ambiguous with candidates when a name repeats", () => {
    const r = selectNodeMatch("Submit", pool);
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") expect(r.candidates.map((c) => c.id)).toEqual(["1:1", "2:2"]);
  });
});

describe("error formatters", () => {
  it("not-found mentions name and scope", () => {
    expect(formatNodeNotFoundError("Submit", "Login")).toMatch(/Submit/);
    expect(formatNodeNotFoundError("Submit", "Login")).toMatch(/Login/);
    expect(formatNodeNotFoundError("Submit", null)).toMatch(/Submit/);
  });
  it("ambiguous lists candidate ids and screens", () => {
    const msg = formatAmbiguousNodeError("Submit", [
      { id: "1:1", name: "Submit", screen: "Login" },
      { id: "2:2", name: "Submit", screen: "Signup" },
    ]);
    expect(msg).toMatch(/1:1/);
    expect(msg).toMatch(/Signup/);
  });
});
