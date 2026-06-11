# proto_change_to — Component Variant Switching (Design)

**Date:** 2026-06-11
**Status:** Approved (pre-implementation)

## Goal

Add a high-level `proto_change_to` tool (plus a low-level `change_to` action) that wires a component **instance** to switch to a sibling **variant** on interaction — Figma's `CHANGE_TO` navigation. This is the only remaining gap in the interaction-wiring surface (creation stays out of scope by design — see the project's create-vs-wire boundary).

Runtime feasibility was confirmed by a 2026-06-11 probe: `setReactionsAsync` **accepts** `{type:"NODE", navigation:"CHANGE_TO", destinationId:<variant>, transition:null}` (fixture `MCP_test_16`: COMPONENT_SET `button` / variants `state=normal` 1404:34003, `state=highlight` 1404:34002, instance 1404:34005).

## Key decisions (from brainstorming)

1. **Surface:** a dedicated high-level tool `proto_change_to`, plus a low-level `change_to` action on `create_reactions`. Not an extension of `proto_wire` (frame navigation must stay semantically distinct).
2. **Target specification:** by **node ID** — `from` = instance node id, `to` = target variant node id. The LLM resolves names → ids via `find_nodes`, identical to how `proto_wire` already resolves frames. (Property-value resolution, e.g. `"highlight"`, is a possible future enhancement, not in this scope.)
3. **Motion:** supported. Default `motion = M3_EMPHASIZED` (a SMART_ANIMATE preset) — variant morphing is the appeal. Gated on a build-time probe (see below).
4. **No degrade logic:** unlike `proto_wire`, CHANGE_TO does not get the no-matching-layer → DISSOLVE degrade. Variants of one component inherently share layer structure, so SMART_ANIMATE always has something to morph.
5. **Conditional-usable:** `change_to` is included in `NonConditionalActionInput`, so it may appear in `proto_conditional` then/else branches (same treatment as `set_variable`).

## Architecture

Follows the established proto_* pattern end-to-end:

```
proto_change_to (tools.ts)
  └─ compileProtoChangeTo (protoTools.ts) ──► create_reactions Connection[]
        └─ action { type:"change_to", targetVariantId }
              └─ plugin code.ts buildNonConditionalAction "change_to" branch
                    └─ buildChangeToReaction (reaction-builder.ts)
                          └─ { type:"NODE", navigation:"CHANGE_TO", destinationId, transition }
                                └─ figma node.setReactionsAsync(...)
```

### Components

- **`src/mcp-server/tools.ts`**
  - New `ChangeToActionInput = { type:"change_to", targetVariantId: string }`.
  - Add it to the `NonConditionalActionInput` discriminated union (and thus to the conditional branch set).
  - Register `proto_change_to` tool (description with KO/EN cues; `from`/`to` documented as **node IDs, not names** — resolve via find_nodes; disambiguate from proto_wire and set_variable).
- **`src/mcp-server/protoTools.ts`**
  - `ProtoChangeToEntry = { from, to, trigger?, motion? }` + `ProtoChangeToInput = { changes: [...], replaceExisting? }`.
  - `compileProtoChangeTo` → `Connection[]` with `action {type:"change_to", targetVariantId: w.to}`, trigger default ON_CLICK, motion default M3_EMPHASIZED.
- **`src/figma-plugin/reaction-builder.ts`**
  - `buildChangeToReaction({ targetVariantId, trigger, transition, afterTimeoutSeconds })` → `BuiltReaction` whose action is `{ type:"NODE", destinationId, navigation:"CHANGE_TO", transition }`.
  - Extend the `BuiltAction` NODE navigation union to include `"CHANGE_TO"`.
- **`src/figma-plugin/code.ts`**
  - New `change_to` branch in `buildNonConditionalAction`:
    - `target = figma.getNodeById(targetVariantId)`; require `target.type === "COMPONENT"` (a variant) — else throw a clear error (e.g. "Change-to target must be a component variant").
    - Soft-validate the source: if `sourceNode` is not an INSTANCE and has no INSTANCE ancestor, return a **warning** ("CHANGE_TO has no instance to apply to; the reaction will not animate at runtime") — do not throw.
    - Build the transition from the passed motion via existing `buildTransition`, applying the motion-rewrite decided by the probe (see below).

### Motion handling (probe-gated)

The probe used `transition:null`. Before finalizing, a build-time live probe emits a CHANGE_TO with a **SMART_ANIMATE** transition and observes `setReactionsAsync`:

- **ACCEPT** → pass the transition through unchanged.
- **REJECT** (Unrecognized-key class, like overlay's SMART_ANIMATE rejection) → rewrite any SMART_ANIMATE-based motion to DISSOLVE, preserving `duration`/`easing` — reuse the exact mechanism `proto_overlay` already applies. Document the limitation in the describe().

This is the same probe-gated pattern used for the A2 (matchLayers) decision.

## Error handling

| Case | Behavior |
|---|---|
| `to` node not found | throw "Change-to target not found: <id>" |
| `to` is not a COMPONENT variant | throw "Change-to target must be a component variant (got <type>): <id>" |
| `from` is not / not inside an INSTANCE | succeed but return a warning (runtime no-op) |
| motion is SMART_ANIMATE and runtime rejects it on CHANGE_TO | auto-rewrite to DISSOLVE (per probe) |

## Testing

- **Unit (vitest):**
  - `buildChangeToReaction` emits the correct NODE/CHANGE_TO shape, transition wired.
  - `compileProtoChangeTo` maps entries → connections, defaults applied, `replaceExisting` threaded.
  - Schema: `change_to` action parses; appears in `NonConditionalActionInput`; rejects unknown fields.
  - Motion-rewrite helper (if probe → REJECT path) degrades SMART_ANIMATE → DISSOLVE for change_to.
- **Live (MCP SSE client + plugin, fixture MCP_test_16):**
  - The transition probe (SMART_ANIMATE accept/reject).
  - A real `proto_change_to` instance→variant wire; read back the stored reaction (NODE/CHANGE_TO/destinationId + transition).
  - Route check in a real client is optional (covered by the broader steering round pattern).

## Out of scope (future)

- Property-value variant resolution (`"highlight"` → sibling variant, plugin-side).
- Hover/press auto-revert pairs (while-hovering → revert on leave).
- Multi-property variant disambiguation.

## Self-review notes

- Tool count 16 → 17.
- Reuses every existing pattern (Entry/compile, action union, build*Reaction, buildNonConditionalAction branch, probe-gated motion rewrite) — no new architectural surface.
- The only runtime unknown (transition-on-CHANGE_TO) is explicitly probe-gated with a defined fallback, so neither path is a placeholder.
