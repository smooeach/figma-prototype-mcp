# Design: Wire-vocabulary single source (Candidate C)

**Date:** 2026-06-02
**Type:** Internal refactor (behavior-preserving, no version bump)
**Status:** Approved — ready for implementation plan

## Problem

The string-literal vocabularies that travel across the WebSocket wire — prototype
trigger names, transition types, easing names, directions, comparison operators,
overflow directions — are declared **independently on both sides** of the bridge:

- **Server (input schemas):** `src/mcp-server/tools.ts`, as `z.enum([...])` literals.
- **Plugin (input types):** `src/figma-plugin/reaction-builder.ts`, as TypeScript
  union types with byte-for-byte identical members.

The server validates an input and forwards the parsed value over WS to the plugin,
which re-types it against its own union. Nothing enforces that the two member sets
stay equal. Adding (or renaming) a value on one side compiles cleanly and may pass
tests, yet breaks the wire at runtime. This is the "Candidate C" drift recorded in
project memory (`code-ts-testability-refactor`): the same shape drifts across
~4–6 places.

## Goal

Establish a single source of truth for every **drift-risk wire vocabulary** — every
enum whose identical member set appears on both the server input schema and the
plugin input type. The server derives its `z.enum` from it; the plugin derives its
union type from it. Behavior and wire format are unchanged; only the *origin* of the
literals moves.

## Non-goals (deliberately excluded)

- **Action intent types ↔ Figma shape names.** The server speaks designer-intent
  lowercase (`navigate`, `scroll`, `overlay`, `close`, `back`, `url`, `swap_overlay`,
  `set_variable`, `toggle_variable`, `conditional`); the plugin speaks Figma's
  uppercase shapes (`NODE` + navigation `NAVIGATE`/`SCROLL_TO`/`OVERLAY`/`SWAP`, plus
  `CLOSE`/`BACK`/`URL`/`CONDITIONAL`/`SET_VARIABLE`). These are **two distinct
  vocabularies bridged by a deliberate translation** in the builder — not duplicates.
  Consolidating them would collapse the abstraction. Left untouched.
- **Figma output shapes** (`BuiltAction`, `BuiltReaction`, `TransitionShape`,
  `EasingShape`, etc.) live only on the plugin side. Not duplicated → out of scope.
- No new runtime dependency in the plugin sandbox bundle (see Approach rationale).
- No version bump — same policy as the prior `variable-literal` and `condition-codec`
  extractions (internal refactor, pushed but not tagged).

## Approach

**Chosen: A — pure `as const` arrays in `src/shared/`.**

A new pure module `src/shared/wire-vocabulary.ts` exports each vocabulary as a
readonly tuple plus its derived type:

```ts
export const TRIGGER_SHORTCUTS = ["ON_CLICK", "ON_HOVER", "ON_PRESS", "AFTER_TIMEOUT"] as const;
export type TriggerName = (typeof TRIGGER_SHORTCUTS)[number];
```

- **Server** (`mcp-server/tools.ts`): `z.enum(TRIGGER_SHORTCUTS)` instead of an inline
  literal array. `z.enum` accepts a readonly `[string, ...string[]]` tuple, which
  `as const` produces. Values are identical; only the source moves.
- **Plugin** (`reaction-builder.ts`): import the derived types; keep the existing
  exported names (`TriggerName`, `Direction`, `SimpleTransitionType`, …) as
  re-exported aliases so downstream importers (`code.ts`, tests) don't break.

**Rejected approaches:**

- **B — define `z.enum` in shared, infer the plugin type from it.** Pulls `zod` into
  the Figma sandbox bundle. The plugin performs no validation (the server already
  did) and must stay lean. Rejected.
- **C — keep both declarations, add a conformance test only.** Guards the drift but
  doesn't remove it; the root duplication remains. Rejected as the primary fix
  (though a conformance/snapshot test is retained as a safety net — see Testing).

## Module contents — `src/shared/wire-vocabulary.ts`

Each entry is an `as const` tuple with a derived `type`.

Triggers:
- `TRIGGER_SHORTCUTS` = `ON_CLICK, ON_HOVER, ON_PRESS, AFTER_TIMEOUT`
- `TRIGGER_NOPARAM_TYPES` = `ON_CLICK, ON_HOVER, ON_PRESS, ON_DRAG, ON_MEDIA_END`
- `MOUSE_CLICK_TYPES` = `MOUSE_UP, MOUSE_DOWN`
- `MOUSE_HOVER_TYPES` = `MOUSE_ENTER, MOUSE_LEAVE`
- `KEYBOARD_DEVICES` = `KEYBOARD, XBOX_ONE, PS4, SWITCH_PRO, UNKNOWN_CONTROLLER`

Transitions:
- `TRANSITION_SHORTCUTS` = `INSTANT, DISSOLVE, SMART_ANIMATE`
- `SIMPLE_TRANSITION_TYPES` = `DISSOLVE, SMART_ANIMATE, SCROLL_ANIMATE`
- `DIRECTIONAL_TRANSITION_TYPES` = `MOVE_IN, MOVE_OUT, PUSH, SLIDE_IN, SLIDE_OUT`
- `NAMED_EASINGS` = `LINEAR, EASE_IN, EASE_OUT, EASE_IN_AND_OUT, EASE_IN_BACK, EASE_OUT_BACK, EASE_IN_AND_OUT_BACK, GENTLE, QUICK, BOUNCY, SLOW`
- `DIRECTIONS` = `LEFT, RIGHT, TOP, BOTTOM`

Other:
- `COMPARISON_OPERATORS` = `==, !=, <, <=, >, >=`
- `OVERFLOW_DIRECTIONS` = `NONE, HORIZONTAL, VERTICAL, BOTH`

Singleton literals (`ON_KEY_DOWN`, `ON_MEDIA_HIT`, `ON_MEDIA_END`) that appear only as
`z.literal(...)` discriminants with no matching multi-member union are left inline —
they carry no drift risk (a single literal can't diverge from a set).

## Consumer changes

- `src/mcp-server/tools.ts` — replace each inline `z.enum([...])` with `z.enum(<CONST>)`
  for the vocabularies above. No schema-shape change.
- `src/figma-plugin/reaction-builder.ts` — replace each hand-written union with the
  imported derived type, preserving the current exported names as aliases.
- No other files change: `code.ts` and the compile helpers consume the
  `reaction-builder` exports, which keep their names and meanings.

## Testing — `tests/wire-vocabulary.test.ts`

1. **Member snapshot** — assert each constant's exact members (regression guard
   against accidental edits to the single source).
2. **z.enum round-trip** — `z.enum(<CONST>)` accepts every member and rejects a
   known-bad value, confirming the constant feeds the server schema correctly.
3. **Cross-side conformance** — parse representative inputs through the existing
   server schemas and assert the accepted set equals the constant's members,
   confirming the single source actually reaches both the schema and (via the shared
   type) the plugin. This is the safety net that the "Approach C" idea contributes.

The full existing suite (383 tests) plus the new file must stay green, and
`tsc --noEmit` must pass — the type derivation is the compile-time half of the guard.

## Risks

- **`z.enum` + readonly tuple** — recent zod (project uses `^3.23`) accepts
  `readonly [string, ...string[]]`. If a version quirk surfaces, fall back to a
  non-`readonly` `as const` spread or a small typed helper. Verify at first compile.
- **Import-name churn** — mitigated by keeping `reaction-builder`'s public type names
  as aliases; downstream importers are untouched.
- **Bundle** — `src/shared/` is already bundled into the plugin via tsup
  (`bundle: true, noExternal: [/.*/]`); `motionPresets.ts` lives there today. No
  config change needed.

## Verification gate

- `npm test` — 383 + new tests green.
- `npm run typecheck` — clean.
- `git grep` confirms no inline trigger/transition/direction/operator/overflow enum
  literal arrays remain in `mcp-server/tools.ts` or `reaction-builder.ts` (only
  `wire-vocabulary.ts` holds them).
