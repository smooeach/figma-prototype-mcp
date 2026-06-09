# Overlay "back" Disambiguation + Scroll Cue Strengthening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Steer the LLM to ask the user (rather than guess `proto_back`) when "돌아가/back" is said on an overlay, by fixing the misleading overlay→back description and adding a symmetric ambiguity note; plus strengthen the existing `proto_scroll` disambiguation with its real Korean failing cue.

**Architecture:** describe()-only change. The MCP tool descriptions in `src/server/tools.ts` are the single source of the live LLM cue text; `docs/dictionaries/tool-disambiguation-matrix.md` records intent. No schema, handler, or behavioral code changes. No new tests (the project does not lock description strings in tests); verification is typecheck/build + live re-validation.

**Tech Stack:** TypeScript (tool registration is plain string concatenation in `src/server/tools.ts`), vitest, markdown docs.

**Spec:** `docs/superpowers/specs/2026-06-09-overlay-back-disambiguation-design.md`

---

### Task 1: Fix the overlay→back steering (proto_overlay + proto_back descriptions)

**Files:**
- Modify: `src/server/tools.ts` (the `proto_overlay` entry, currently ~lines 147-157; and the `proto_back` entry, currently ~lines 185-191)

This is the F1 core. Both edits ship together because the guidance is symmetric (each tool points at the other + "ask the user").

- [ ] **Step 1: Replace the misleading line in the `proto_overlay` description**

In `src/server/tools.ts`, find this exact substring inside the `proto_overlay` entry's `description`:

```ts
        "for a full screen change use proto_wire. 'close' = dismiss an open overlay; to return to the " +
        "previous screen use proto_back. " +
```

Replace it with:

```ts
        "for a full screen change use proto_wire. 'close' = dismiss an open overlay, revealing the screen " +
        "underneath it. If the user says 'go back / 돌아가 / 뒤로' while on an overlay, that is AMBIGUOUS " +
        "between close (reveal the underlying screen) and proto_back (history pop) — ask the user which " +
        "they mean rather than guessing. " +
```

- [ ] **Step 2: Append the ambiguity note to the `proto_back` description**

In `src/server/tools.ts`, find this exact substring inside the `proto_back` entry's `description`:

```ts
        "Use for 'go back / 뒤로' = return to whatever screen the user came from (dynamic, no fixed destination). " +
        "To navigate to a SPECIFIC previous frame, use proto_wire instead. " +
```

Replace it with:

```ts
        "Use for 'go back / 뒤로' = return to whatever screen the user came from (dynamic, no fixed destination). " +
        "To navigate to a SPECIFIC previous frame, use proto_wire instead. " +
        "⚠️ If the source is on an OVERLAY (popup/modal/dialog/sheet shown on top of another screen), " +
        "'go back / 돌아가 / 뒤로' is AMBIGUOUS — it may mean dismiss the overlay to reveal the screen " +
        "underneath (= proto_overlay close) or pop the navigation history (= Back, which on an overlay " +
        "often lands on an unexpected earlier frame). Ask the user which they mean before wiring. " +
```

- [ ] **Step 3: Verify the project still typechecks and tests pass**

Run: `npm run typecheck && npm run test`
Expected: PASS. (Description strings are not asserted by any test; this confirms the string edits didn't break syntax. Test count unchanged at 435.)

- [ ] **Step 4: Commit**

```bash
git add src/server/tools.ts
git commit -m "fix(steering): overlay 'back' is ambiguous — ask user (close vs history), drop misleading overlay→back line"
```

---

### Task 2: Strengthen the proto_scroll Korean cue

**Files:**
- Modify: `src/server/tools.ts` (the `proto_scroll` entry, currently ~lines 167-175)

- [ ] **Step 1: Add the Korean failing cue to the `proto_scroll` description**

In `src/server/tools.ts`, find this exact substring inside the `proto_scroll` entry's `description`:

```ts
        "NOT for the general 'scroll feel' between pages — for that effect, use a directional transition " +
```

Replace it with:

```ts
        "NOT for the general 'scroll feel' between pages ('스크롤 느낌으로 화면이 부드럽게 넘어가게') — for that effect, use a directional transition " +
```

- [ ] **Step 2: Verify typecheck + tests**

Run: `npm run typecheck && npm run test`
Expected: PASS (435 tests, unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/server/tools.ts
git commit -m "docs(steering): add Korean '스크롤 느낌' cue to proto_scroll disambiguation"
```

---

### Task 3: Update the disambiguation matrix doc

**Files:**
- Modify: `docs/dictionaries/tool-disambiguation-matrix.md` (Part 1 table, ~lines 9-21)

- [ ] **Step 1: Add the overlay-back ambiguity row and strengthen the scroll row**

In `docs/dictionaries/tool-disambiguation-matrix.md`, find the scroll row in the Part 1 table:

```
| "스크롤 타깃 노드로 점프" (SCROLL_TO) | proto_scroll | jump to a target NODE | proto_wire (PUSH/SLIDE for "scroll feel") |
```

Replace it with these two rows (strengthen scroll's reverse-tool cue + add the new overlay-back ambiguity row):

```
| "스크롤 타깃 노드로 점프" (SCROLL_TO) | proto_scroll | jump to a target NODE | proto_wire (PUSH/SLIDE for "scroll feel" / "스크롤 느낌") |
| "돌아가/뒤로/back" on an OVERLAY (close vs history) | ASK USER | overlay 'back' is ambiguous: close (reveal underlying screen) vs proto_back (history pop) — clarify before wiring | — |
```

- [ ] **Step 2: Commit**

```bash
git add docs/dictionaries/tool-disambiguation-matrix.md
git commit -m "docs(matrix): record overlay back↔close ambiguity + scroll KO cue"
```

---

### Task 4: Verification + live re-validation + release

**Files:** none (verification only)

- [ ] **Step 1: Final full verification**

Run: `npm run typecheck && npm run test && npm run build:plugin`
Expected: ALL PASS (435 tests). Note: `build:plugin` is unaffected by these server-side description edits but confirms nothing regressed.

- [ ] **Step 2: Restart the server so the new descriptions are served**

The running `npm start` server holds the OLD descriptions in memory. Restart it (the tool descriptions are read at registration time): stop the current server process and run `npm start` again. Confirm it logs `listening on http://localhost:3000`.

- [ ] **Step 3: Live re-validation (Claude Desktop + supergateway, file MCP_test_12)**

1. On the overlay frame (popup01, 1173:28): prompt "이 오버레이에서 이전 화면으로 돌아가게 해줘". Expected: the LLM **asks** whether to close the overlay (reveal the underlying screen) or navigate back in history — it should NOT silently wire `proto_back`.
2. Prompt "스크롤 느낌으로 다음 화면 넘어가게 해줘". Expected: the LLM picks a directional transition (PUSH/SLIDE) via `proto_wire`, NOT `proto_scroll`.

Record both outcomes.

- [ ] **Step 4: Release**

describe()-only + doc change. Proposed: patch release **v0.25.1** (bump package.json 0.25.0→0.25.1, commit `chore: release v0.25.1 — overlay back disambiguation`, tag `v0.25.1`, push origin, `gh release create`). Confirm the version decision with the user at this step — the nl-steering-hardening precedent pushed pure-metadata changes without a version tag, so "push without a release" is also valid. Update memory per the shipped-note pattern.

---

## Notes for the implementer

- **This is describe()-only.** Do NOT change any schema, handler, compile mapper, or the history store. If you find yourself editing anything other than the two doc/string locations, stop — you're out of scope.
- **The edits are exact-substring replacements.** The strings in `src/server/tools.ts` are multi-line `+`-concatenated string literals; match the existing indentation (8 spaces) and the `" +` line continuations exactly.
- **No new tests.** The project deliberately does not assert tool-description text in tests (verified: `grep` finds no description-asserting tests). The matrix doc is the intent record; live validation is the real check.
- **Korean text** must be preserved exactly (the em-dash "—" is U+2014; the warning sign "⚠️" is U+26A0 + variation selector). Copy from the plan verbatim.
