# Figma Community listing — draft

Prep for publishing the **plugin** to Figma Community (the companion MCP server is on npm: `npx figma-prototype-mcp`). Submit via the Figma desktop app → the plugin's **Publish** flow. This file is the copy + asset checklist to paste/produce there.

> ⚠️ **This is a developer/AI-workflow plugin, not a standalone tool.** It does nothing on its own — it needs the companion server running locally and an MCP client (Claude). The listing MUST say this up front, or users install it, can't connect, and leave bad reviews.

## Naming (read first)
- Figma Community generally **disallows "Figma" in a plugin's published name** (trademark). The current manifest `name` is "Figma Prototype MCP" — for the Community display name use one **without "Figma"**:
  - **Recommended display name:** `Prototype MCP — wire prototypes with AI`
  - Alternatives: `Prototype Wiring (MCP)`, `Talk-to-Prototype (MCP)`
- (The `manifest.json` `name`/`id` are dev-side; Figma manages the published plugin identity through the publish flow. No code change required just to rename the listing.)

## Tagline (≤ ~60 chars)
> Wire Figma prototype interactions from natural language.

## Description (paste into the listing body)

```
Turn plain language into real Figma prototype interactions. Say "when the button on Home is clicked, go to Detail" — and it's wired: trigger, navigation, and motion, no manual arrow-dragging.

It covers the full prototyping surface: Navigate, Scroll, Overlays (open/swap/close), Back, Open URL, Set/Toggle Variable, component-variant "Change to", and Conditional (if/else, incl. AND/OR). It picks a sensible motion preset (Material / iOS feel), auto-degrades Smart Animate to a fade when two screens don't share layers, and finds a back button by position when you just say "add back".

Works ALONGSIDE the official Figma MCP: that one *creates* screens, this one *wires* them into a working prototype.

━━ REQUIRES A LOCAL COMPANION SERVER ━━
This plugin is a bridge — it talks to a small local server you run, which an AI client (e.g. Claude) drives.

1. Install & run the server (Node ≥ 18):
     npx figma-prototype-mcp        → starts it on localhost:3000
2. In your MCP client (Claude Desktop / Claude Code), add the SSE endpoint:
     { "mcpServers": { "figma-prototype": { "url": "http://localhost:3000/sse" } } }
3. Run THIS plugin in your file — it auto-connects to the local server and shows "Connected".
4. Ask the AI in plain language; the interactions appear in your file's Prototype tab.

Full setup, examples, and troubleshooting:
https://github.com/smooeach/figma-prototype-mcp

Open source (MIT). No data leaves your machine — the plugin only connects to your local server (ws://localhost:3000).
```

## Tags / category
- Category: **Prototyping** (or Productivity)
- Tags: `prototyping`, `ai`, `automation`, `developer tools`, `mcp`, `claude`

## Support / links
- Support contact: `https://github.com/smooeach/figma-prototype-mcp/issues`
- Website: `https://github.com/smooeach/figma-prototype-mcp`

## Assets to produce (you create these; Figma requires the first two)
- **Icon — 128×128 px** (PNG). Simple mark; readable tiny. Suggest: a node-to-node arrow / "→" motif, or the "wire" idea.
- **Cover art — 1920×960 px** (PNG/JPG). Suggest: a before/after — two frames with a hand-drawn vs. spoken-arrow, or a chat bubble ("screen1 → screen2로 넘어가게") beside a wired prototype. Include the name + tagline.
- **Screenshots (optional, recommended, ~3):**
  1. The plugin UI showing **Connected**.
  2. A natural-language prompt in Claude → the resulting reaction.
  3. Figma's Prototype tab showing the wired **On click → Navigate to**.
- Keep text in images minimal; show the "say it → it's wired" loop.

## Manifest publish-readiness
- `networkAccess.reasoning` should read for a human reviewer (no internal version jargon). Proposed:
  > "Connects only to a local companion server (ws://localhost:3000) that the user runs themselves; no external network access. The server bridges this plugin to an MCP client. See https://github.com/smooeach/figma-prototype-mcp"
- `permissions: ["teamlibrary"]` is used to resolve team-library variables for variable-based interactions — fine; mention in review notes if asked.
- `editorType: ["figma"]`, `api: "1.0.0"` — OK.

## Submission steps (in the Figma desktop app)
1. Build the plugin: `npm run build` → import `dist/figma-plugin/manifest.json` (Plugins → Development → Import from manifest) if not already.
2. Plugins → Development → right-click the plugin → **Publish…** (or "Publish new release").
3. Fill: name (without "Figma"), tagline, description (above), icon, cover, tags, support contact.
4. Submit for review. Figma reviews Community plugins; a localhost-bridge dev tool is allowed but the description must make the local-server requirement explicit (it does).
5. After approval, add the Community link to the repo README.

## Risks / notes
- **Review may question localhost network access** — the reasoning + description cover it (local-only, user-run server, open source). Precedent exists (similar AI/bridge plugins are on Community).
- **UX expectation** — set it in the first lines so non-technical designers aren't surprised by the setup.
- Versioning: the Community plugin version is managed in the publish flow, independent of the npm package version.
