# Compound conditions (AND / OR) — design

**Date:** 2026-06-12
**Status:** approved (brainstorming) → ready for implementation plan
**Builds on:** single-comparison conditional MVP (v0.15.0), condition-codec extraction

## Goal

Let a prototype Conditional branch on **two or more** variable comparisons joined by a single
**AND** or **OR**, e.g. "loggedIn 이고 step ≥ 2 이면 …" / "isOpen 거나 role == admin 이면 …".
Today only a single comparison is supported (`if: { variable, operator?, value }`).

## Feasibility (confirmed 2026-06-12)

Figma's prototype Condition UI exposes **And / Or**, and a manually-authored `loggedIn AND isOpen`
(both BOOLEAN) reads back through our `list_reactions` as a nested EXPRESSION:

```json
{ "type": "EXPRESSION", "resolvedType": "BOOLEAN", "value": {
    "expressionFunction": "AND",
    "expressionArguments": [
      { "type": "VARIABLE_ALIAS", "resolvedType": "BOOLEAN", "value": { "type":"VARIABLE_ALIAS", "id":"VariableID:1039:3" } },
      { "type": "VARIABLE_ALIAS", "resolvedType": "BOOLEAN", "value": { "type":"VARIABLE_ALIAS", "id":"VariableID:1173:34" } }
    ] } }
```

The model is **recursive**: `AND`/`OR` is an `expressionFunction` whose `expressionArguments` are
each a boolean-typed operand — either a comparison EXPRESSION (what `buildConditionExpression`
already emits, `resolvedType: BOOLEAN`) or a bare boolean `VARIABLE_ALIAS`. We always emit the
comparison-EXPRESSION form for operands (uniform, reuses existing single-comparison code; no
bare-alias special-casing). `list_reactions` currently decodes a compound as `{ raw }` because the
decoder only recognizes single comparisons.

## Scope

**In:** one level of AND **or** OR over ≥2 comparisons; each comparison is the existing leaf
`{ variable, operator?, value, collection? }`. Exposed in **proto_conditional** (high-level) and
**create_reactions** (low-level `condition`, which is also proto_conditional's compile target).

**Out (YAGNI / platform):** NOT/negation; nesting; mixing AND with OR in one condition; else-if
chains (Figma-blocked — see the v0.24.0 else-if abandonment). Multi-way branching stays expressed as
separate reactions, as today.

## Schema

A discriminated union on `if` (proto_conditional) / `condition` (create_reactions). The single
form is unchanged (backward compatible); two new forms add `all` / `any`:

```
// single (existing, unchanged)
if: { variable: "loggedIn", value: true }                 // operator defaults to "=="

// AND
if: { all: [
  { variable: "loggedIn", value: true },
  { variable: "step", operator: ">=", value: 2 }
] }

// OR
if: { any: [
  { variable: "isOpen", value: true },
  { variable: "role", value: "admin" }
] }
```

- Leaf shape is reused verbatim (`{ variable, operator?, value, collection? }`, `operator`
  defaults to `==`).
- `all` / `any` arrays are `.min(2)` — a single comparison must use the single form (clear
  validation error otherwise).
- `all` and `any` are mutually exclusive (it's a union; one condition carries exactly one join).

## Internals / data flow

1. **`condition-codec.ts` (pure):** add `buildCompoundConditionExpression({ join: "AND" | "OR",
   operands: ConditionExpression[] })` returning the nested EXPRESSION captured above. Each operand
   is produced by the existing `buildConditionExpression` (one per leaf).
2. **Decoder:** extend `decodeConditionExpression` (or add a sibling `decodeCondition`) to recognize
   `expressionFunction` AND/OR with comparison-EXPRESSION operands and return our `{ all: [...] }` /
   `{ any: [...] }` shape; single comparisons decode as today. `list_reactions` round-trips compounds.
3. **Plugin `buildCondition` (code.ts):** when the input is `all`/`any`, resolve each leaf's variable
   (`resolveVariableByName`) and validate the literal (`validateVariableLiteralCompat`) exactly as the
   single path does, build each comparison, then wrap with `buildCompoundConditionExpression`.
4. **Compiler:** `ProtoConditionIf` (high-level) → `ConditionInput` (low-level / compile target)
   mapping gains the `all`/`any` passthrough. Because proto_* compilers emit `CreateReactionsInputType`,
   widening `ConditionInput` is what carries compound through to the plugin — and gives
   create_reactions the same capability.

## Validation

- Each leaf is validated like the current single comparison: literal type must match the variable's
  resolvedType; COLOR variables are not comparable (rejected); variable resolved by name (local or
  library/remote), `collection` disambiguates name collisions.
- A compound fails if **any** leaf fails (surface which leaf).
- `.min(2)` enforced on `all`/`any`.

## NL steering (describe)

- proto_conditional describe() gains compound cues: '~이고 / 그리고 / 둘 다 / 모두 / AND' → `all`;
  '~거나 / 또는 / 하나라도 / OR' → `any`.
- State the **one-level** limit explicitly: no mixing AND+OR, no nesting; for multi-way branching use
  separate reactions (else-if is unavailable in Figma).

## Testing & ship gate

- **TDD unit:** codec builder (AND/OR shapes), decoder round-trip (compound → all/any, single still
  works), compiler mapping, leaf validation propagation, `.min(2)` rejection.
- **Live write-probe (ship gate):** drive a real proto_conditional with `all:[…]` and with `any:[…]`
  against the running server + plugin; confirm `setReactionsAsync` accepts our built compound and
  `list_reactions` round-trips it back to `all`/`any`. (Reading Figma's own compound is already
  verified; writing ours is the remaining unknown — same EXPRESSION family as the single comparison
  we already write successfully, so confidence is high but must be verified live before shipping.)
- Keep CD as the sole SSE client during any live run (single-active newest-wins).

## Risks / open questions

- **Write-probe is the gate:** if `setReactionsAsync` rejects our operand shape (e.g. requires bare
  boolean aliases for boolean operands rather than `== true` comparisons), adjust the operand builder
  to match — fall back to bare `VARIABLE_ALIAS` for `boolean == true/false` leaves. Low risk; resolved
  at first live verify (the project's recurring runtime-vs-typings pattern).
- Decoder must not misclassify the existing toggle_variable desugar (a 2-block CONDITIONAL) — that
  detection is on `conditionalBlocks`, orthogonal to the per-block `condition` expression, so no
  collision; verify in tests.
