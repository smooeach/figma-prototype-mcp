# figma-prototype-mcp

Local MCP server that lets Claude (or any MCP client) create real Figma prototype interactions — On click → Navigate to <frame> — from natural language prompts.

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

## Run (three terminals)

**1. Relay** (always-on local WebSocket server):
```bash
npm run relay
# [relay] listening on ws://localhost:3055
```

**2. Figma plugin**:
- Open Figma desktop app.
- Plugins → Development → Import plugin from manifest...
- Choose `dist/figma-plugin/manifest.json`.
- Run the plugin. Enter a channel name (e.g. `my-session`) and click **Connect**. Wait for `Connected on channel: my-session`.

**3. MCP server**:
Configure your MCP client (e.g. Claude Code) to launch the server with the matching channel:

```json
{
  "mcpServers": {
    "figma-prototype": {
      "command": "npx",
      "args": ["tsx", "src/mcp-server/index.ts"],
      "env": { "FIGMA_CHANNEL": "my-session" }
    }
  }
}
```

## Tools

| Tool | Purpose |
|---|---|
| `get_canvas_overview` | One-shot context primer: current page, frames, selection |
| `find_nodes` | Search nodes by name (and optional type) |
| `create_navigate_reactions` | **Write**: batch create On-click → Navigate to <frame> reactions |
| `list_reactions` | Inspect existing reactions on a node |
| `clear_reactions` | Remove reactions from one or more nodes |

## Manual E2E checklist (v1 acceptance)

After install + all three components running, verify these scenarios in Figma. Each must pass.

- [ ] **1. Selection-based wiring**: Create a Figma file with 2 frames (`Login`, `Home`) and 3 buttons inside `Login`. Select the 3 buttons. Ask Claude: "현재 선택한 버튼들을 Home에 연결해줘". Expected: 3 reactions created. Verify in Figma (Prototype tab shows arrows) and in Present mode (clicks navigate to Home).
- [ ] **2. Name-based wiring**: With nothing selected, create 3 frames each containing one `Continue` button. Ask: "모든 Continue 버튼을 다음 화면으로 순서대로 연결해줘". Expected: button in frame 1 → frame 2, button in frame 2 → frame 3, etc.
- [ ] **3. Inspection**: Select a wired button. Ask: "이 버튼 어디로 연결돼 있어?". Expected: Claude reports the destination frame name correctly.
- [ ] **4. Undo**: After scenario 1, ask: "방금 만든 연결 다 지워줘". Expected: reactions removed from all 3 buttons.
- [ ] **5. Error path**: Ask: "Login 버튼을 NonexistentFrame으로 연결해줘". Expected: Claude reports a friendly error (target not found) without crashing.

## Known limitations (v1)

- Only **Navigate To** action. No overlays, variables, scroll-to, set-variant.
- Default transition is **Instant**. Smart Animate is available as an option but requires matching layer designs.
- **Figma desktop/web app must be open and the plugin running** — no headless execution.
- Single-page scope (cross-page navigation untested).
- Relay, MCP server, and plugin all on **localhost** (no remote).

## License

MIT. Includes code derived from [grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) (MIT) — see `LICENSE`.
