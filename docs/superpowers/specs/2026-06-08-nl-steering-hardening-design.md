# Natural-language steering hardening (tool disambiguation + KO trigger/motion cues) — Design

**Date:** 2026-06-08
**Status:** Approved (brainstorming)

## Goal

Harden the MCP tool surface's natural-language steering so an LLM (especially Korean-language prompts) picks the **right tool**, the **right trigger**, and the **right motion** without external system-prompt injection. Pure metadata work — tool/schema descriptions only, no behavior or wire-format change.

This is the "resolve LLM validation gaps" follow-up to the v0.21.0 Claude Desktop validation. The two documented v0.21.0 recommendations are already handled (proto_scroll disambiguation applied at `tools.ts`; proto_get_last_history intentionally left — it loses to Claude Desktop's native chat memory, not a description weakness). Since that validation, 3 tools shipped unvalidated (proto_set_variable / proto_toggle_variable / proto_conditional), and the trigger/motion natural-language dimensions were never surfaced in the schema at all.

**Approach chosen: A (manual description edits + a standalone reference/matrix doc).** Rejected B (matrix as single source, descriptions composed from it) — premature to lock unvalidated wording into a generation mechanism. Order is: A now (write + record wording) → defer real LLM re-validation (needs Claude Desktop + supergateway, can't be automated here) → then B once wording is validated.

## Verification reality

Description *effectiveness* can only be truly confirmed by real LLM validation, which is deferred. So the deliverable includes a **reference/matrix doc** that records every ambiguity → chosen tool → steering phrase, serving as the scoring checklist for that future validation. No new test infrastructure (per decision) — existing 409-test suite + typecheck + build are the regression guard; descriptions are metadata so they don't change behavior.

---

## Part 1 — Tool-selection disambiguation (which proto_* to pick)

Audit of all 15 tools across 3 ambiguity classes. The proven failure pattern is proto_scroll's "domain-term ↔ general-language collision" (already fixed; used as the exemplar). New edits target the analogous collisions.

### Edit pattern (from the proto_scroll exemplar)

Standard "유도 절" shape: `[what it does + trigger phrasing] … NOT for X — use Y instead`. Rules:
- One sentence per added clause (descriptions are already long; avoid token dilution).
- Korean trigger phrases inline in quotes (established pattern: proto_get_last_history's "방금 만든 거", proto_scroll's 'scroll feel').
- Bidirectional collisions get a cross-reference on **both** tools (one-sided edits leave the reverse mis-route).

### Concrete edits (#1–#5)

| # | Class | Tool(s) | Added clause (final wording confirmed at implementation) |
|---|---|---|---|
| 1 | domain collision | **proto_back** | "Use for 'go back / 뒤로' = return to whatever screen the user came from (dynamic, no fixed destination). To navigate to a SPECIFIC previous frame, use **proto_wire** instead." |
| 2 | domain collision | **proto_set_variable** | "To flip a BOOLEAN without naming the target value ('토글/켜고 끄기'), use **proto_toggle_variable** — this tool assigns a SPECIFIC value." |
| 2 | domain collision | **proto_toggle_variable** | "Use to flip/switch a boolean ('토글') with no named target value. To assign a specific value (true/false/number/string/color), use **proto_set_variable** instead." |
| 3 | intent overlap | **proto_wire** | "Use when the WHOLE screen changes to the destination. For a modal/popup/dialog/toast/sheet that appears ON TOP of the current screen ('떠/팝업/모달'), use **proto_overlay** (open) instead." |
| 3+4 | intent overlap | **proto_overlay** | "'open' = content floating above the current screen (modal/popup/dialog/toast/bottom-sheet); for a full screen change use **proto_wire**. 'close' = dismiss an open overlay; to return to a previous full screen use **proto_back**." |
| 5 | capability | **proto_conditional** | Clarity pass only — already documents single-action-per-branch / no else-if / no toggle-nesting / COLOR-not-comparable. Tighten wording/ordering; no semantic change. |

Untouched (already correct / validated working): proto_scroll (exemplar), proto_url/set/toggle "no motion field" notes, proto_overlay SMART_ANIMATE→DISSOLVE Note, create_reactions low-level escape-hatch steering, the 6 read/utility low-level tools.

---

## Part 2 — Trigger + Motion natural-language cues (KO + EN)

Currently `TriggerInput` (`tools.ts:60`) and `MotionInputSchema` (`protoTools.ts:9`) carry **no `.describe()`** — the LLM sees only type/preset names, zero natural-language cues. Inject curated Korean+English cue maps drawn from the repo's canonical dictionaries (`docs/dictionaries/trigger-dictionary-v2.7.1.md`, `natural-language-mapping-dictionary-v2.3.md`, `animation-dictionary-v2.7.1.md` — newer than the v2.0/v2.7 reference attachments).

**Placement = the shared schema field's `.describe()` (single source).** All mutating proto_* tools take `trigger` (`TriggerInput`); the animating subset (wire / overlay / scroll / back / conditional) also takes `motion` (`MotionInputSchema`) — url / set_variable / toggle_variable have no motion field. One describe on each shared schema covers its whole surface. This is a normal schema description, distinct from the deferred B (composing tool descriptions from the matrix). Full 50–100-per-trigger vocabulary stays in the dictionary docs — descriptions hold a curated subset only.

### A) `TriggerInput.describe()` (curated, ~12 lines)

Per-trigger representative KO/EN cues + the two decisive disambiguations:
- Default ON_CLICK. ON_CLICK=클릭/탭/누르면 · ON_HOVER=호버/마우스 올리면/"~하는 동안" (round-trip, reverts when cursor leaves) · ON_PRESS=꾹/길게 누르면 (round-trip, reverts on release) · ON_DRAG=드래그/스와이프/끌면/밀면 · MOUSE_ENTER=마우스 들어오면/"한번 호버하면 유지" (one-way, permanent — distinct from ON_HOVER) · MOUSE_LEAVE=마우스 나가면 · MOUSE_DOWN=누르는 순간 · MOUSE_UP=떼면 · AFTER_TIMEOUT=N초 후/잠시 후/자동으로 (requires timeout sec; 잠깐≈0.5, 잠시≈1, 몇 초≈3) · ON_KEY_DOWN=엔터/단축키/Cmd+K (device+keyCodes, e.g. Cmd+K=[91,75]) · ON_MEDIA_END=영상 끝나면 · ON_MEDIA_HIT=영상 N초 시점 (mediaHitTime sec).
- **Decision rules:** "누르면/press" alone → ON_CLICK; with "꾹/길게/hold" → ON_PRESS. "호버" alone → ON_HOVER; with "유지/계속/stays" → MOUSE_ENTER. Full vocabulary: `docs/dictionaries/trigger-dictionary`.

### B) `MotionInputSchema.describe()` (curated)

- motion = a preset name OR a TransitionInput. 부드럽게/자연스럽게→M3_STANDARD · 강조/묵직→M3_EMPHASIZED (default) · 튀는/통통/스프링→HIG_BOUNCY · 빠르게/스냅→HIG_SNAPPY · 느리게/여유→HIG_SMOOTH · iOS/애플→HIG_DEFAULT, Material/안드로이드→M3_*.
- **All 10 presets are SMART_ANIMATE (morph).** A directional feel (옆으로/슬라이드/다음으로/넘기듯) or a fade (서서히/흐려지며) is NOT expressible as a preset — pass a `TransitionInput`: `{type:"PUSH"|"SLIDE_*", direction}` or `{type:"DISSOLVE"}`. Duration words: 빠르게≈0.1–0.15s, 보통≈0.15s, 부드럽게≈0.25s, 느리게≈0.4s. Full vocabulary: `docs/dictionaries/`.

**Cost tradeoff:** zodToJsonSchema may inline `.describe()` per tool (trigger ×8, motion ×5). Keep both describes tight/compressed; no full-dictionary dump.

---

## Deliverable doc

`docs/dictionaries/tool-disambiguation-matrix.md` (same folder as existing dictionaries), 3 parts:
1. **Tool-disambiguation matrix** (#1–#5): `ambiguous phrase → chosen tool → steering clause → reverse tool`. Source of truth for Part 1 wording + the future-validation checklist.
2. **Trigger curation table**: which representative cues landed in `TriggerInput.describe()`, linking to `trigger-dictionary-v2.7.1.md` for the full set.
3. **Motion curation table**: tone→preset map + directional/fade transition note, linking to `natural-language-mapping-v2.3` / `animation-v2.7.1`.

Drift control: the **single source for the curated cue text is the schema `.describe()` (code)**. The doc holds the #1–#5 matrix, full-dictionary pointers, and the validation checklist; its curation tables point at "currently reflected in describe."

## Verification gates

- `npm run typecheck` — clean.
- `npm test` — 409 pass unchanged (descriptions are metadata; behavior/schema shape unchanged — update a schema snapshot test only if one exists).
- `npm run build:plugin` — succeeds. The describes live in MCP-server code (`tools.ts` / `protoTools.ts`), outside the plugin bundle — no figma/zod purity concern.
- Manual: dump the tool-list JSON once and eyeball that the describe text is actually exposed.

## Out of scope

- Any behavior / wire-format change (describe is pure metadata).
- Integrating the full dictionaries into a system prompt (separate, larger effort) — this ships the curated subset only.
- Approach B (matrix → description composition) — deferred until after real LLM re-validation.
- The `proto_get_last_history` chat-memory gap — separate, and not fixable on our side.
- Real LLM re-validation itself — deferred (needs Claude Desktop + supergateway; not automatable here). The matrix doc is its checklist.
