import { describe, it, expect } from "vitest";
import {
  COMPARISON_OPERATOR_MAP,
  buildConditionExpression,
  decodeConditionExpression,
  detectTogglePattern,
} from "../src/figma-plugin/condition-codec.js";

const floatLiteral = (n: number) => ({ type: "FLOAT" as const, resolvedType: "FLOAT" as const, value: n });
const boolLiteral = (b: boolean) => ({ type: "BOOLEAN" as const, resolvedType: "BOOLEAN" as const, value: b });

describe("buildConditionExpression", () => {
  it("wraps a variable alias + literal in an EXPRESSION with the mapped function", () => {
    const expr = buildConditionExpression({
      variableId: "VAR:1",
      resolvedType: "FLOAT",
      operator: ">=",
      literal: floatLiteral(2),
    });
    expect(expr).toEqual({
      type: "EXPRESSION",
      resolvedType: "BOOLEAN",
      value: {
        expressionFunction: "GREATER_THAN_OR_EQUAL",
        expressionArguments: [
          { type: "VARIABLE_ALIAS", resolvedType: "FLOAT", value: { type: "VARIABLE_ALIAS", id: "VAR:1" } },
          { type: "FLOAT", resolvedType: "FLOAT", value: 2 },
        ],
      },
    });
  });

  it("maps every comparison operator to its Figma expressionFunction", () => {
    const cases: Record<string, string> = {
      "==": "EQUALS", "!=": "NOT_EQUAL", "<": "LESS_THAN",
      "<=": "LESS_THAN_OR_EQUAL", ">": "GREATER_THAN", ">=": "GREATER_THAN_OR_EQUAL",
    };
    for (const [op, fn] of Object.entries(cases)) {
      const expr = buildConditionExpression({
        variableId: "v", resolvedType: "FLOAT", operator: op as keyof typeof COMPARISON_OPERATOR_MAP, literal: floatLiteral(1),
      }) as { value: { expressionFunction: string } };
      expect(expr.value.expressionFunction).toBe(fn);
    }
  });
});

describe("decodeConditionExpression", () => {
  it("round-trips a built expression back to { variableId, operator, value }", () => {
    const expr = buildConditionExpression({ variableId: "VAR:9", resolvedType: "FLOAT", operator: "<=", literal: floatLiteral(5) });
    expect(decodeConditionExpression(expr)).toEqual({ variableId: "VAR:9", operator: "<=", value: 5 });
  });

  it("decodes a BOOLEAN literal", () => {
    const expr = buildConditionExpression({ variableId: "b", resolvedType: "BOOLEAN", operator: "==", literal: boolLiteral(true) });
    expect(decodeConditionExpression(expr)).toEqual({ variableId: "b", operator: "==", value: true });
  });

  it("returns { raw } for a non-EXPRESSION condition", () => {
    expect(decodeConditionExpression({ type: "BOOLEAN", value: true })).toEqual({ raw: { type: "BOOLEAN", value: true } });
  });

  it("returns { raw } for null", () => {
    expect(decodeConditionExpression(null)).toEqual({ raw: null });
  });

  it("returns { raw } for an unrecognized expressionFunction (e.g. AND)", () => {
    const cond = { type: "EXPRESSION", value: { expressionFunction: "AND", expressionArguments: [{}, {}] } };
    expect(decodeConditionExpression(cond)).toEqual({ raw: cond });
  });

  it("returns { raw } when there are not exactly 2 arguments", () => {
    const cond = { type: "EXPRESSION", value: { expressionFunction: "EQUALS", expressionArguments: [{}] } };
    expect(decodeConditionExpression(cond)).toEqual({ raw: cond });
  });

  it("returns { raw } when the first argument is not a VARIABLE_ALIAS", () => {
    const cond = { type: "EXPRESSION", value: { expressionFunction: "EQUALS", expressionArguments: [{ type: "FLOAT", value: 1 }, { type: "FLOAT", value: 2 }] } };
    expect(decodeConditionExpression(cond)).toEqual({ raw: cond });
  });

  it("leaves value undefined when the literal arg is not a supported scalar type", () => {
    const cond = {
      type: "EXPRESSION",
      value: { expressionFunction: "EQUALS", expressionArguments: [
        { type: "VARIABLE_ALIAS", value: { id: "v" } },
        { type: "COLOR", value: { r: 1, g: 0, b: 0, a: 1 } },
      ] },
    };
    expect(decodeConditionExpression(cond)).toEqual({ variableId: "v", operator: "==", value: undefined });
  });
});

describe("detectTogglePattern", () => {
  const varId = "VAR:toggle";
  const cond = {
    type: "EXPRESSION",
    value: { expressionFunction: "EQUALS", expressionArguments: [
      { type: "VARIABLE_ALIAS", value: { id: varId } },
      { type: "BOOLEAN", value: true },
    ] },
  };
  const setVar = (value: boolean) => ({ type: "SET_VARIABLE", variableId: varId, variableValue: { type: "BOOLEAN", value } });
  const validBlocks = [
    { condition: cond, actions: [setVar(false)] }, // if x==true → set x=false
    { actions: [setVar(true)] },                   // else      → set x=true
  ];

  it("returns the variable id for the canonical toggle shape", () => {
    expect(detectTogglePattern(validBlocks)).toBe(varId);
  });

  it("returns null when not exactly 2 blocks", () => {
    expect(detectTogglePattern([validBlocks[0]!])).toBeNull();
    expect(detectTogglePattern([...validBlocks, validBlocks[1]!])).toBeNull();
  });

  it("returns null when the second block has a condition (not an else)", () => {
    expect(detectTogglePattern([validBlocks[0]!, { condition: cond, actions: [setVar(true)] }])).toBeNull();
  });

  it("returns null when the condition function is not EQUALS", () => {
    const c = { ...cond, value: { ...cond.value, expressionFunction: "NOT_EQUAL" } };
    expect(detectTogglePattern([{ condition: c, actions: [setVar(false)] }, validBlocks[1]!])).toBeNull();
  });

  it("returns null when the then-action does not set the same variable to false", () => {
    expect(detectTogglePattern([{ condition: cond, actions: [setVar(true)] }, validBlocks[1]!])).toBeNull();
  });

  it("returns null when the else-action sets a different variable id", () => {
    const otherElse = { actions: [{ type: "SET_VARIABLE", variableId: "VAR:other", variableValue: { type: "BOOLEAN", value: true } }] };
    expect(detectTogglePattern([validBlocks[0]!, otherElse])).toBeNull();
  });

  it("returns null for a non-array input", () => {
    expect(detectTogglePattern(undefined as unknown as any[])).toBeNull();
  });
});
