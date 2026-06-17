# figma-prototype-mcp

Local MCP server that lets Claude (or any MCP client) create real Figma prototype interactions — On click → Navigate to a frame, or Scroll To a node — from natural language prompts.

Why this exists: the official Figma MCP doesn't expose a write API for prototype reactions. This project fills that gap with a Figma plugin + WebSocket bridge. It's designed to run **alongside the official Figma MCP** — that one *creates* screens, this one *wires* them into a working prototype.

> 🎨 Designers: see the plain-language **[prototype-wiring cheat-sheet](docs/prototype-wiring-for-designers.md)** ("say this → get that").

## Quick start

You connect three local pieces: a **server**, the **Figma plugin**, and your **AI client**. ~3 minutes.

**Prerequisites:** [Node 18+](https://nodejs.org) · the Figma **desktop app** · an MCP client ([Claude Desktop](https://claude.ai/download) or Claude Code).

**1. Start the server** (terminal — leave it running):
```bash
npx figma-prototype-mcp
# → [server] listening on http://localhost:3000
```

**2. Install & run the plugin:**
- Install from Figma Community: **[Prototype MCP — wire prototypes with LLM](https://www.figma.com/community/plugin/1647184714488719280/prototype-mcp-wire-prototypes-with-llm)**
- Open a Figma **design file** → run the plugin (Plugins → Prototype MCP) → it should show **Connected** (needs step 1 running).

**3. Point your AI client at the server** — add this to your MCP client config, then restart it:
```json
{ "mcpServers": { "figma-prototype": { "url": "http://localhost:3000/sse" } } }
```

**Claude Desktop (one-click install):** download `figma-prototype-mcp.mcpb` from the [latest GitHub release](https://github.com/smooeach/figma-prototype-mcp/releases/latest) and double-click it — Claude Desktop installs and auto-runs the server (no terminal, no JSON config). You still install the Figma plugin from Community and run it. (The manual `--stdio` command config below also works if you prefer.)

> **Org-managed Claude Desktop?** If double-click / "Install Extension" does nothing (managed accounts often allow only registry-sourced extensions), use **Settings → Extensions → Extension Developer → Load unpacked** and point it at the **unzipped** `.mcpb` folder (a `.mcpb` is a zip containing `manifest.json` + `server/`). Or clone this repo, run `npm run build:dxt`, and load-unpacked the `dxt/` folder. This sideloads the extension without the registry.

**Claude Desktop** has no native SSE support, so point it at the server over stdio — it launches the server for you (no separate `npx figma-prototype-mcp` needed):
```json
{ "mcpServers": { "figma-prototype": { "command": "npx", "args": ["-y", "figma-prototype-mcp", "--stdio"] } } }
```
In `--stdio` mode the client starts the server and talks to it over stdio; the server still hosts the Figma plugin WebSocket on `ws://localhost:3000/ws`. Don't also run a separate SSE server (`npx figma-prototype-mcp`) on the same port — pick one. (Claude Code can use either the SSE `url` above or this stdio command.)

**4. Wire it by talking.** In a file with ≥2 frames, ask Claude:
> "Home의 버튼을 누르면 Detail 화면으로 가게 해줘"
> *(or "when the button on Home is clicked, navigate to Detail")*

The interaction appears in Figma's **Prototype** tab. That's the loop — describe it, it's wired. (Stuck? see [Troubleshooting](#troubleshooting).)

## Architecture

```
MCP client (Claude)  <-- SSE/HTTP -->  unified server (Express)  <-- ws -->  Figma plugin
```

Since v0.18.0 the MCP server, the WebSocket relay, and the HTTP layer are a **single Express process** on one port (default 3000) — `/sse` for the MCP client, `/ws` for the plugin. The earlier stdio-MCP + standalone-relay split was removed.

## Install

```bash
npm install
npm run build
```

**Or from npm (no clone):**

```bash
npx figma-prototype-mcp        # starts the server on :3000
```

The server prints the path to the bundled Figma plugin manifest on startup (under `node_modules/figma-prototype-mcp/dist/figma-plugin/manifest.json`) — import it in Figma via **Plugins → Development → Import plugin from manifest…**.

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

`PORT` can be overridden: `PORT=4000 npm start`. **Note:** the Figma plugin connects to `ws://localhost:3000` (hard-coded in its manifest's `networkAccess.allowedDomains`), so if you change the port you must also update `src/figma-plugin/manifest.json` and rebuild (`npm run build`) for the plugin to reach the server.

Requires **Node ≥ 18**.

**2. Figma plugin**:

- **Easiest — install from Figma Community:** [Prototype MCP — wire prototypes with LLM](https://www.figma.com/community/plugin/1647184714488719280/prototype-mcp-wire-prototypes-with-llm) → **Open in…** / **Run**.
- **Or load locally (for development):** Figma desktop → Plugins → Development → Import plugin from manifest… → choose `dist/figma-plugin/manifest.json` (after `npm run build`).
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

Connecting a new MCP client automatically replaces any previous one (single-active, newest-wins — symmetric with the plugin side). A stale/backgrounded client never blocks a fresh connection; no need to kill it first.

> **Keep a single MCP client per server.** Newest-wins is built for *replacing* a dead/stale connection (e.g. a client reconnecting), not for running two clients at once. If a second live client connects, the first is evicted: its next call fast-fails with HTTP 400 "unknown session" and it should reconnect. A well-behaved client surfaces this immediately, but a stdio↔SSE bridge such as **supergateway** may not propagate the eviction to its stdio side, so the client appears to hang until its own timeout (then may silently fall back to another tool). The server logs `a second MCP client connected — evicted the prior SSE connection` when this happens. Practical rule: when driving live validation through Claude Desktop, don't point an ad-hoc SSE probe at the same server mid-session.

## Your first wire

A 60-second end-to-end check once the server is running, the plugin is connected ("Connected" in the plugin UI), and your MCP client points at `http://localhost:3000/sse`:

1. **Open a Figma file with at least two frames** on the current page — say `Home` and `Detail` — and a button (or any node) inside `Home`.
2. **Ask your MCP client** (Claude) in plain language:
   > "Home의 버튼을 누르면 Detail 화면으로 가게 해줘"
   > *(or "When the button on Home is clicked, navigate to the Detail screen")*
3. Claude calls `get_canvas_overview` / `find_nodes` to resolve the nodes, then `proto_wire` to create the reaction. You'll get back a success count.
4. **Verify in Figma**: select the button → **Prototype** tab shows **On click → Navigate to → Detail**. Hit **▶ Present** to try it.

That's the loop: *describe the interaction → it's wired in Figma.* From here, "뒤로가기 달아줘", "이 토글 켜진 상태로 바꿔", "로그인하면 home, 아니면 login으로" all map to the tools below. To see what's already wired on a page, ask for the prototype flow (`get_prototype_flow`).

## High-level tools (recommended)

Ten intent-oriented `proto_*` tools (9 writers + 1 history reader) that wrap `create_reactions` with named motion presets — covering navigate / change-to (component variant) / scroll / overlay / back / url / set & toggle variable / conditional (incl. one-level AND/OR compound). The lower-level tools below remain the escape hatch for multi-action conditional branches, directional transitions (`MOVE_IN` / `PUSH` / `SLIDE_*`), advanced triggers (`ON_DRAG`, `MOUSE_*`, `ON_KEY_DOWN`, media), reading the existing interaction graph, and any case the high-level surface doesn't cover.

| Tool | Purpose |
|---|---|
| `proto_wire` | Wire source nodes to destination frames with **Navigate To**. Batch input `{ wires: [{ from, to, trigger?, motion?, resetScrollPosition? }], replaceExisting? }`. Defaults: `trigger=ON_CLICK`, `motion=M3_EMPHASIZED`. |
| `proto_change_to` | Switch a component **instance** to a sibling **variant** (Figma's **Change To**) — a one-shot switch to a specific state (tabs, segmented controls, selected/highlight). Batch input `{ changes: [{ from, to, trigger?, motion? }], replaceExisting? }`; `from`=instance node id, `to`=target variant component id (NOT the current variant). For a repeating on/off flip use `proto_toggle_variable` on a BOOLEAN. |
| `proto_overlay` | Open / swap / close overlays. Batch input `{ overlays: [{ mode: "open"\|"swap"\|"close", from, overlay?, trigger?, motion? }] }` — `overlay` is required for `open`/`swap`, forbidden for `close`. **Note:** Figma's runtime does not accept Smart Animate on overlay/swap/close navigations (the UI hides it too); when a SMART_ANIMATE-based motion preset is supplied, the compile step substitutes `DISSOLVE` while preserving `duration` and `easing` so the M3/HIG feel survives. |
| `proto_scroll` | Wire source nodes to scroll targets (**Scroll To**). Batch input `{ scrolls: [{ from, to, trigger?, motion?, resetScrollPosition? }] }`. |
| `proto_back` | Wire source nodes to the **Back** navigation action (pops the prototype history stack). Batch input `{ backs: [{ from, trigger?, motion? }], replaceExisting? }`. Defaults: `trigger=ON_CLICK`, `motion=M3_EMPHASIZED`. |
| `proto_url` | Wire source nodes to the **Open URL** action. Batch input `{ urls: [{ from, url, openInNewTab?, trigger? }], replaceExisting? }`. No `motion` field — URL is a terminal event; the reaction's transition defaults to INSTANT. |
| `proto_set_variable` | Wire source nodes to the **Set Variable** action — clicking the source assigns a literal value to a local Figma variable (resolved by name). Batch input `{ sets: [{ from, variable, value, trigger? }], replaceExisting? }`. `value`: boolean / number / string; for COLOR variables, pass a hex string (`"#RRGGBB"` or `"#RRGGBBAA"`). No `motion` field — variable changes are instant. |
| `proto_toggle_variable` | Wire source nodes to the **Toggle Variable** action — clicking the source flips a local BOOLEAN variable. Batch input `{ toggles: [{ from, variable, trigger? }], replaceExisting? }`. Variable must be BOOLEAN; non-boolean throws at runtime. No `motion` field. |
| `proto_conditional` | Wire a **conditional reaction** (if/then/else) on a source node based on a variable comparison. Batch input `{ conditions: [{ from, if, then, else?, trigger?, motion? }], replaceExisting? }`. `if` is a single comparison `{ variable, operator?, value }` OR a one-level compound `{ all: [...] }` (AND) / `{ any: [...] }` (OR) over ≥2 comparisons. `if.operator` defaults to `"=="`. `then`/`else` each take ONE branch sugar entry (single-action). Branch keys: `navigate` / `scroll` / `overlay` / `swap` / `close` / `back` / `url` / `set`. For multi-action branches, use low-level `create_reactions`. Overlay/swap branches: SMART_ANIMATE auto-rewrites to DISSOLVE. |
| `proto_get_last_history` | Read the in-memory history of recent `proto_*` calls (FIFO ring buffer, capacity 10, server-lifetime). Input `{ count?: 1..10 }`, default 1. Returns `{ entries: HistoryEntry[] }` with entries in oldest-to-newest order. Use to support "modify the last one I made"-style requests by recovering source/target IDs and motion preset, then re-calling with `replaceExisting: true`. |

### History stack

The server keeps an in-memory record of every successful **mutating** `proto_*` call (`proto_wire` / `proto_change_to` / `proto_overlay` / `proto_scroll` / `proto_back` / `proto_url` / `proto_set_variable` / `proto_toggle_variable` / `proto_conditional`) — `historyId` (UUID), `timestamp`, `tool` name, full parsed `input`, and `result` counts — up to 10 entries (FIFO ring buffer, cleared on server restart). `proto_get_last_history` exposes this so an LLM can resolve natural-language references like "the last thing I made" / "방금 만든 거" without the human re-stating nodeIds. Low-level tools (`create_reactions`, `set_frame_scroll`, etc.) are NOT recorded — only the 9 mutating `proto_*` entry-points (`proto_get_last_history` itself is read-only and not recorded).

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
| `list_variables` | List Figma variables usable by name in set/toggle/conditional tools (local + library/remote; `resolvedType` filter optional) |
| `create_reactions` | **Write**: batch create prototype reactions. Each connection's `action` picks between Navigate To (action.type=navigate, targetFrameId), Scroll To (scroll, targetNodeId), Open Overlay (overlay, targetFrameId), Close Overlay (close, no destination), Back (back, no destination), Open URL (url, url, openInNewTab?), Swap Overlay (swap_overlay, targetFrameId), and Change To (change_to, targetVariantId — switch a component instance to a sibling variant). Triggers: string shortcuts `ON_CLICK` (default) / `ON_HOVER` / `ON_PRESS` / `AFTER_TIMEOUT` (with top-level `afterTimeoutSeconds`); object form additionally supports `{type:"ON_DRAG"}`, `{type:"MOUSE_UP"\|"MOUSE_DOWN", delay?}`, `{type:"MOUSE_ENTER"\|"MOUSE_LEAVE", delay?, deprecatedVersion?}`, `{type:"ON_KEY_DOWN", device, keyCodes}`, `{type:"ON_MEDIA_HIT", mediaHitTime}`, `{type:"ON_MEDIA_END"}`, and a self-contained `{type:"AFTER_TIMEOUT", timeout}`. Transitions: string shortcuts `INSTANT` / `DISSOLVE` / `SMART_ANIMATE`, simple object form (DISSOLVE/SMART_ANIMATE/SCROLL_ANIMATE + duration + easing), and directional form (`MOVE_IN`/`MOVE_OUT`/`PUSH`/`SLIDE_IN`/`SLIDE_OUT` × `direction` LEFT/RIGHT/TOP/BOTTOM × optional `matchLayers`). NODE actions (navigate / scroll / overlay / swap_overlay) also accept optional `resetScrollPosition?: boolean` — `false` to keep the destination frame's previous scroll position, `true` to reset to top. Omit to use Figma's runtime default. Each succeeds or fails independently; scroll targets without a scrollable ancestor return a `warning`. A `conditional` action wraps an IF/ELSE: `{ type: "conditional", condition, then: [action, ...], else?: [action, ...] }` where `condition` is a single comparison `{ variable, operator: "==" \| "!=" \| "<" \| "<=" \| ">" \| ">=", value }` or a one-level compound `{ all: [comparison, ...] }` (AND) / `{ any: [comparison, ...] }` (OR) over ≥2 comparisons. The `variable` is the name of a local Figma variable (BOOLEAN/FLOAT/STRING); plugin resolves to id. Nested conditionals are rejected. Branches use any of the 7 non-conditional action types. Variable mutations: `set_variable` action assigns a literal (`{ type: "set_variable", variable, value }`; value is boolean/number/string matching the variable's resolvedType; valid both at top-level and inside conditional then/else); `toggle_variable` action flips a BOOLEAN variable (`{ type: "toggle_variable", variable }`; top-level only — desugars to CONDITIONAL+2 SET_VARIABLE; nested-rejected to preserve the no-nesting rule). Both reference local Figma variables by name. `list_reactions` round-trips toggle_variable via pattern detection on the stored CONDITIONAL. COLOR variables accept hex string values (`"#RRGGBB"` or `"#RRGGBBAA"` — case insensitive); the plugin validates format and parses to Figma's RGB(A) shape internally. `list_reactions` echoes COLOR `value` back as a hex string. Conditional comparison against COLOR variables is rejected (use BOOLEAN/FLOAT/STRING for conditions). |
| `list_reactions` | Inspect existing reactions on a node |
| `get_prototype_flow` | **Read** the whole prototype interaction graph of a page in one call: frames (with `isStartFrame`) + every wired interaction (`frameId`, `sourceNodeId`, `trigger`, decoded `action` — same shape as `list_reactions`). Page-scoped (optional `pageId`); `limit` caps results. Use to see what is already wired before adding more. |
| `validate_prototype` | **Read/lint** a page's whole prototype flow in one call and report problems. Four rules: `broken-reference` (error — a navigate/overlay points to a frame not on this page, incl. a missing/null destination), `unreachable` (error — a frame no start frame can reach; skipped when no start frame is set), `dead-end` (warning — a frame with no outgoing navigation; may be a final screen), `start-frame` (warning — zero or multiple start frames). Returns `{ ok (errors===0), page, issues:[{severity, rule, frameId, frameName, sourceNodeId?, sourceNodeName?, message}], summary:{errors,warnings,frames,interactions}, truncated }`. Page-scoped (optional `pageId`). Recurses into conditional `then`/`else`. |
| `export_interactions` | Export the wired interactions of designated **completed screens** as a canonical, framework-agnostic **JSON spec** for developer handoff. Input `{ screens: string[] (frame node IDs), pageId? }`. Each interaction is a typed action (navigate / scrollTo / openOverlay / swapOverlay / closeOverlay / back / openUrl / setVariable / toggleVariable / changeVariant / conditional); unmappable actions are flagged in `unsupported[]`, unknown screen IDs in `missingScreens[]`. Read-only — developers (or Claude) derive framework code from the JSON. |
| `clear_reactions` | Remove reactions from one or more nodes |
| `set_frame_scroll` | **Write**: configure scroll-related properties on one or more FRAME nodes. Each entry accepts optional `direction` (`NONE` / `HORIZONTAL` / `VERTICAL` / `BOTH`) and/or optional `fixedChildren` (number of top-most children to fix when scrolling — Figma's sticky-header model fixes the first N children in z-order; layer panel order matters). At least one of `direction` or `fixedChildren` must be provided per entry. Each frame succeeds or fails independently; response includes `applied` array naming which fields were set. |

### Developer handoff: export interactions as JSON

`export_interactions` turns the prototype interactions you wired into a **language-neutral JSON spec** — a faithful map of "what each control does" (trigger → actions) for the screens you designate as done. It is intentionally framework-agnostic: it describes the behavior (navigate, set variable, conditional, …) using Figma's own vocabulary, and a developer (or Claude, on request) generates React/Vue/state-machine code from it. It does NOT emit framework code or visual UI — pair it with Figma Dev Mode / Code Connect for the UI.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| A tool returns `피그마 플러그인 연결을 확인해주세요` (check the plugin connection) | The plugin isn't connected. Make sure the server is running, the plugin is open in Figma, and its UI shows **Connected** (click **Connect** if not). The server waits ~3s for the plugin before returning this. |
| Plugin UI won't connect / keeps retrying | The server must be running first (`npm start`) and reachable at `ws://localhost:3000`. The port is **hard-coded in the plugin manifest** — if you ran on a non-default `PORT`, update `src/figma-plugin/manifest.json` and `npm run build`, then reload the plugin. |
| Server won't start: `EADDRINUSE :3000` | Another process holds port 3000. Stop it, or run on another port (`PORT=4000 npm start`) — and update the plugin manifest as above. |
| MCP client shows no tools | Confirm the client is configured with `{"url": "http://localhost:3000/sse"}` and the server is up. Re-open the connection after starting the server. |
| A tool call hangs, then the client falls back to another tool | A **second MCP client** connected and evicted the first (single-active, newest-wins). Keep one client per server; reconnect the one you want to use. A stdio↔SSE bridge (e.g. supergateway) may not surface the eviction — the server logs `a second MCP client connected — evicted the prior SSE connection`. |
| `get_canvas_overview` shows `frames: []` but the page clearly has frames | `get_canvas_overview` lists only **top-level** frames, so frames nested inside a **Section** don't appear. `get_prototype_flow` lists frames recursively (Sections included) and is the better read for a populated page; pass `pageId` if you're not on the intended page. |
| Cryptic crash on startup (syntax / module errors) | Check your Node version — this needs **Node ≥ 18** (`node -v`). |
| Client shows a zod `invalid_union` error mentioning `error.code` expected number, or `ECONNREFUSED ...:3000`, at startup | Your `:3000` server isn't running. For **Claude Desktop**, use the `--stdio` command config (it launches the server for you). For **Claude Code** over SSE, start `npx figma-prototype-mcp` first. (A stdio↔SSE bridge like supergateway reports a missing server as this malformed frame.) |

## Known limitations

- Reaction actions: **Navigate To**, **Scroll To**, **Open Overlay**, **Close Overlay**, **Back**, **Open URL**, **Swap Overlay**, **Change To** (component variant switch), **Set Variable** (boolean / number / string / COLOR-via-hex), **Toggle Variable** (BOOLEAN), **Conditional** (single comparison, or a one-level AND/OR compound over ≥2 comparisons, IF/ELSE). Not supported: NOT/negation, mixing AND with OR, nested compound conditions, nested conditionals, else-if chains, media-runtime triggers.
- **Conditional is single-level IF/ELSE only — no `else-if` chains.** Figma's prototype conditional has no "Else if" in the product UI, and the plugin API silently collapses a multi-block conditional to a single if/else on write (verified 2026-06-01). Express multi-way branching with separate reactions/variables instead.
- Default transition is **Instant**. Smart Animate is available as an option but requires matching layer designs.
- **Figma desktop/web app must be open and the plugin running** — no headless execution.
- Single-page scope (cross-page navigation untested).
- MCP server and plugin run on **localhost** (no remote).

## License

MIT. Includes code derived from [grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) (MIT) — see `LICENSE`.
