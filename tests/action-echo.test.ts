import { describe, it, expect } from "vitest";
import {
  encodeActionForListEcho,
  decodeConditionForEcho,
  type EchoResolvers,
} from "../src/figma-plugin/action-echo.js";
import { buildConditionExpression, buildCompoundConditionExpression } from "../src/figma-plugin/condition-codec.js";

// Deterministic fake resolvers: undefined => "missing/deleted".
const make = (vars: Record<string, string> = {}, nodes: Record<string, string> = {}): EchoResolvers => ({
  variableName: async (id) => vars[id],
  nodeName: async (id) => nodes[id],
});

describe("encodeActionForListEcho — passthrough actions", () => {
  it("encodes a NODE/navigate action and resolves the destination name", async () => {
    const out = await encodeActionForListEcho(
      { type: "NODE", navigation: "NAVIGATE", destinationId: "d1", transition: { type: "DISSOLVE" }, resetScrollPosition: false },
      make({}, { d1: "Home" }),
    );
    expect(out).toEqual({
      type: "NODE", navigation: "NAVIGATE", url: undefined, openInNewTab: undefined,
      destinationId: "d1", destinationName: "Home", transition: { type: "DISSOLVE" }, resetScrollPosition: false,
    });
  });

  it("encodes a CLOSE action with no destination", async () => {
    const out = await encodeActionForListEcho({ type: "CLOSE" }, make());
    expect(out).toEqual({
      type: "CLOSE", navigation: undefined, url: undefined, openInNewTab: undefined,
      destinationId: undefined, destinationName: undefined, transition: undefined, resetScrollPosition: undefined,
    });
  });

  it("returns { type: UNKNOWN } for a non-object action", async () => {
    expect(await encodeActionForListEcho(null, make())).toEqual({ type: "UNKNOWN" });
  });
});

describe("encodeActionForListEcho — SET_VARIABLE", () => {
  it("resolves the variable name and passes a scalar value through", async () => {
    const out = await encodeActionForListEcho(
      { type: "SET_VARIABLE", variableId: "v1", variableValue: { type: "BOOLEAN", value: true } },
      make({ v1: "isOpen" }),
    );
    expect(out).toEqual({ type: "set_variable", variable: "isOpen", value: true });
  });

  it("converts a COLOR variableValue to a hex string via rgbToHex", async () => {
    const out = await encodeActionForListEcho(
      { type: "SET_VARIABLE", variableId: "v2", variableValue: { type: "COLOR", value: { r: 1, g: 0, b: 0, a: 1 } } },
      make({ v2: "brand" }),
    );
    expect(out).toEqual({ type: "set_variable", variable: "brand", value: "#FF0000" });
  });

  it("falls back to <id:..> when the variable was deleted", async () => {
    const out = await encodeActionForListEcho(
      { type: "SET_VARIABLE", variableId: "gone", variableValue: { type: "BOOLEAN", value: false } },
      make({}),
    );
    expect(out).toEqual({ type: "set_variable", variable: "<id:gone>", value: false });
  });
});

describe("encodeActionForListEcho — CONDITIONAL", () => {
  const condition = buildConditionExpression({
    variableId: "v1", resolvedType: "BOOLEAN", operator: "==",
    literal: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true },
  });

  it("encodes a standard then/else conditional recursively", async () => {
    const action = {
      type: "CONDITIONAL",
      conditionalBlocks: [
        { condition, actions: [{ type: "CLOSE" }] },
        { actions: [{ type: "BACK" }] }, // else block: no condition
      ],
    };
    const out: any = await encodeActionForListEcho(action, make({ v1: "isOpen" }));
    expect(out.type).toBe("CONDITIONAL");
    expect(out.condition).toEqual({ variable: "isOpen", operator: "==", value: true, raw: undefined });
    expect(out.then).toHaveLength(1);
    expect((out.then[0] as any).type).toBe("CLOSE");
    expect(out.else).toHaveLength(1);
    expect((out.else[0] as any).type).toBe("BACK");
  });

  it("returns { type: CONDITIONAL, raw } for a non-standard block shape", async () => {
    const action = { type: "CONDITIONAL", conditionalBlocks: [{ actions: [] }] }; // block[0] has no condition
    const out: any = await encodeActionForListEcho(action, make());
    expect(out).toEqual({ type: "CONDITIONAL", raw: [{ actions: [] }] });
  });

  it("detects the toggle_variable desugar pattern", async () => {
    // A toggle desugar: block0 = (var == true -> set var false), block1 = (else -> set var true)
    const toggleCondition = buildConditionExpression({
      variableId: "vt", resolvedType: "BOOLEAN", operator: "==",
      literal: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true },
    });
    const action = {
      type: "CONDITIONAL",
      conditionalBlocks: [
        { condition: toggleCondition, actions: [{ type: "SET_VARIABLE", variableId: "vt", variableValue: { type: "BOOLEAN", value: false } }] },
        { actions: [{ type: "SET_VARIABLE", variableId: "vt", variableValue: { type: "BOOLEAN", value: true } }] },
      ],
    };
    const out: any = await encodeActionForListEcho(action, make({ vt: "darkMode" }));
    expect(out).toEqual({ type: "toggle_variable", variable: "darkMode" });
  });
});

describe("decodeConditionForEcho", () => {
  it("decodes a standard expression and resolves the variable name", async () => {
    const condition = buildConditionExpression({
      variableId: "v9", resolvedType: "FLOAT", operator: "<=",
      literal: { type: "FLOAT", resolvedType: "FLOAT", value: 5 },
    });
    const out = await decodeConditionForEcho(condition, make({ v9: "count" }));
    expect(out).toEqual({ variable: "count", operator: "<=", value: 5, raw: undefined });
  });

  it("returns { raw } for a non-expression condition", async () => {
    const out = await decodeConditionForEcho({ type: "BOOLEAN", value: true }, make());
    expect(out).toEqual({ raw: { type: "BOOLEAN", value: true } });
  });

  it("keeps the raw condition when the variable name is lost", async () => {
    const condition = buildConditionExpression({
      variableId: "deleted", resolvedType: "BOOLEAN", operator: "==",
      literal: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true },
    });
    const out: any = await decodeConditionForEcho(condition, make({}));
    expect(out.variable).toBe("<id:deleted>");
    expect(out.raw).toEqual(condition);
  });
});

describe("decodeConditionForEcho — compound", () => {
  const resolvers = { variableName: async (id: string) => (({ "Var:A": "loggedIn", "Var:B": "step" } as Record<string,string>)[id]) };
  const exprAnd = buildCompoundConditionExpression({ join: "AND", operands: [
    buildConditionExpression({ variableId: "Var:A", resolvedType: "BOOLEAN", operator: "==", literal: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true } }),
    buildConditionExpression({ variableId: "Var:B", resolvedType: "FLOAT", operator: ">=", literal: { type: "FLOAT", resolvedType: "FLOAT", value: 2 } }),
  ] });
  it("echoes an AND back as { all: [...] } with resolved names", async () => {
    expect(await decodeConditionForEcho(exprAnd, resolvers as any)).toEqual({ all: [
      { variable: "loggedIn", operator: "==", value: true },
      { variable: "step", operator: ">=", value: 2 },
    ] });
  });
});
