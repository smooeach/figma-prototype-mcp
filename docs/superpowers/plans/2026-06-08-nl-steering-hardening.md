# NL Steering Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden natural-language steering of the MCP tool surface so an LLM (especially Korean prompts) picks the right tool, trigger, and motion — via tool-description disambiguation clauses and curated KO/EN cue `.describe()` on the shared `TriggerInput` / `MotionInputSchema`, plus a reference matrix doc.

**Architecture:** Pure metadata. Part 1 adds one-sentence "유도 절" disambiguation clauses to 5 proto_* tool descriptions in `src/server/tools.ts` (the proto_scroll exemplar pattern: positive cue + `NOT for X — use Y instead`, bidirectional collisions cross-referenced on both tools). Part 2 attaches `.describe()` carrying a curated KO/EN cue map to the shared `TriggerInput` (`src/mcp-server/tools.ts`) and `MotionInputSchema` (`src/mcp-server/protoTools.ts`) — one describe per shared schema covers the whole surface; full vocabulary stays in `docs/dictionaries/`. Part 3 writes `docs/dictionaries/tool-disambiguation-matrix.md`. No behavior or wire-format change.

**Tech Stack:** TypeScript (strict), zod + zod-to-json-schema (MCP input schemas), vitest, tsup. `tsx` (devDep) for the JSON-schema dump verification. Node ESM (`"type": "module"`).

---

## File structure

- **Modify** `src/server/tools.ts` — add disambiguation clauses to 6 description strings inside `makeTools()`: proto_wire, proto_overlay, proto_back, proto_set_variable, proto_toggle_variable, proto_conditional.
- **Modify** `src/mcp-server/tools.ts` — add `.describe(...)` to the exported `TriggerInput` union (line 60–68).
- **Modify** `src/mcp-server/protoTools.ts` — add `.describe(...)` to `MotionInputSchema` (line 9).
- **Create** `docs/dictionaries/tool-disambiguation-matrix.md` — the reference/matrix doc.

Pre-verified facts (do not re-investigate):
- Tool descriptions are concatenated string literals (`"..." + "..."`) inside `makeTools()` in `src/server/tools.ts`. Tool name lines: proto_wire 118, proto_overlay 133, proto_back 168, proto_set_variable 197, proto_toggle_variable 215, proto_conditional 233.
- `TriggerInput` is exported from `src/mcp-server/tools.ts:60` as a `z.union([...])`; it is ALSO used by the low-level `create_reactions` Connection schema (`tools.ts:203`, `.default("ON_CLICK")`), so describing the export benefits that tool too. `.describe()` on a union does not change `z.infer` types.
- `MotionInputSchema = z.union([PresetNameEnum, TransitionInput])` is local (not exported) in `src/mcp-server/protoTools.ts:9`. It is used by 5 tools (wire/overlay/scroll/back/conditional); url/set_variable/toggle_variable have no motion field.
- The 10 motion presets (`src/shared/motionPresets.ts`) are ALL `SMART_ANIMATE`. Names: M3_EMPHASIZED, M3_EMPHASIZED_DECELERATE, M3_EMPHASIZED_ACCELERATE, M3_STANDARD, M3_STANDARD_DECELERATE, M3_STANDARD_ACCELERATE, HIG_DEFAULT, HIG_SMOOTH, HIG_SNAPPY, HIG_BOUNCY.
- JSON schema shown to the LLM is produced by `zodToJsonSchema(t.schema)` at `src/server/tools.ts:284`. zod-to-json-schema renders a `z.union` as `anyOf` and emits a `.describe()` as a `description` field.
- No schema-snapshot test exists; `.describe()` additions do not change behavior, so the 409-test suite stays green.
- Canonical dictionaries already in repo: `docs/dictionaries/trigger-dictionary-v2.7.1.md`, `natural-language-mapping-dictionary-v2.3.md`, `animation-dictionary-v2.7.1.md` (newer than the v2.0/v2.7 reference attachments — use these as canonical).

Commands: `npm test` (vitest, 409 tests), `npm run typecheck` (`tsc --noEmit`), `npm run build:plugin` (tsup IIFE).

Note on TDD: these are pure metadata (description/`.describe()`) edits with no runtime behavior, so there is no red-green test loop. Each task is edit → verification gates (typecheck + full suite + build stay green) → a concrete `tsx` JSON-schema dump confirming the new text actually surfaces → commit. Per the approved spec, no new test files are added.

---

### Task 1: Tool-selection disambiguation clauses (Part 1)

**Files:**
- Modify: `src/server/tools.ts`

- [ ] **Step 1: Add the proto_wire ↔ proto_overlay clause to proto_wire**

In `src/server/tools.ts`, find the proto_wire description (name at line 118). Replace:

```ts
        "Wire one or more source nodes to destination frames with Navigate To. " +
```

with:

```ts
        "Wire one or more source nodes to destination frames with Navigate To. " +
        "Use when the WHOLE screen changes to the destination. For a modal/popup/dialog/toast/sheet " +
        "that appears ON TOP of the current screen ('떠/팝업/모달'), use proto_overlay (open) instead. " +
```

- [ ] **Step 2: Add the proto_overlay ↔ proto_wire/proto_back clause to proto_overlay**

Find the proto_overlay description (name at line 133). Replace:

```ts
        "open/swap require an `overlay` frameId; close has none. " +
```

with:

```ts
        "open/swap require an `overlay` frameId; close has none. " +
        "'open' = content floating above the current screen (modal/popup/dialog/toast/bottom-sheet); " +
        "for a full screen change use proto_wire. 'close' = dismiss an open overlay; to return to a " +
        "previous full screen use proto_back. " +
```

- [ ] **Step 3: Add the proto_back ↔ proto_wire clause to proto_back**

Find the proto_back description (name at line 168). Replace:

```ts
        "Wire source nodes to the Back navigation action (pops the prototype history stack — no destination). " +
```

with:

```ts
        "Wire source nodes to the Back navigation action (pops the prototype history stack — no destination). " +
        "Use for 'go back / 뒤로' = return to whatever screen the user came from (dynamic, no fixed destination). " +
        "To navigate to a SPECIFIC previous frame, use proto_wire instead. " +
```

- [ ] **Step 4: Add the set_variable ↔ toggle_variable clause to proto_set_variable**

Find the proto_set_variable description (name at line 197). Replace:

```ts
        "pass `value` as a hex string (\"#RRGGBB\" or \"#RRGGBBAA\"). " +
```

with:

```ts
        "pass `value` as a hex string (\"#RRGGBB\" or \"#RRGGBBAA\"). " +
        "To flip a BOOLEAN without naming the target value ('토글/켜고 끄기'), use proto_toggle_variable — " +
        "this tool assigns a SPECIFIC value. " +
```

- [ ] **Step 5: Add the toggle_variable ↔ set_variable clause to proto_toggle_variable**

Find the proto_toggle_variable description (name at line 215). Replace:

```ts
        "(plugin rejects otherwise). " +
```

with:

```ts
        "(plugin rejects otherwise). " +
        "Use to flip/switch a boolean ('토글') with no named target value; to assign a specific value " +
        "(true/false/number/string/color) use proto_set_variable instead. " +
```

- [ ] **Step 6: Add a Korean intent cue to proto_conditional (clarity/discoverability)**

Find the proto_conditional description (name at line 233). Replace:

```ts
        "Wire a conditional reaction (if/then/else) on a source node based on a variable comparison. " +
```

with:

```ts
        "Wire a conditional reaction (if/then/else) on a source node based on a variable comparison. " +
        "Use for '~면 ~하고 아니면 ~' / '조건에 따라' branching interactions. " +
```

(No semantic change — the existing constraint text, single-action-per-branch / no else-if / no toggle-nesting / COLOR-not-comparable, is left intact.)

- [ ] **Step 7: Verify the surface still type-checks, tests pass, and builds**

Run: `npm run typecheck`
Expected: clean (string-only edits).

Run: `npm test`
Expected: 409 passed (descriptions are metadata; no test depends on description text).

Run: `npm run build:plugin`
Expected: build success (these edits are MCP-server-side; the plugin bundle is unaffected).

- [ ] **Step 8: Confirm the new clauses are actually exposed in the tool list JSON**

Run:

```bash
npx tsx -e "import('./src/server/history.ts').then(async (h)=>{const {makeTools}=await import('./src/server/tools.ts');const {zodToJsonSchema}=await import('zod-to-json-schema');const tools=makeTools(new h.HistoryStore());const find=(n)=>tools.find(t=>t.name===n);const s=JSON.stringify(tools.map(t=>({name:t.name,description:t.description})));console.log(['proto_overlay (open) instead','use proto_back','use proto_wire instead','토글/켜고 끄기','조건에 따라'].every(x=>s.includes(x))?'CLAUSES PRESENT':'MISSING');})"
```

Expected: `CLAUSES PRESENT`.

(If `HistoryStore`'s constructor signature differs, fall back to: `grep -c "proto_overlay (open) instead" src/server/tools.ts` → expect `1`, and repeat for each clause's anchor phrase.)

- [ ] **Step 9: Commit**

```bash
git add src/server/tools.ts
git commit -m "feat(tools): add NL tool-selection disambiguation clauses (back/set/toggle/wire/overlay/conditional)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Curated KO/EN trigger + motion cue `.describe()` (Part 2)

**Files:**
- Modify: `src/mcp-server/tools.ts`
- Modify: `src/mcp-server/protoTools.ts`

- [ ] **Step 1: Attach the trigger cue describe to the shared `TriggerInput`**

In `src/mcp-server/tools.ts`, replace the `TriggerInput` union (lines 60–68):

```ts
export const TriggerInput = z.union([
  TriggerEnum,
  TriggerObjectNoParam,
  TriggerObjectAfterTimeout,
  TriggerObjectMouseClick,
  TriggerObjectMouseHover,
  TriggerObjectKeyDown,
  TriggerObjectMediaHit,
]);
```

with:

```ts
export const TriggerInput = z.union([
  TriggerEnum,
  TriggerObjectNoParam,
  TriggerObjectAfterTimeout,
  TriggerObjectMouseClick,
  TriggerObjectMouseHover,
  TriggerObjectKeyDown,
  TriggerObjectMediaHit,
]).describe(
  "When the interaction fires. Default ON_CLICK. Natural-language cues (KO/EN): " +
    "ON_CLICK=클릭/탭/누르면/click,tap; " +
    "ON_HOVER=호버/마우스 올리면/'~하는 동안'/while hovering (round-trip: auto-reverts when cursor leaves); " +
    "ON_PRESS=꾹/길게 누르면/누르고 있으면/long-press (round-trip: reverts on release); " +
    "ON_DRAG=드래그/스와이프/끌면/밀면/swipe; " +
    "MOUSE_ENTER=마우스 들어오면/'한번 호버하면 유지'/permanent hover (one-way, stays — distinct from ON_HOVER); " +
    "MOUSE_LEAVE=마우스 나가면/커서 빠지면; MOUSE_DOWN=누르는 순간; MOUSE_UP=떼면; " +
    "AFTER_TIMEOUT=N초 후/잠시 후/자동으로 (requires timeout in seconds; 잠깐≈0.5, 잠시≈1, 몇 초≈3); " +
    "ON_KEY_DOWN=엔터/단축키/Cmd+K (requires device + keyCodes, e.g. Cmd+K=[91,75]); " +
    "ON_MEDIA_END=영상 끝나면; ON_MEDIA_HIT=영상 N초 시점 (requires mediaHitTime in seconds). " +
    "Decision rules: '누르면/press' alone → ON_CLICK, with '꾹/길게/hold' → ON_PRESS; " +
    "'호버/hover' alone → ON_HOVER, with '유지/계속/stays' → MOUSE_ENTER. " +
    "Full vocabulary: docs/dictionaries/trigger-dictionary.",
);
```

- [ ] **Step 2: Attach the motion cue describe to `MotionInputSchema`**

In `src/mcp-server/protoTools.ts`, replace line 9:

```ts
const MotionInputSchema = z.union([PresetNameEnum, TransitionInput]);
```

with:

```ts
const MotionInputSchema = z.union([PresetNameEnum, TransitionInput]).describe(
  "How it animates: a preset name OR a full TransitionInput. Natural-language → preset (KO/EN): " +
    "부드럽게/자연스럽게/smooth → M3_STANDARD; 강조/묵직/emphasized → M3_EMPHASIZED (default); " +
    "튀는/통통/스프링/bouncy → HIG_BOUNCY; 빠르게/스냅/snappy → HIG_SNAPPY; 느리게/여유/slow → HIG_SMOOTH; " +
    "iOS/애플 → HIG_DEFAULT; Material/안드로이드 → M3_*. " +
    "All 10 presets are SMART_ANIMATE (morph). A directional feel (옆으로/슬라이드/다음으로/넘기듯/push,slide) " +
    "or a fade (서서히/흐려지며/fade) is NOT a preset — pass a TransitionInput instead: " +
    "{type:'PUSH'|'SLIDE_IN'|'SLIDE_OUT', direction} or {type:'DISSOLVE'}. " +
    "Duration cues: 빠르게≈0.1–0.15s, 보통≈0.15s, 부드럽게≈0.25s, 느리게≈0.4s. " +
    "Full vocabulary: docs/dictionaries/.",
);
```

- [ ] **Step 3: Verify type-check, tests, and build**

Run: `npm run typecheck`
Expected: clean (`.describe()` does not change `z.infer` types; `TriggerInput.optional()` / `MotionInputSchema.optional()` call sites are unaffected).

Run: `npm test`
Expected: 409 passed.

Run: `npm run build:plugin`
Expected: build success.

- [ ] **Step 4: Confirm both cue maps surface in a tool's JSON schema**

Run:

```bash
npx tsx -e "import('zod-to-json-schema').then(async ({zodToJsonSchema})=>{const {ProtoWireInput}=await import('./src/mcp-server/protoTools.ts');const s=JSON.stringify(zodToJsonSchema(ProtoWireInput));console.log((s.includes('꾹/길게')&&s.includes('MOUSE_ENTER')&&s.includes('HIG_BOUNCY')&&s.includes('SMART_ANIMATE'))?'CUES PRESENT':'MISSING');})"
```

Expected: `CUES PRESENT` (ProtoWireInput carries both `trigger` and `motion`, so one dump covers both describes).

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/tools.ts src/mcp-server/protoTools.ts
git commit -m "feat(schema): curated KO/EN trigger + motion cues via shared .describe()

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Reference / disambiguation matrix doc (Part 3)

**Files:**
- Create: `docs/dictionaries/tool-disambiguation-matrix.md`

- [ ] **Step 1: Create the matrix doc**

Create `docs/dictionaries/tool-disambiguation-matrix.md` with this exact content:

````markdown
# Tool Disambiguation Matrix

Records the natural-language → tool/trigger/motion steering baked into the MCP surface, and serves as the scoring checklist for the next real LLM validation (Claude Desktop + supergateway). Companion to the vocabulary dictionaries in this folder.

**Single source of the live cue text:** the schema `.describe()` in code (`TriggerInput` in `src/mcp-server/tools.ts`, `MotionInputSchema` in `src/mcp-server/protoTools.ts`) and the tool descriptions in `src/server/tools.ts`. This doc records intent + the full-vocabulary pointers; if they diverge, the code wins.

## Part 1 — Tool selection (which proto_* tool)

| Ambiguous phrase | Chosen tool | Steering clause (in tool description) | Reverse tool |
|---|---|---|---|
| "뒤로 / go back" (return to where you came from) | proto_back | dynamic, no fixed destination | — |
| "이전 화면 X로 이동" (specific previous frame) | proto_wire | navigate to that frame | proto_back |
| "X 뜨게/팝업/모달/위에" (floats above current screen) | proto_overlay (open) | modal/popup/dialog/toast/bottom-sheet on top | proto_wire |
| "X로 화면 전환/이동" (whole screen changes) | proto_wire | full screen change | proto_overlay |
| "오버레이 닫기" (dismiss open overlay) | proto_overlay (close) | dismiss an open overlay | proto_back |
| "boolean 변수 토글/켜고 끄기" (flip, no named value) | proto_toggle_variable | flip with no target value | proto_set_variable |
| "변수를 특정 값으로 (true/false/숫자/문자/색)" | proto_set_variable | assign a SPECIFIC value | proto_toggle_variable |
| "스크롤 타깃 노드로 점프" (SCROLL_TO) | proto_scroll | jump to a target NODE | proto_wire (PUSH/SLIDE for "scroll feel") |
| "조건에 따라 / ~면 ~하고 아니면 ~" | proto_conditional | variable-comparison branching | — |

Untouched (correct as-is): proto_scroll (exemplar), proto_url, create_reactions (low-level escape hatch), the read/utility low-level tools.

## Part 2 — Trigger cues (curated subset → `TriggerInput.describe()`)

Full set: `trigger-dictionary-v2.7.1.md`. Curated representative cues currently in the schema describe:

| Trigger | Representative KO/EN cues | Notes |
|---|---|---|
| ON_CLICK | 클릭/탭/누르면 · click/tap | default |
| ON_HOVER | 호버/마우스 올리면/"~하는 동안" · while hovering | round-trip (auto-revert) |
| ON_PRESS | 꾹/길게 누르면/누르고 있으면 · long-press | round-trip (revert on release) |
| ON_DRAG | 드래그/스와이프/끌면/밀면 · swipe | continuous |
| MOUSE_ENTER | 마우스 들어오면/"한번 호버하면 유지" · permanent hover | one-way; distinct from ON_HOVER |
| MOUSE_LEAVE | 마우스 나가면/커서 빠지면 | one-way |
| MOUSE_DOWN | 누르는 순간 | / MOUSE_UP = 떼면 |
| AFTER_TIMEOUT | N초 후/잠시 후/자동으로 | needs timeout(s); 잠깐≈0.5, 잠시≈1, 몇 초≈3 |
| ON_KEY_DOWN | 엔터/단축키/Cmd+K | needs device + keyCodes (Cmd+K=[91,75]) |
| ON_MEDIA_END | 영상 끝나면 | |
| ON_MEDIA_HIT | 영상 N초 시점 | needs mediaHitTime(s) |

Decisive disambiguations: "누르면" alone → ON_CLICK / "꾹·길게" → ON_PRESS; "호버" alone → ON_HOVER / "유지·계속" → MOUSE_ENTER.

## Part 3 — Motion cues (curated subset → `MotionInputSchema.describe()`)

Full set: `natural-language-mapping-dictionary-v2.3.md`, `animation-dictionary-v2.7.1.md`. Curated tone→preset map currently in the schema describe:

| Natural language (KO/EN) | Preset |
|---|---|
| 부드럽게/자연스럽게 · smooth | M3_STANDARD |
| 강조/묵직 · emphasized | M3_EMPHASIZED (default) |
| 튀는/통통/스프링 · bouncy | HIG_BOUNCY |
| 빠르게/스냅 · snappy | HIG_SNAPPY |
| 느리게/여유 · slow | HIG_SMOOTH |
| iOS/애플 | HIG_DEFAULT |
| Material/안드로이드 | M3_* |

All 10 presets are SMART_ANIMATE (morph). Directional feel (옆으로/슬라이드/다음으로/넘기듯) or fade (서서히/흐려지며) is NOT a preset — pass a `TransitionInput` (`{type:"PUSH"|"SLIDE_IN"|"SLIDE_OUT", direction}` / `{type:"DISSOLVE"}`). Duration: 빠르게≈0.1–0.15s, 보통≈0.15s, 부드럽게≈0.25s, 느리게≈0.4s.

## Deferred validation checklist

Re-run against the live server (Claude Desktop + supergateway). For each Part 1 row, confirm the prompt routes to the Chosen tool; for Parts 2–3, confirm KO cues resolve to the listed trigger/preset. Record misses here as the next round of work.
````

- [ ] **Step 2: Commit**

```bash
git add docs/dictionaries/tool-disambiguation-matrix.md
git commit -m "docs: tool-disambiguation matrix + curated cue reference

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Final whole-change verification

**Files:** none (verification only)

- [ ] **Step 1: Full gate run**

Run: `npm run typecheck`
Expected: clean.

Run: `npm test`
Expected: 409 passed.

Run: `npm run build:plugin`
Expected: build success.

- [ ] **Step 2: Confirm the complete steered surface in one dump**

Run:

```bash
npx tsx -e "import('zod-to-json-schema').then(async ({zodToJsonSchema})=>{const {ProtoWireInput,ProtoOverlayInput}=await import('./src/mcp-server/protoTools.ts');const s=JSON.stringify({w:zodToJsonSchema(ProtoWireInput),o:zodToJsonSchema(ProtoOverlayInput)});const checks=['꾹/길게','MOUSE_ENTER','HIG_BOUNCY','SMART_ANIMATE'];console.log(checks.every(c=>s.includes(c))?'OK: cues surfaced':'MISSING');})"
```

Expected: `OK: cues surfaced`.

- [ ] **Step 3: No commit needed** (verification only; all changes already committed in Tasks 1–3).

---

## Notes for the implementer

- **Metadata-only:** every change is a description string or a `.describe()`. There is no runtime behavior change and no wire-format change, so the existing 409-test suite is the regression guard — it must stay green, not grow.
- **Bidirectional clauses:** proto_wire↔proto_overlay and proto_set_variable↔proto_toggle_variable are cross-referenced on BOTH tools by design. Do not drop one side.
- **Server-side only:** all edits are in `src/server/` and `src/mcp-server/` — outside the tsup plugin bundle, so there is no figma.*/zod purity concern (unlike the plugin modules).
- **`.describe()` on a union:** attaches a `description` to the `anyOf` node in the generated JSON schema; it does not alter `z.infer` types, so `.optional()` / `.default()` call sites compile unchanged.
- **Keep describes tight:** zod-to-json-schema may inline each describe per referencing tool (trigger ×8, motion ×5). Do not expand toward a full-dictionary dump — the dictionaries hold the full vocabulary; the schema holds the curated subset.
- **Do not change** `motionPresets.ts`, `reaction-builder.ts`, the dictionaries, or any compile/build logic — this plan only edits descriptions, two `.describe()` calls, and adds one doc.
