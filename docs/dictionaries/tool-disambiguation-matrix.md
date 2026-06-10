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
| "스크롤 타깃 노드로 점프" (SCROLL_TO) | proto_scroll | jump to a target NODE | proto_wire (PUSH/SLIDE for "scroll feel" / "스크롤 느낌") |
| "돌아가/뒤로/back" on an OVERLAY (close vs history) | ASK USER | overlay 'back' is ambiguous: close (reveal underlying screen) vs proto_back (history pop) — clarify before wiring | — |
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
| 밀고 들어오는 / 들어와 | `{type:'MOVE_IN', direction}` (spatial entry, not a preset) |
| 밀어내며 / 나가며 | `{type:'MOVE_OUT', direction}` (spatial exit) |
| 올라오는 / 올라와 | `{type:'MOVE_IN', direction:'BOTTOM'}` (bottom-sheet-like rise) |
| 내려오는 | `{type:'MOVE_IN', direction:'TOP'}` (slides down from top) |

All 10 presets are SMART_ANIMATE (morph). Directional feel (옆으로/슬라이드/다음으로/넘기듯) or fade (서서히/흐려지며) is NOT a preset — pass a `TransitionInput` (`{type:"PUSH"|"SLIDE_IN"|"SLIDE_OUT", direction}` / `{type:"DISSOLVE"}`). Duration: 빠르게≈0.1–0.15s, 보통≈0.15s, 부드럽게≈0.25s, 느리게≈0.4s. Default motion is M3_EMPHASIZED (SMART_ANIMATE); between distinct screens that share no matching layer names it auto-degrades to DISSOLVE (or the connection's `degradeTo`, e.g. INSTANT).

## Deferred validation checklist

Re-run against the live server (Claude Desktop + supergateway). For each Part 1 row, confirm the prompt routes to the Chosen tool; for Parts 2–3, confirm KO cues resolve to the listed trigger/preset. Record misses here as the next round of work.

### Greenfield (from-scratch) flow validation — 2026-06-10

First non-modify-existing validation: build the whole interaction layer on a frames-only fixture (section `MCP_test_13`, frames `login`/`home`/`detail`/`menu` + checkout frames created live in G6). 6 scenarios in Claude Desktop. **Overall: PASS** — proto_* surface + design-MCP handoff construct a coherent multi-step flow from scratch; self-discovery (no node selected → structure scan → section pick → ambiguity warning) works.

| # | Prompt (intent) | Tool | Result |
|---|---|---|---|
| G1 | login→home→detail 연결 | proto_wire | ✅ multi-step chain; auto-discovered frames by name/structure; pre-warned MCP_test_12 lacks `detail` |
| G2 | 각 화면 뒤로가기 | proto_back | ✅ home→login, detail→home, login excluded — **but see G2-F1** |
| G3 | home 메뉴 버튼 → menu 오버레이 + 닫기 | proto_overlay | ✅ open+close one flow; surfaced overlay-DISSOLVE Figma constraint (v1.20) |
| G4 | login set loggedIn=true; home 분기 | proto_set_variable + proto_conditional | ✅✅ **added set to existing G1 wire (didn't clobber)**; resolved `loggedIn` in `DuMat` collection by name (v0.25.0); flagged else-dest assumption |
| G5 | detail 세로 스크롤 | set_frame_scroll | ✅✅ surfaced content-height>frame-height prerequisite (test target hit); recognized content is create-side |
| G6 | 결제 플로우 새 프레임부터 | use_figma → proto_wire | ✅✅✅ recognized frame creation out of scope → **design-MCP handoff** → created cart/payment/complete (360×740) → wired into greenfield path; **no flailing/hallucination** — **but see G6-F1** |

**Findings (steering candidates, not blockers):**
- **G2-F1** — abstract intent ("뒤로가기 *달아줘*") → LLM defaults to **gesture fallback (ON_DRAG swipe-back)** instead of scanning for a back-affordance node; explicit element naming ("좌상단 백버튼") fixes it. Contrast G3 where the prompt *named* "메뉴 버튼" and discovery succeeded first-pass. So: not a discovery-capability gap — it's that abstract verbs don't trigger active element search.
- **G6-F1** — proto_wire motion-default **inconsistency**: G1 forward nav → M3_EMPHASIZED, but G6 auto-applied **SMART_ANIMATE (silently) to all 3 checkout wires**. cart→payment→complete are non-matching layouts where SMART_ANIMATE looks broken. No stable default rule across contexts; SMART_ANIMATE should be reserved for matching-layer cases. → describe()/default-motion steering candidate.
