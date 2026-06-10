# NL Steering Hardening R2 — Motion-default & Back-affordance

**Date:** 2026-06-10
**Origin:** greenfield from-scratch flow validation findings (see `docs/dictionaries/tool-disambiguation-matrix.md` → "Greenfield flow validation"). Two findings, G6-F1 (motion) and G2-F1 (back), are addressed here.

## Problem

Live greenfield validation surfaced two steering gaps where the LLM did something technically valid but mismatched to intent:

- **G6-F1 — motion default.** `proto_wire`'s default motion is `M3_EMPHASIZED`, which (like all 10 M3/HIG presets) resolves to a `SMART_ANIMATE` transition. SMART_ANIMATE only morphs layers that share a name between the source and destination frames; between fully distinct screens (e.g. a checkout flow `cart → payment → complete`) there is nothing to match, so the animation degrades to a poor cross-fade. The LLM applied it silently to 3 non-matching checkout wires.
- **G2-F1 — back-affordance discovery.** For the abstract prompt "각 화면에 뒤로가기 달아줘" the LLM did not scan for an existing back-button node; it defaulted to a frame-level `ON_DRAG` swipe-back gesture. When the prompt explicitly named the element ("좌상단 백버튼") discovery succeeded. So the gap is: abstract intent does not trigger active element search.

## Goals

1. SMART_ANIMATE is used only where it actually animates something; otherwise the motion degrades gracefully.
2. Directional transitions (PUSH/MOVE_IN/MOVE_OUT) are reachable from natural-language spatial cues.
3. `proto_back` actively looks for a visible back affordance before falling back to a gesture, and asks the user when intent is genuinely ambiguous.

Non-goals: changing overlay/scroll/back/url/set default motion; auto-creating nodes (proto_* only wires existing nodes — create-vs-wire boundary, G6 lesson).

## Design

### A. Motion default

Three independent parts.

#### A1 — Layer-match-aware degrade (plugin-side, deterministic)

The plugin already rewrites `SMART_ANIMATE → DISSOLVE` for overlay/swap/close actions (`rewriteForOverlay`, server-side, action-conditioned). A1 adds an analogous rewrite conditioned on **layer matching**, which requires the node tree and therefore lives **plugin-side** inside CREATE_REACTIONS handling.

Rule, applied to a connection whose resolved `transition.type === "SMART_ANIMATE"` AND whose action is a frame navigate:

1. Resolve the **source top-level frame**: walk `sourceNodeId`'s ancestors upward until the parent is a PAGE or SECTION.
2. Collect the set of **all descendant layer names** (recursive) for both the source top-level frame and the destination frame. (SMART_ANIMATE matches by name at any depth.)
3. If the **intersection is empty (zero shared names)** → rewrite the transition to the connection's `degradeTo` target (default `DISSOLVE`). When degrading to `DISSOLVE`, preserve the SMART_ANIMATE `duration`/`easing`; `INSTANT` carries neither. If **≥1 shared name** → keep SMART_ANIMATE untouched (the designer may intend that morph; conservative threshold minimizes false degradation).

**Scope:** `proto_wire` navigate connections and `proto_conditional`'s `navigate` branch only. Excluded: overlay/swap/close (already DISSOLVE-rewritten), scroll (target is a node inside the same frame — matching moot), back (no fixed destination frame), url, set_variable.

**`degradeTo` field:** optional per-entry on `ProtoWireEntry` and `ProtoConditionalEntry`, `z.enum(["DISSOLVE","INSTANT"]).default("DISSOLVE")`. Threaded through compile → connection → plugin. Only consulted when the A1 degrade fires. `describe()`: "Fallback transition used when a SMART_ANIMATE motion has no matching layers between frames; DISSOLVE keeps a soft fade, INSTANT cuts immediately."

#### A2 — DISSOLVE matchLayers (probe-gated)

A DISSOLVE with "smart animate matching layers" ON is strictly nicer than a plain DISSOLVE when some layers do match. Per Figma's plugin typings `matchLayers` is declared **only on directional transitions**, not on `SimpleTransition` (DISSOLVE). The Figma UI shows the checkbox for Dissolve, so this is a candidate typings≠runtime gap (cf. `initialVelocity`, `preserveScrollPosition`).

**Implementation step 1 is a live probe:** call `setReactionsAsync` with a DISSOLVE transition carrying `matchLayers: true` and read it back.

- **If runtime accepts** → add `matchLayers` to `SimpleTransitionObject`; emit `matchLayers: true` on every DISSOLVE we produce (A1 degrade path, overlay rewrite path, explicit DISSOLVE).
- **If runtime rejects** → the "layer-matched fade" intent is expressed instead with a **DirectionalTransition carrying `matchLayers: true`**; plain DISSOLVE stays `matchLayers`-less. Document the Figma limitation in the matrix doc and a memory.

This is the one part with an unknown live outcome; everything downstream of it branches on the probe.

#### A3 — Spatial-cue steering (describe-only)

- `MotionInputSchema.describe()` += spatial cues: "밀고 들어오는/들어와 → MOVE_IN; 밀어내며/나가며 → MOVE_OUT; 올라오는/올라와 → MOVE_IN with direction TOP/BOTTOM". (PUSH/slide cues already present.)
- `proto_wire` description: note that the default SMART_ANIMATE **degrades to the fallback transition when the two frames share no matching layers**, and that spatial instructions should pass a directional `TransitionInput`.

### B. Back-affordance discovery (describe-only)

Layer `proto_back`'s description:

1. **Search first.** Actively look for a back-affordance node in the source frame — a small top-left icon, a node whose name contains `back`/`arrow`/`chevron`/`prev`, or a `<`/`‹` glyph — and wire it with `ON_CLICK`.
2. **Explicit gesture cue.** If the prompt names a gesture ("스와이프/밀어서 뒤로") → frame-level `ON_DRAG` swipe-back.
3. **Ambiguous (abstract intent + no back node found).** Ask the user: "백버튼이 안 보이는데 스와이프 제스처로 할까요?" Do **not** wire a silent gesture, and do **not** create a node (proto_back only wires).

## Testing

- **A1** — unit tests for the plugin degrade function: given source/target descendant-name sets → expected transition (zero-match → degradeTo; ≥1 match → unchanged; non-SMART_ANIMATE → unchanged; non-navigate action → unchanged). Test the source-top-level-frame ancestor walk (nested component case, PAGE/SECTION terminator).
- **A2** — record probe outcome; if `matchLayers` added to schema, schema acceptance/round-trip test.
- **A3 / B** — describe() content is the source of truth; add corresponding rows to `docs/dictionaries/tool-disambiguation-matrix.md` (Part 1/2/3).
- **Live verification** — one Claude Desktop round re-running the relevant greenfield scenarios (G2 back, a non-matching forward wire, a "밀어서/올라와" spatial wire).

## Risks / open

- **A2 probe** outcome is unknown until live; the schema change is conditional on it.
- **A1 source-frame resolution** — a source node nested inside a component/instance must walk to the right top-level frame; terminator is parent ∈ {PAGE, SECTION}.
- **A1 heuristic** is name-based and conservative (zero-match only). It will not catch the case where layers share names but are visually unrelated — accepted, since false degradation is worse than a slightly-off SMART_ANIMATE the designer can override.
