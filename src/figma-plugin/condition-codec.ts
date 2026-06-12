// Pure codec for prototype Conditional expressions: build a Figma EXPRESSION
// VariableData from a comparison, decode one back (without the variable-name
// lookup), and detect the toggle_variable desugar pattern. No `figma.*` API —
// callers resolve variable ids/names; this module is unit-testable in isolation.

import type { LiteralVariableData, VariableResolvedType } from "./variable-literal.js";
import type { ComparisonOperator } from "../shared/wire-vocabulary.js";

// Translation from our operator symbols (the shared wire vocabulary) to Figma's
// ExpressionFunction. Typed as Record<ComparisonOperator, string> so adding an
// operator to the shared set without a translation here is a compile error.
export const COMPARISON_OPERATOR_MAP: Record<ComparisonOperator, string> = {
  "==": "EQUALS",
  "!=": "NOT_EQUAL",
  "<":  "LESS_THAN",
  "<=": "LESS_THAN_OR_EQUAL",
  ">":  "GREATER_THAN",
  ">=": "GREATER_THAN_OR_EQUAL",
};

export type { ComparisonOperator };

// Inverse of COMPARISON_OPERATOR_MAP — used by list_reactions echo to decode
// Figma's ExpressionFunction back to our operator literal.
export const OPERATOR_INVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(COMPARISON_OPERATOR_MAP).map(([k, v]) => [v, k]),
);

/** Figma EXPRESSION VariableData wrapping a single `variable <op> literal` comparison. */
export interface ConditionExpression {
  type: "EXPRESSION";
  resolvedType: "BOOLEAN";
  value: {
    expressionFunction: string;
    expressionArguments: unknown[];
  };
}

/**
 * Build the condition VariableData (EXPRESSION form) wrapping a variable
 * reference + literal comparison. Pure: the caller resolves the variable id
 * + resolvedType and validates the literal first.
 */
export function buildConditionExpression(input: {
  variableId: string;
  resolvedType: VariableResolvedType;
  operator: ComparisonOperator;
  literal: LiteralVariableData;
}): ConditionExpression {
  return {
    type: "EXPRESSION",
    resolvedType: "BOOLEAN",
    value: {
      expressionFunction: COMPARISON_OPERATOR_MAP[input.operator],
      expressionArguments: [
        {
          type: "VARIABLE_ALIAS",
          resolvedType: input.resolvedType,
          value: { type: "VARIABLE_ALIAS", id: input.variableId },
        },
        input.literal,
      ],
    },
  };
}

/**
 * Wrap ≥2 boolean operand expressions in a single AND/OR EXPRESSION — the nested
 * shape Figma uses for compound prototype conditions (captured live 2026-06-12).
 * Each operand is itself a ConditionExpression (e.g. from buildConditionExpression).
 */
export function buildCompoundConditionExpression(input: {
  join: "AND" | "OR";
  operands: ConditionExpression[];
}): ConditionExpression {
  return {
    type: "EXPRESSION",
    resolvedType: "BOOLEAN",
    value: {
      expressionFunction: input.join,
      expressionArguments: input.operands,
    },
  };
}

/** Result of decoding a condition expression — either a parsed comparison or the raw shape. */
export type DecodedCondition =
  | { variableId: string | undefined; operator: string; value: boolean | number | string | undefined }
  | { raw: unknown };

/**
 * Decode a single `variable <op> literal` EXPRESSION into its parts WITHOUT
 * resolving the variable name (caller does the `figma.variables` lookup on the
 * returned `variableId`). Returns `{ raw }` for anything that isn't a
 * recognized single comparison (non-EXPRESSION, unknown function, wrong arity,
 * non-alias first argument).
 */
export function decodeConditionExpression(condition: any): DecodedCondition {
  if (!condition || condition.type !== "EXPRESSION" || !condition.value) {
    return { raw: condition };
  }
  const expr = condition.value;
  const operator = OPERATOR_INVERSE[expr.expressionFunction as string];
  if (!operator) return { raw: condition };
  const args = expr.expressionArguments ?? [];
  if (args.length !== 2) return { raw: condition };

  const aliasArg = args[0];
  const literalArg = args[1];
  if (aliasArg?.type !== "VARIABLE_ALIAS") return { raw: condition };

  const variableId: string | undefined = aliasArg.value?.id;

  let value: boolean | number | string | undefined;
  if (literalArg?.type === "BOOLEAN" || literalArg?.type === "FLOAT" || literalArg?.type === "STRING") {
    value = literalArg.value;
  }

  return { variableId, operator, value };
}

/**
 * Detect the toggle_variable desugar shape — a 2-block CONDITIONAL of the exact
 * form `if x == true { set x = false } else { set x = true }` — and return the
 * variable id, or null if the blocks don't match. Pure pattern detection; must
 * stay in sync with the desugar in handleCreateReactions.
 */
export function detectTogglePattern(blocks: any[]): string | null {
  if (!Array.isArray(blocks) || blocks.length !== 2) return null;
  const [b0, b1] = blocks;
  if (b1?.condition !== undefined) return null;
  // b0 condition shape
  const cond = b0?.condition;
  if (!cond || cond.type !== "EXPRESSION" || !cond.value) return null;
  if (cond.value.expressionFunction !== "EQUALS") return null;
  const args = cond.value.expressionArguments;
  if (!Array.isArray(args) || args.length !== 2) return null;
  const aliasArg = args[0], boolArg = args[1];
  if (aliasArg?.type !== "VARIABLE_ALIAS") return null;
  if (boolArg?.type !== "BOOLEAN" || boolArg.value !== true) return null;
  const varId = aliasArg?.value?.id;
  if (!varId) return null;
  // b0 actions
  const a0 = b0?.actions;
  if (!Array.isArray(a0) || a0.length !== 1) return null;
  if (a0[0]?.type !== "SET_VARIABLE") return null;
  if (a0[0]?.variableId !== varId) return null;
  if (a0[0]?.variableValue?.type !== "BOOLEAN" || a0[0]?.variableValue?.value !== false) return null;
  // b1 actions
  const a1 = b1?.actions;
  if (!Array.isArray(a1) || a1.length !== 1) return null;
  if (a1[0]?.type !== "SET_VARIABLE") return null;
  if (a1[0]?.variableId !== varId) return null;
  if (a1[0]?.variableValue?.type !== "BOOLEAN" || a1[0]?.variableValue?.value !== true) return null;
  return varId;
}
