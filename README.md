# figma-prototype-mcp

Local MCP server that lets Claude (or any MCP client) create real Figma prototype interactions — On click → Navigate to a frame, or Scroll To a node — from natural language prompts.

Why this exists: the official Figma MCP doesn't expose a write API for prototype reactions. This project fills that gap with a Figma plugin + WebSocket bridge.

## Architecture

```
Claude  <-- stdio -->  MCP server  <-- ws -->  relay  <-- ws -->  Figma plugin
```

## Install

```bash
npm install
npm run build:plugin
```

## Run (one process)

Phase A (v0.18.0+) ships a single unified server: Express + MCP SSE + Figma plugin WebSocket on the same port.

**1. Start the server** (one terminal, leave it running):

```bash
npm start
# [server] listening on http://localhost:3000
# [server]   MCP SSE endpoint: GET /sse
# [server]   Plugin WebSocket:  ws://localhost:3000/ws
```

The server is designed to run 24/7. Wrap with PM2/systemd if you want it to auto-restart.

`PORT` can be overridden: `PORT=4000 npm start`.

**2. Figma plugin**:

- Open Figma desktop app.
- Plugins → Development → Import plugin from manifest...
- Choose `dist/figma-plugin/manifest.json`.
- Run the plugin. It auto-connects to `ws://localhost:3000/ws` (single-active session — only one plugin at a time, latest connection wins). Click **Connect** if it doesn't auto-connect on launch.

**3. MCP client** (Claude Desktop or Claude Code):

Configure your client to connect to the SSE endpoint:

```json
{
  "mcpServers": {
    "figma-prototype": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

No `command` / `args` / env vars needed — the URL is enough.

## High-level tools (recommended)

Three intent-oriented tools that wrap `create_reactions` with named motion presets. The lower-level 6 tools below remain available as the escape hatch for back/url/conditional/variable actions, directional transitions, and any case the high-level surface doesn't cover.

| Tool | Purpose |
|---|---|
| `proto_wire` | Wire source nodes to destination frames with **Navigate To**. Batch input `{ wires: [{ from, to, trigger?, motion?, resetScrollPosition? }], replaceExisting? }`. Defaults: `trigger=ON_CLICK`, `motion=M3_EMPHASIZED`. |
| `proto_overlay` | Open / swap / close overlays. Batch input `{ overlays: [{ mode: "open"\|"swap"\|"close", from, overlay?, trigger?, motion? }] }` — `overlay` is required for `open`/`swap`, forbidden for `close`. **Note:** Figma's runtime does not accept Smart Animate on overlay/swap/close navigations (the UI hides it too); when a SMART_ANIMATE-based motion preset is supplied, the compile step substitutes `DISSOLVE` while preserving `duration` and `easing` so the M3/HIG feel survives. |
| `proto_scroll` | Wire source nodes to scroll targets (**Scroll To**). Batch input `{ scrolls: [{ from, to, trigger?, motion?, resetScrollPosition? }] }`. |
| `proto_get_last_history` | Read the in-memory history of recent `proto_*` calls (FIFO ring buffer, capacity 10, server-lifetime). Input `{ count?: 1..10 }`, default 1. Returns `{ entries: HistoryEntry[] }` with entries in oldest-to-newest order. Use to support "modify the last one I made"-style requests by recovering source/target IDs and motion preset, then re-calling with `replaceExisting: true`. |

### History stack

The server keeps an in-memory record of every successful `proto_wire` / `proto_overlay` / `proto_scroll` call — `historyId` (UUID), `timestamp`, `tool` name, full parsed `input`, and `result` counts — up to 10 entries (FIFO ring buffer, cleared on server restart). `proto_get_last_history` exposes this so an LLM can resolve natural-language references like "the last thing I made" / "방금 만든 거" without the human re-stating nodeIds. Low-level tools (`create_reactions`, `set_frame_scroll`, etc.) are NOT recorded — only the three `proto_*` entry-points.

### Motion presets

`motion` accepts a preset name (string) or a full `TransitionInput` object. The 10 presets cover the common design-system tones:

| Preset | Compiled transition |
|---|---|
| `M3_EMPHASIZED` *(default)* | SMART_ANIMATE, 500ms, cubic-bezier(0.2, 0, 0, 1) |
| `M3_EMPHASIZED_DECELERATE` | SMART_ANIMATE, 400ms, cubic-bezier(0.05, 0.7, 0.1, 1) |
| `M3_EMPHASIZED_ACCELERATE` | SMART_ANIMATE, 200ms, cubic-bezier(0.3, 0, 0.8, 0.15) |
| `M3_STANDARD` | SMART_ANIMATE, 300ms, cubic-bezier(0.2, 0, 0, 1) |
| `M3_STANDARD_DECELERATE` | SMART_ANIMATE, 250ms, cubic-bezier(0, 0, 0, 1) |
| `M3_STANDARD_ACCELERATE` | SMART_ANIMATE, 200ms, cubic-bezier(0.3, 0, 1, 1) |
| `HIG_DEFAULT` | SMART_ANIMATE, named spring GENTLE |
| `HIG_SMOOTH` | SMART_ANIMATE, named spring SLOW |
| `HIG_SNAPPY` | SMART_ANIMATE, named spring QUICK |
| `HIG_BOUNCY` | SMART_ANIMATE, named spring BOUNCY |

For `proto_overlay`, the `SMART_ANIMATE` type is rewritten to `DISSOLVE` at compile time per the Figma constraint noted above.

To bypass the preset system (e.g. for `MOVE_IN`/`PUSH`/`SLIDE_*` directional transitions or fully custom timing), pass `motion` as a raw `TransitionInput` object instead of a preset name.

## Tools (low-level escape hatch)

| Tool | Purpose |
|---|---|
| `get_canvas_overview` | One-shot context primer: current page, frames, selection |
| `find_nodes` | Search nodes by name (and optional type) |
| `create_reactions` | **Write**: batch create prototype reactions. Each connection's `action` picks between Navigate To (action.type=navigate, targetFrameId), Scroll To (scroll, targetNodeId), Open Overlay (overlay, targetFrameId), Close Overlay (close, no destination), Back (back, no destination), Open URL (url, url, openInNewTab?), and Swap Overlay (swap_overlay, targetFrameId). Triggers: string shortcuts `ON_CLICK` (default) / `ON_HOVER` / `ON_PRESS` / `AFTER_TIMEOUT` (with top-level `afterTimeoutSeconds`); object form additionally supports `{type:"ON_DRAG"}`, `{type:"MOUSE_UP"\|"MOUSE_DOWN", delay?}`, `{type:"MOUSE_ENTER"\|"MOUSE_LEAVE", delay?, deprecatedVersion?}`, `{type:"ON_KEY_DOWN", device, keyCodes}`, `{type:"ON_MEDIA_HIT", mediaHitTime}`, `{type:"ON_MEDIA_END"}`, and a self-contained `{type:"AFTER_TIMEOUT", timeout}`. Transitions: string shortcuts `INSTANT` / `DISSOLVE` / `SMART_ANIMATE`, simple object form (DISSOLVE/SMART_ANIMATE/SCROLL_ANIMATE + duration + easing), and directional form (`MOVE_IN`/`MOVE_OUT`/`PUSH`/`SLIDE_IN`/`SLIDE_OUT` × `direction` LEFT/RIGHT/TOP/BOTTOM × optional `matchLayers`). NODE actions (navigate / scroll / overlay / swap_overlay) also accept optional `resetScrollPosition?: boolean` — `false` to keep the destination frame's previous scroll position, `true` to reset to top. Omit to use Figma's runtime default. Each succeeds or fails independently; scroll targets without a scrollable ancestor return a `warning`. A `conditional` action wraps an IF/ELSE: `{ type: "conditional", condition: { variable, operator: "==" \| "!=" \| "<" \| "<=" \| ">" \| ">=", value }, then: [action, ...], else?: [action, ...] }`. The `variable` is the name of a local Figma variable (BOOLEAN/FLOAT/STRING); plugin resolves to id. Nested conditionals are rejected. Branches use any of the 7 non-conditional action types. Variable mutations: `set_variable` action assigns a literal (`{ type: "set_variable", variable, value }`; value is boolean/number/string matching the variable's resolvedType; valid both at top-level and inside conditional then/else); `toggle_variable` action flips a BOOLEAN variable (`{ type: "toggle_variable", variable }`; top-level only — desugars to CONDITIONAL+2 SET_VARIABLE; nested-rejected to preserve the no-nesting rule). Both reference local Figma variables by name. `list_reactions` round-trips toggle_variable via pattern detection on the stored CONDITIONAL. COLOR variables accept hex string values (`"#RRGGBB"` or `"#RRGGBBAA"` — case insensitive); the plugin validates format and parses to Figma's RGB(A) shape internally. `list_reactions` echoes COLOR `value` back as a hex string. Conditional comparison against COLOR variables is rejected (use BOOLEAN/FLOAT/STRING for conditions). |
| `list_reactions` | Inspect existing reactions on a node |
| `clear_reactions` | Remove reactions from one or more nodes |
| `set_frame_scroll` | **Write**: configure scroll-related properties on one or more FRAME nodes. Each entry accepts optional `direction` (`NONE` / `HORIZONTAL` / `VERTICAL` / `BOTH`) and/or optional `fixedChildren` (number of top-most children to fix when scrolling — Figma's sticky-header model fixes the first N children in z-order; layer panel order matters). At least one of `direction` or `fixedChildren` must be provided per entry. Each frame succeeds or fails independently; response includes `applied` array naming which fields were set. |

## Manual E2E checklist (v1 acceptance)

After install + all three components running, verify these scenarios in Figma. Each must pass.

- [x] **1. Selection-based wiring**: Create a Figma file with 2 frames (`Login`, `Home`) and 3 buttons inside `Login`. Select the 3 buttons. Ask Claude: "현재 선택한 버튼들을 Home에 연결해줘". Expected: 3 reactions created. Verify in Figma (Prototype tab shows arrows) and in Present mode (clicks navigate to Home).
- [x] **2. Name-based wiring**: With nothing selected, create 3 frames each containing one `Continue` button. Ask: "모든 Continue 버튼을 다음 화면으로 순서대로 연결해줘". Expected: button in frame 1 → frame 2, button in frame 2 → frame 3, etc.
- [x] **3. Inspection**: Select a wired button. Ask: "이 버튼 어디로 연결돼 있어?". Expected: Claude reports the destination frame name correctly.
- [x] **4. Undo**: After scenario 1, ask: "방금 만든 연결 다 지워줘". Expected: reactions removed from all 3 buttons.
- [x] **5. Error path**: Ask: "Login 버튼을 NonexistentFrame으로 연결해줘". Expected: Claude reports a friendly error (target not found) without crashing.
- [x] **6. Scroll wiring + warning path**:
  Setup: Create a tall frame containing a section node named "Pricing", and another node "Footer" outside any scrollable frame. Set the tall frame's Overflow Behavior to "Vertical scrolling" — either via Figma Inspector → Frame → Overflow: Vertical, **or via the `set_frame_scroll` tool** (`{ frames: [{ frameId, direction: "VERTICAL" }] }`).
  (a) Ask: "이 버튼을 Pricing 섹션으로 스크롤되게 해줘". Expected: reaction created, no `warning` field in the response.
  (b) Ask: "이 버튼을 Footer로 스크롤되게 해줘". Expected: reaction created BUT the response result includes a `warning` field naming "Footer" and the missing scrollable ancestor; `warningCount` in the summary is 1.
- [x] **7. Overlay open + close pair**:
  Setup: Create two frames in the test zone — `mainFrame` and `modal`. Place a button `openBtn` inside `mainFrame`, and a button `closeBtn` inside `modal`.
  (a) Ask: "openBtn을 modal로 오버레이로 열어줘". Expected: reaction created, no warning. In Figma prototype play, click openBtn → modal appears as an overlay over mainFrame.
  (b) Ask: "closeBtn을 누르면 오버레이 닫게 해줘". Expected: reaction created. In prototype play, click closeBtn → overlay dismisses and mainFrame is visible again.
- [x] **9. Back / Open URL / Swap Overlay**:
  Setup: Two regular frames `screenA` and `screenB` with three buttons inside `screenA` (`goB`, `openExternal`, `dismissThis`). Two overlay frames `overlayP` and `overlayQ`. A button `swapBtn` inside `overlayP`. Pre-wire `goB` → screenB and `screenA → overlayP` (via overlay) using prior tools as needed.
  (a) Ask: "openExternal에서 https://figma.com 열게 해줘". Expected: reaction created with action.type=URL and the exact url echoed. In play mode, click opens figma.com in the browser.
  (b) Ask: "dismissThis는 뒤로 가기로". Expected: reaction created with action.type=BACK (no destination). In play, after navigating screenA→screenB, dismissThis returns to screenA.
  (c) Ask: "swapBtn을 overlayQ로 swap하게". Expected: reaction created with action.type=NODE and navigation=SWAP, destinationId echoed. In play, open overlayP from screenA, then click swapBtn → overlayP is replaced (not stacked) by overlayQ.
- [x] **10. URL options + inspection**:
  Setup: Reuse scenario 9's buttonExternal (`962:22117` in MCP_Test_05) — the URL action wired to https://figma.com.
  (a) Ask: "buttonExternal에서 https://anthropic.com을 새 탭에서 열게 해줘". Expected: reaction replaced. list_reactions on buttonExternal shows action.type=URL, url=https://anthropic.com, openInNewTab=true.
  (b) Ask: "이 버튼 어디로 연결돼 있어?" (buttonExternal selected). Expected: response includes the URL string and the openInNewTab flag.
- [x] **11. Plugin auto-connect**:
  Setup: plugin already connected to `test1` from earlier scenarios.
  (a) Close the Figma plugin UI, then reopen it (Plugins → Development → figma-prototype). Expected: input is pre-filled with `test1` and the status flips to "Connected on channel: test1" automatically — no user input.
  (b) Click **Disconnect**. Input becomes editable. Type a different channel (e.g. `test2`) and click **Connect**. Reload the plugin once more. Expected: input auto-fills with `test2`.
  (c) (Optional cleanup) restore channel back to `test1` before continuing other scenarios.
- [x] **12. Plugin auto-reconnect**:
  Setup: plugin connected to `test1`. Relay terminal accessible.
  (a) Stop the relay (Ctrl-C in the relay terminal). Plugin UI status flips to "Reconnecting to test1 in 1s…" then "Reconnecting to test1…" then "Reconnecting to test1 in 2s…" with the next attempt, doubling each time up to 30s. Input stays disabled and the Disconnect button stays visible during retries.
  (b) Restart the relay (`npm run relay`). On the next retry attempt the WS reconnects and the status flips back to "Connected on channel: test1" automatically.
  (c) Drop the relay again, then click **Disconnect** during the reconnect loop. The retry stops immediately, status flips to "Disconnected", input becomes editable, Connect button reappears.
- [x] **13. AFTER_TIMEOUT trigger (auto-advance)**:
  Setup: two frames `splash` and `home`. The splash frame is the trigger source — no buttons needed inside it.
  (a) Ask: "splash가 2초 뒤에 자동으로 home으로 가게 해줘". Expected: reaction created on splash with trigger.type=AFTER_TIMEOUT, timeout=2, action navigate→home. In Figma prototype play, opening splash auto-transitions to home after 2 seconds.
  (b) Ask: "splash 어디로 연결돼 있어?" (splash selected). Expected: list_reactions response trigger object includes both `type: "AFTER_TIMEOUT"` and `timeout: 2`.
- [x] **14. Transition customization (Phase 1 — duration + cubic/back easings)**:
  Setup: two frames A, B with a navigate button on A pointing to B (any prior fixture works).
  (a) Ask: "A→B 빠르게 0.1초 LINEAR로 연결". Expected: transition emits `{ type: "DISSOLVE", duration: 0.1, easing: { type: "LINEAR" } }`.
  (b) Ask: "0.8초 SMART_ANIMATE EASE_IN_AND_OUT". Expected: `{ type: "SMART_ANIMATE", duration: 0.8, easing: { type: "EASE_IN_AND_OUT" } }`.
  (c) Ask: "기대감 후 등장 EASE_OUT_BACK 0.5초 DISSOLVE". Expected: `{ type: "DISSOLVE", duration: 0.5, easing: { type: "EASE_OUT_BACK" } }`.
  (d) `list_reactions` on the source button echoes `transition.type`, `transition.duration`, AND `transition.easing.type` for each of (a)/(b)/(c).
- [x] **15. Spring preset easings**:
  Setup: any existing source button + target frame fixture.
  (a) Ask: "BOUNCY로 0.4초 SMART_ANIMATE". Expected: `easing.type = "BOUNCY"` echoed by list_reactions.
  (b) Ask: "QUICK 0.3초 DISSOLVE". Expected: `easing.type = "QUICK"`.
- [x] **16. Custom cubic-bezier and custom spring easings**:
  Setup: any existing source button + target frame fixture.
  (a) Ask: "Material 3 emphasized 곡선 SMART_ANIMATE 0.5초" → `transition.easing = { type: "CUSTOM_CUBIC_BEZIER", x1: 0.2, y1: 0, x2: 0, y2: 1 }`. Expected: list_reactions echoes `easing.type = "CUSTOM_CUBIC_BEZIER"` plus `easing.easingFunctionCubicBezier` with those values.
  (b) Ask: "엄청 튀는 스프링 (mass 1, stiffness 600, damping 10) SMART_ANIMATE 0.6초". Expected: `easing.type = "CUSTOM_SPRING"` plus `easing.easingFunctionSpring` with mass/stiffness/damping. (`initialVelocity` is documented in Figma typings but rejected by the runtime — omitted.)
- [x] **17. Directional transitions (Phase 3 — MOVE / PUSH / SLIDE × LEFT / RIGHT / TOP / BOTTOM)**:
  Setup: any source button + target frame fixture. Use `replaceExisting: true` (or clear between cases) so each sub-case is the sole reaction on the button.
  (a) Ask: "RIGHT에서 MOVE_IN matchLayers true 0.4초". Expected: list_reactions echoes `type=MOVE_IN`, `direction=RIGHT`, `matchLayers=true`, `duration=0.4`.
  (b) Ask: "LEFT에서 PUSH 0.3초". Expected: `type=PUSH`, `direction=LEFT`, `matchLayers=false` (default).
  (c) Ask: "BOTTOM에서 SLIDE_IN BOUNCY". Expected: `type=SLIDE_IN`, `direction=BOTTOM`, `easing.type=BOUNCY`.
  (d) Ask: "TOP으로 MOVE_OUT 0.5초". Expected: `type=MOVE_OUT`, `direction=TOP`, `duration=0.5`.
  (e) Ask: "RIGHT로 SLIDE_OUT". Expected: `type=SLIDE_OUT`, `direction=RIGHT`.
- [x] **18. New trigger types (practical subset — ON_DRAG / MOUSE_UP / MOUSE_ENTER)**:
  Setup: source button on screenA, target frame screenB, overlay frame reusable from earlier scenarios.
  (a) Ask: "이 frame을 드래그하면 screenB로 가게 (SMART_ANIMATE)". Expected: `trigger.type=ON_DRAG` echoed. **Note: ON_DRAG requires a FRAME as source (not RECTANGLE) and a non-INSTANT transition such as SMART_ANIMATE — Figma rejects the reaction otherwise.** **Prototype Play verified** with a 3-screen carousel: screen01/02/03 each containing a same-named child frame `slider`; chained `slider → next-screen` ON_DRAG SMART_ANIMATE on all three so the matched `slider` layer interpolates position during drag (drag direction inferred from screen layout — horizontal here).
  (b) Ask: "MOUSE_UP 0.2초 뒤에 screenB로". Expected: `trigger.type=MOUSE_UP`, `delay=0.2`.
  (c) Ask: "MOUSE_ENTER 시 overlay 열게". Expected: `trigger.type=MOUSE_ENTER`, `delay=0`.

  **Note:** `ON_KEY_DOWN` / `ON_MEDIA_HIT` / `ON_MEDIA_END` are schema-supported (Zod + builder + tests) but live-verify is deferred — controller/key behavior is desktop-app-specific, and media triggers need a video-node fixture. `deprecatedVersion` field for MOUSE_ENTER/LEAVE is documented in Figma typings but rejected by the runtime — omitted (same pattern as `initialVelocity` in v1.12).
- [x] **19. Configure frame scroll behavior (`set_frame_scroll`)**:
  Setup: a new test section with three frames: `vTall` (tall — child content exceeds frame height), `hWide` (wide — child content exceeds frame width), `noScroll` (small).
  (a) Ask: "vTall frame 세로로 스크롤되게 해줘". Expected: `successCount=1`. Figma → Prototype panel shows Overflow Behavior = "Vertical scrolling". Play mode: vertical drag scrolls content.
  (b) Ask: "vTall 스크롤 꺼줘". Expected: Overflow Behavior = "No scrolling". Play: overflowing content is clipped, no scroll.
  (c) Ask: "hWide 가로로 스크롤". Expected: Overflow Behavior = "Horizontal scrolling". Play: horizontal scroll works.
  (d) Error case: pass a non-existent frameId. Expected: `status=error`, `errorCount=1`, error message contains "Frame not found".

- [x] **20. Sticky header (`set_frame_scroll` with `fixedChildren`)**:
  Setup: reuse `vTall` (995:3) from scenario 19 — its first child (`v-block-1`) acts as the header. **Figma's sticky model fixes the top-N children by z-order — the user is responsible for arranging the would-be-sticky child first in the layer panel.**
  (a) Ask: "vTall 세로 스크롤로 켜고 맨 위 블록 고정해줘". Expected: tool call `set_frame_scroll({ frames: [{ frameId: "995:3", direction: "VERTICAL", fixedChildren: 1 }] })`, response `applied: ["direction","fixedChildren"]`. Figma Prototype Play: vertical scroll, v-block-1 stays at top.
  (b) Ask: "vTall 고정만 해제 (direction은 유지)". Expected: `{ frameId: "995:3", fixedChildren: 0 }` (direction omitted), `applied: ["fixedChildren"]`. Figma read-back: `overflowDirection` still "VERTICAL", `numberOfFixedChildren` now 0.
  (c) Error case (Zod): `fixedChildren: -1`. Expected: `Invalid input` from tool.
  (d) Edge case (runtime): `fixedChildren: 999` (exceeds children count). **Figma runtime rejects** with `"in set_numberOfFixedChildren: numberOfFixedChildren must be <= the number of children in the node"`. Caught via try/catch → per-frame `status: "error"`. (Bonus observation while live-verifying: a call with BOTH `direction` and an OOR `fixedChildren` partially mutates — `direction` is applied first, then the throw. The response's `applied` array surfaces this — e.g. `{ status: "error", applied: ["direction"], error: ... }` — so callers can detect partial state without re-reading Figma.)
  (e) Refine: empty entry `{ frameId }` (no direction, no fixedChildren). Expected: tool rejects with "Each entry must include at least one of `direction` or `fixedChildren`".

- [x] **21. Reset scroll position on NODE actions (`resetScrollPosition`)**:
  Setup: a sibling frame `home` (1013:3) with a button `goVTall` (1013:5) navigating to vTall, and inside vTall a button `goHome` (1013:7) navigating to `home`. (Fixture generated via Figma MCP inside MCP_Test_09.)
  (a) Ask: "goHome이 home으로 가되 vTall 스크롤 위치 기억해줘". Expected: connection emits `action: { type: "navigate", targetFrameId: <home>, resetScrollPosition: false }`. Figma read-back confirms `resetScrollPosition: false` persisted on the reaction.
  (b) Ask: "이번엔 vTall 스크롤 매번 top으로 초기화". Expected: `resetScrollPosition: true`. Figma read-back confirms persistence. Play: re-entering vTall scrolls back to top.
  (c) `list_reactions` on the source button. Expected: response includes `action.resetScrollPosition` echoed (false in (a), true in (b)). v1.15 added the field to handleListReactions's action enumeration — the v1.13 "raw passthrough" claim only ever applied to `trigger`, not action.
  (d) Overlay variant: deferred to follow-up (no dedicated fixture this round; behavior is the same code path as (a)/(b) since all 4 NODE actions share the field).
  (e) Defense check (`@deprecated preserveScrollPosition`): input crafted with `preserveScrollPosition: true` alongside a valid navigate action. Result: our schema silently drops the deprecated key during Zod parse (no `.strict()` on action shapes), builder doesn't emit it, Figma read-back confirms neither key is persisted. Deprecated path closed without explicit rejection.

- [x] **22. Conditional action (`type: "conditional"`)**:
  Setup: a BOOLEAN local variable `loggedIn` (default `false`), two frames `home` and `login`, and a button `checkLogin`. Fixture autogenerated by the Figma MCP if missing.
  (a) Ask: "checkLogin 누르면 loggedIn 값에 따라 home 또는 login으로 가게". Expected: connection emits `action: { type: "conditional", condition: { variable: "loggedIn", operator: "==", value: true }, then: [navigate→home], else: [navigate→login] }`. Figma read-back confirms `conditionalBlocks` length 2 with the expected condition + actions.
  (b) Manual Play-mode: in Figma's Variables panel, toggle `loggedIn` to `true` → enter Play → click `checkLogin` → navigates to `home`. Toggle back to `false`, re-enter Play, click → navigates to `login`. Visual confirm.
  (c) Error — variable not found: send `condition.variable: "doesNotExist"`. Expected: per-frame `status: "error"`, message contains `"Variable not found: doesNotExist"`.
  (d) Error — type mismatch: send BOOLEAN variable `loggedIn` with `value: "yes"` (string). Expected: per-frame `status: "error"`, message names both types (e.g. `"BOOLEAN ... cannot compare against string"`).
  (e) `else` omitted + condition false: wire `then: [navigate→home]` only with `loggedIn: false`. Expected: wire success. Play mode: click does nothing visible.
  (f) Defense — nested conditional: send `then: [{ type: "conditional", ... }]`. Expected: Zod rejects with `Invalid input` at the tool layer (no plugin call).
  (g) `list_reactions` echo: after (a), call `list_reactions` on `checkLogin`. Expected response includes `action.type: "CONDITIONAL"`, `action.condition: { variable: "loggedIn", operator: "==", value: true }`, `action.then`/`action.else` arrays each with one navigate-shaped echo.

- [x] **23. Variable mutations (`set_variable` + `toggle_variable`)**:
  Setup: BOOLEAN local variable `loggedIn`, FLOAT local variable `count` (default 0), button `incrementBtn` (or reuse `checkLogin`). Fixture autogenerated if missing.
  (a) Top-level set_variable (FLOAT): wire `incrementBtn → set_variable count = 10`. Expected: wire success. Figma raw read shows `SET_VARIABLE` action with `variableId` and `variableValue: { FLOAT, 10 }`.
  (b) Top-level toggle_variable: wire `incrementBtn → toggle_variable loggedIn`. Expected: wire success. Figma raw read shows `CONDITIONAL` with 2 blocks (if==true → set false, else → set true). `list_reactions` echo returns `{ type: "toggle_variable", variable: "loggedIn" }` via pattern matching.
  (c) Conditional + set_variable inside then with multiple inner actions: wire `incrementBtn → if loggedIn==false then [set count=10, navigate home]`. Expected: wire success. Figma raw shows conditionalBlocks[0].actions length 2 with one SET_VARIABLE + one NODE.NAVIGATE.
  (d) Error — variable not found: `set_variable doesNotExist = true`. Expected: per-frame `status: "error"`, message contains `"Variable not found: doesNotExist"`.
  (e) Error — type mismatch on set_variable: BOOLEAN `loggedIn` with `value: 42`. Expected: error message names both types (`"loggedIn" is BOOLEAN; cannot assign number literal`).
  (f) Error — toggle non-BOOLEAN: `toggle_variable count` (FLOAT). Expected: error `"Cannot toggle non-BOOLEAN variable \"count\" (type: FLOAT); toggle_variable requires BOOLEAN"`.
  (g) Defense — toggle inside conditional: send `then: [{ type: "toggle_variable", ... }]`. Expected: Zod rejects with `Invalid input` (NonConditionalActionInput excludes toggle_variable).
  (h) list_reactions echo correctness: after (a) → `{ type: "set_variable", variable: "count", value: 10 }`. After (b) → `{ type: "toggle_variable", variable: "loggedIn" }`. After (c) → conditional shape with nested set_variable + navigate.
  (i) Manual Play-mode: enter Present after (b), click incrementBtn, observe `loggedIn` toggle in Figma Variables panel between true/false. After (a)+(c), click and observe `count` change to 10.

- [x] **24. COLOR variables via hex (`set_variable` extension)**:
  Setup: a COLOR local variable `bgColor` (default any), button `button` (1022:227 from v1.17 fixture, or any other clickable FRAME). Optional: bind a frame's fill to `bgColor` for manual Play-mode visual check (case j).
  (a) RGB hex: `set_variable bgColor = "#FF4040"`. Expected: wire success. Figma raw read: `variableValue.type === "COLOR"`, `variableValue.value = { r: 1, g: ≈0.251, b: ≈0.251, a: 1 }` (a always present per runtime requirement).
  (b) RGBA hex: `set_variable bgColor = "#FF4040CC"`. Figma raw: same r/g/b plus `a ≈ 0.8`.
  (c) Echo round-trip (RGB): after (a), `list_reactions` returns `value: "#FF4040"` (a=1 hidden in hex echo).
  (d) Echo round-trip (RGBA): after (b), `list_reactions` returns `value: "#FF4040CC"`.
  (e) Error — COLOR vs boolean: `set_variable bgColor = true`. Expected: per-frame `status: "error"`, message contains `"COLOR; cannot assign boolean literal"`.
  (f) Error — COLOR vs non-hex string: `set_variable bgColor = "red"`. Expected: `"COLOR; value must be a hex string like #RRGGBB or #RRGGBBAA (got \"red\")"`.
  (g) Error — malformed hex: `set_variable bgColor = "#XYZ"`. Expected: same hex error.
  (h) STRING variable with hex-shaped string: `set_variable <some-STRING-var> = "#FF4040"`. Expected: stored as STRING (not COLOR — type follows variable, not value). Echo returns `"#FF4040"` as plain string.
  (i) Error — Conditional condition references COLOR variable: `condition: { variable: "bgColor", operator: "==", value: "#FF4040" }`. Expected: `"COLOR; conditional comparison against COLOR variables is not supported in v1.18"`.
  (j) Manual Play-mode: bind a frame's fill to `bgColor` in the Figma UI, enter Present, click the button → frame color changes to the value set in (a) or (b). Visual confirm.

- [x] **25. Phase A SSE+WS regression smoke test (v0.18.0)**:
  Setup: server running via `npm start`, Figma plugin reloaded and showing "Connected" status, Claude config switched to SSE URL.
  (a) Re-run scenario 1 (selection-based wiring). Expected: identical behavior to v0.17.0 — wire success, 3 reactions on the 3 buttons.
  (b) Re-run scenario 7 (overlay open + close). Expected: openBtn / closeBtn wires intact, overlay opens and closes in Present mode.
  (c) Re-run scenario 19 (set_frame_scroll). Expected: overflowDirection set per direction value; Figma read-back persists.
  (d) Re-run scenario 23 (set_variable + toggle_variable). Expected: toggle on showMenu desugars+round-trips; set_variable on count works.
  (e) Re-run scenario 24 (COLOR via hex). Expected: bgColor accepts `#FF4040`; echo returns the hex.
  (f) **New behavior — 3s timeout guard**: disconnect plugin (close Figma or click Disconnect). Within 3s ask Claude any tool call. Expected: tool returns `status: "error"` with message containing `"피그마 플러그인 연결을 확인해주세요"`. Reconnect plugin within 3s of a fresh call → call succeeds (validates the wait-for-connection path).
  (g) [Live] MCP-over-SSE probe caught a real bug: `express.json()` middleware drained the body before `SSEServerTransport.handlePostMessage` could re-read it. Fixed by passing `req.body` as the third arg. Reinforces probe discipline — Task 1 only verified GET /sse + WS upgrade, not the POST /messages roundtrip.

- [x] **26. `proto_wire` (M3_EMPHASIZED default)**:
  Setup: A page containing two top-level frames (`screen01` with a child button + `screen02`).

  ```
  proto_wire({ wires: [{ from: "<button>", to: "<screen02>" }], replaceExisting: true })
  ```

  Inspect Figma's Prototype panel on the button. Expected: **On Click** → **Navigate To** screen02 → **Smart Animate** → **Custom Curve** (cubic-bezier (0.2, 0, 0, 1)) → **500ms**. (Live-verified 2026-05-22.)

- [x] **27. `proto_overlay` open + HIG_SNAPPY (SMART_ANIMATE → DISSOLVE rewrite)**:
  Setup: A page containing `screen01` (with a button) + an overlay frame `popup01`.

  ```
  proto_overlay({ overlays: [{ mode: "open", from: "<button>", overlay: "<popup01>", motion: "HIG_SNAPPY" }], replaceExisting: true })
  ```

  Inspect Prototype panel. Expected: **On Click** → **Open Overlay** popup01 → **Dissolve** (NOT Smart Animate — Figma constraint, see v1.20 design notes) → named spring **Quick**. (Live-verified 2026-05-22 via v1.20 bypass-probe — caught the SMART_ANIMATE incompatibility.)

- [x] **28. `proto_scroll` raw `TransitionInput`**:
  Setup: A page containing `screen01` (with a button) and a long frame `screen03` containing a child node `scroll01`. Set screen03's `overflowDirection` to `VERTICAL` first (manually or via `set_frame_scroll`).

  ```
  proto_scroll({
    scrolls: [{
      from: "<button>", to: "<scroll01>",
      motion: { type: "SCROLL_ANIMATE", duration: 0.8, easing: "EASE_IN_AND_OUT" }
    }],
    replaceExisting: true,
  })
  ```

  Expected: **On Click** → **Scroll To** scroll01 → **Animate** → **Ease In and Out** → **800ms**. (Live-verified 2026-05-22.)

- [x] **29. `proto_get_last_history` (3-shot: shape, order, FIFO)**:
  After scenarios 26-28 ran in order, call:

  ```
  proto_get_last_history({ count: 3 })
  ```

  Expected: an `entries` array of length 3 in oldest-to-newest order — `entries[0].tool === "proto_wire"` (from 26), `entries[1].tool === "proto_overlay"` (from 27), `entries[2].tool === "proto_scroll"` (from 28, most recent). Each entry carries a valid UUID `historyId`, numeric `timestamp`, full parsed `input`, and `result` counts.

  Then run 11 sequential `proto_wire` calls (same from/to is fine with `replaceExisting: true`) and call `proto_get_last_history({ count: 10 })`. Expected: 10 entries, timestamps strictly ascending, all `tool === "proto_wire"`. Confirms FIFO eviction at capacity. (Live-verified 2026-05-22 via v1.21 bypass-probe.)

## Known limitations (v1)

- Reaction actions: **Navigate To**, **Scroll To**, **Open Overlay**, **Close Overlay**, **Back**, **Open URL**, **Swap Overlay**, **Conditional** (single comparison, IF/ELSE). No SET_VARIABLE, set-variant (component swap), AND/OR/NOT, nested conditionals, media-runtime.
- Default transition is **Instant**. Smart Animate is available as an option but requires matching layer designs.
- **Figma desktop/web app must be open and the plugin running** — no headless execution.
- Single-page scope (cross-page navigation untested).
- Relay, MCP server, and plugin all on **localhost** (no remote).

## License

MIT. Includes code derived from [grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) (MIT) — see `LICENSE`.
