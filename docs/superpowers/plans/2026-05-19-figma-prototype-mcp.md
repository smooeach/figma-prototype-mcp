# figma-prototype-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local MCP server that lets Claude create real Figma prototype interactions (On click → Navigate to) from natural language prompts, using a WebSocket bridge to a Figma plugin.

**Architecture:** Three components — (1) MCP server over stdio exposing 5 tools, (2) WebSocket relay on `ws://localhost:3055` with channel-based isolation, (3) Figma plugin that executes commands via Figma Plugin API. MCP server and plugin both connect to the relay; messages route by channel.

**Tech Stack:** TypeScript, Node 18+, `@modelcontextprotocol/sdk`, `zod` (schemas), `ws` (WebSocket), `vitest` (tests), `tsup` (plugin bundle), `@figma/plugin-typings`.

**Spec:** [docs/superpowers/specs/2026-05-19-figma-prototype-mcp-design.md](../specs/2026-05-19-figma-prototype-mcp-design.md)

**Working dir:** project root is `/Users/duotone/Desktop/@Project/2026/AI/prototype01/`. All paths below are relative to that.

---

## File Structure

```
.
├── src/
│   ├── socket.ts                       # WebSocket relay (Node port of grab's Bun version)
│   ├── mcp-server/
│   │   ├── index.ts                    # MCP server entry, registers tools, stdio
│   │   ├── tools.ts                    # 5 tool definitions: Zod schemas + handlers
│   │   ├── plugin-bridge.ts            # WebSocket client to relay (send command, await response)
│   │   └── types.ts                    # Shared types (envelope, tool I/O)
│   └── figma-plugin/
│       ├── manifest.json
│       ├── code.ts                     # Plugin main thread, 5 command handlers
│       ├── reaction-builder.ts         # Pure fn: tool params → Figma Reaction object
│       ├── ui.html                     # Channel input + WebSocket forwarder
│       └── ui.ts                       # UI logic
├── tests/
│   ├── tools.test.ts                   # Zod schema acceptance/rejection tests
│   ├── reaction-builder.test.ts        # Reaction builder unit tests
│   └── bridge.test.ts                  # plugin-bridge integration test (real ws, echo plugin)
├── docs/
│   └── superpowers/
│       ├── specs/...
│       └── plans/...
├── dist/                               # build output (gitignored)
├── package.json
├── tsconfig.json
├── tsup.config.ts                      # plugin bundle config
├── vitest.config.ts
├── .gitignore
├── README.md
└── LICENSE
```

---

## Task 1: Project scaffolding & git init

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`

- [ ] **Step 1: Initialize git repo**

```bash
git init
git config user.email "$(git config --global user.email || echo 'you@example.com')"
git config user.name "$(git config --global user.name || echo 'You')"
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "figma-prototype-mcp",
  "version": "0.1.0",
  "description": "MCP server for creating Figma prototype interactions via natural language",
  "license": "MIT",
  "type": "module",
  "main": "src/mcp-server/index.ts",
  "scripts": {
    "relay": "tsx src/socket.ts",
    "mcp": "tsx src/mcp-server/index.ts",
    "build:plugin": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.108.0",
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.10",
    "tsup": "^8.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
.env
.env.local
```

- [ ] **Step 6: Create `LICENSE`**

```
MIT License

Copyright (c) 2026 [project author]

Portions of this software (src/socket.ts) are derived from
cursor-talk-to-figma-mcp (https://github.com/grab/cursor-talk-to-figma-mcp),
Copyright (c) 2024 Grab Holdings Inc., MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 7: Install deps and verify**

Run:
```bash
npm install
npx tsc --noEmit
```
Expected: install succeeds, `tsc --noEmit` exits 0 (no source files yet, so nothing to check).

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore LICENSE
git commit -m "chore: scaffold project with deps and license"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/mcp-server/types.ts`

- [ ] **Step 1: Create `src/mcp-server/types.ts`**

```ts
// Message envelope shared between MCP server, relay, and Figma plugin.

export type CommandName =
  | "GET_CANVAS_OVERVIEW"
  | "FIND_NODES"
  | "CREATE_NAVIGATE_REACTIONS"
  | "LIST_REACTIONS"
  | "CLEAR_REACTIONS";

export interface CommandRequest {
  id: string;            // uuid for request/response matching
  type: "command";
  command: CommandName;
  params: unknown;       // schema-validated upstream
}

export interface CommandResponse {
  id: string;
  type: "response";
  status: "ok" | "error";
  result?: unknown;
  error?: { code: string; message: string };
}

// Relay-level envelope: wraps CommandRequest/Response with channel info.
// This is what travels over the WebSocket.
export interface RelayMessage {
  id: string;
  type: "message";
  channel: string;
  message: CommandRequest | CommandResponse;
}

export interface JoinMessage {
  type: "join";
  channel: string;
  id?: string;
}

export type IncomingRelayMessage =
  | RelayMessage
  | JoinMessage
  | { type: "system"; message: unknown; channel?: string }
  | { type: "broadcast"; message: CommandRequest | CommandResponse; channel: string; sender: string }
  | { type: "error"; message: string };

// Tool output types (for type-checking handlers).
export interface FrameInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  isStartFrame: boolean;
}

export interface SelectionInfo {
  id: string;
  name: string;
  type: string;
  parentFrameId: string | null;
  hasExistingReactions: boolean;
}

export interface CanvasOverview {
  page: { id: string; name: string };
  frames: FrameInfo[];
  selection: SelectionInfo[];
}

export interface FoundNode {
  id: string;
  name: string;
  type: string;
  parentFrameId: string | null;
  path: string;
}

export interface NavigateConnectionInput {
  sourceNodeId: string;
  targetFrameId: string;
  trigger?: "ON_CLICK" | "ON_HOVER" | "ON_PRESS";
  transition?: "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
}

export interface NavigateConnectionResult {
  sourceNodeId: string;
  status: "success" | "error";
  error?: string;
  reactionIndex?: number;
}

export interface ReactionSummary {
  index: number;
  trigger: { type: string };
  action: {
    type: string;
    destinationId?: string;
    destinationName?: string;
    transition?: { type: string; duration?: number };
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/mcp-server/types.ts
git commit -m "feat: add shared types for MCP envelope and tool I/O"
```

---

## Task 3: Zod schemas for tool inputs (TDD)

**Files:**
- Create: `tests/tools.test.ts`, `src/mcp-server/tools.ts`

- [ ] **Step 1: Write failing tests in `tests/tools.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  GetCanvasOverviewInput,
  FindNodesInput,
  CreateNavigateReactionsInput,
  ListReactionsInput,
  ClearReactionsInput,
} from "../src/mcp-server/tools.js";

describe("GetCanvasOverviewInput", () => {
  it("accepts empty input", () => {
    expect(GetCanvasOverviewInput.parse({})).toEqual({});
  });
  it("accepts pageId", () => {
    expect(GetCanvasOverviewInput.parse({ pageId: "1:2" })).toEqual({ pageId: "1:2" });
  });
});

describe("FindNodesInput", () => {
  it("accepts minimal query", () => {
    const r = FindNodesInput.parse({ query: "Continue" });
    expect(r.query).toBe("Continue");
    expect(r.scope).toBe("page"); // default
    expect(r.limit).toBe(50);     // default
  });
  it("rejects missing query", () => {
    expect(() => FindNodesInput.parse({})).toThrow();
  });
  it("accepts nodeTypes filter and limit override", () => {
    const r = FindNodesInput.parse({ query: "btn", nodeTypes: ["INSTANCE"], limit: 10 });
    expect(r.nodeTypes).toEqual(["INSTANCE"]);
    expect(r.limit).toBe(10);
  });
});

describe("CreateNavigateReactionsInput", () => {
  it("accepts a single connection with defaults", () => {
    const r = CreateNavigateReactionsInput.parse({
      connections: [{ sourceNodeId: "1:1", targetFrameId: "1:2" }],
    });
    expect(r.connections[0].trigger).toBe("ON_CLICK");
    expect(r.connections[0].transition).toBe("INSTANT");
    expect(r.replaceExisting).toBe(false);
  });
  it("rejects empty connections", () => {
    expect(() => CreateNavigateReactionsInput.parse({ connections: [] })).toThrow();
  });
  it("rejects invalid trigger", () => {
    expect(() =>
      CreateNavigateReactionsInput.parse({
        connections: [{ sourceNodeId: "a", targetFrameId: "b", trigger: "ON_LONG_PRESS" }],
      })
    ).toThrow();
  });
});

describe("ListReactionsInput", () => {
  it("requires nodeId", () => {
    expect(() => ListReactionsInput.parse({})).toThrow();
    expect(ListReactionsInput.parse({ nodeId: "1:1" }).nodeId).toBe("1:1");
  });
});

describe("ClearReactionsInput", () => {
  it("requires non-empty nodeIds", () => {
    expect(() => ClearReactionsInput.parse({ nodeIds: [] })).toThrow();
  });
  it("rejects indices when multiple nodeIds", () => {
    expect(() =>
      ClearReactionsInput.parse({ nodeIds: ["a", "b"], indices: [0] })
    ).toThrow();
  });
  it("accepts indices with single nodeId", () => {
    const r = ClearReactionsInput.parse({ nodeIds: ["a"], indices: [0, 1] });
    expect(r.indices).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/tools.test.ts`
Expected: FAIL — `Cannot find module '../src/mcp-server/tools.js'`

- [ ] **Step 3: Create `src/mcp-server/tools.ts` with Zod schemas**

```ts
import { z } from "zod";

export const GetCanvasOverviewInput = z.object({
  pageId: z.string().optional(),
});

export const FindNodesInput = z.object({
  query: z.string().min(1),
  nodeTypes: z.array(z.string()).optional(),
  scope: z.enum(["page", "document"]).default("page"),
  limit: z.number().int().positive().max(500).default(50),
});

const TriggerEnum = z.enum(["ON_CLICK", "ON_HOVER", "ON_PRESS"]);
const TransitionEnum = z.enum(["INSTANT", "DISSOLVE", "SMART_ANIMATE"]);

const ConnectionInput = z.object({
  sourceNodeId: z.string().min(1),
  targetFrameId: z.string().min(1),
  trigger: TriggerEnum.default("ON_CLICK"),
  transition: TransitionEnum.default("INSTANT"),
});

export const CreateNavigateReactionsInput = z.object({
  connections: z.array(ConnectionInput).min(1),
  replaceExisting: z.boolean().default(false),
});

export const ListReactionsInput = z.object({
  nodeId: z.string().min(1),
});

export const ClearReactionsInput = z
  .object({
    nodeIds: z.array(z.string().min(1)).min(1),
    indices: z.array(z.number().int().nonnegative()).optional(),
  })
  .refine(
    (v) => !v.indices || v.nodeIds.length === 1,
    { message: "indices may only be specified when nodeIds has exactly 1 entry" }
  );

// Type inference for handlers.
export type GetCanvasOverviewInput = z.infer<typeof GetCanvasOverviewInput>;
export type FindNodesInput = z.infer<typeof FindNodesInput>;
export type CreateNavigateReactionsInput = z.infer<typeof CreateNavigateReactionsInput>;
export type ListReactionsInput = z.infer<typeof ListReactionsInput>;
export type ClearReactionsInput = z.infer<typeof ClearReactionsInput>;
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/tools.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/tools.test.ts src/mcp-server/tools.ts
git commit -m "feat: add Zod schemas for 5 prototype tools with tests"
```

---

## Task 4: Reaction builder pure function (TDD)

**Files:**
- Create: `tests/reaction-builder.test.ts`, `src/figma-plugin/reaction-builder.ts`

- [ ] **Step 1: Write failing tests in `tests/reaction-builder.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildNavigateReaction } from "../src/figma-plugin/reaction-builder.js";

describe("buildNavigateReaction", () => {
  it("builds ON_CLICK + INSTANT by default", () => {
    const r = buildNavigateReaction({
      sourceNodeId: "1:1",
      targetFrameId: "1:2",
      trigger: "ON_CLICK",
      transition: "INSTANT",
    });
    expect(r.trigger).toEqual({ type: "ON_CLICK" });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toMatchObject({
      type: "NODE",
      destinationId: "1:2",
      navigation: "NAVIGATE",
      transition: { type: "INSTANT" },
      preserveScrollPosition: false,
    });
  });

  it("uses SMART_ANIMATE with default duration & easing", () => {
    const r = buildNavigateReaction({
      sourceNodeId: "a",
      targetFrameId: "b",
      trigger: "ON_CLICK",
      transition: "SMART_ANIMATE",
    });
    expect(r.actions[0].transition).toMatchObject({
      type: "SMART_ANIMATE",
      duration: 0.3,
      easing: { type: "EASE_OUT" },
    });
  });

  it("uses DISSOLVE with default duration", () => {
    const r = buildNavigateReaction({
      sourceNodeId: "a",
      targetFrameId: "b",
      trigger: "ON_HOVER",
      transition: "DISSOLVE",
    });
    expect(r.trigger).toEqual({ type: "ON_HOVER" });
    expect(r.actions[0].transition).toMatchObject({
      type: "DISSOLVE",
      duration: 0.3,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/reaction-builder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/figma-plugin/reaction-builder.ts`**

```ts
// Pure function: converts our tool input to the shape that Figma Plugin API expects
// when calling node.setReactionsAsync([reaction]).
//
// We do NOT import @figma/plugin-typings here because this file runs inside the
// plugin sandbox at runtime; we just return a plain object that matches the shape.
// Tests use a structural assertion instead of the Figma types.

export interface BuildInput {
  sourceNodeId: string;
  targetFrameId: string;
  trigger: "ON_CLICK" | "ON_HOVER" | "ON_PRESS";
  transition: "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
}

export interface BuiltReaction {
  trigger: { type: string };
  actions: Array<{
    type: "NODE";
    destinationId: string;
    navigation: "NAVIGATE";
    transition:
      | { type: "INSTANT" }
      | { type: "DISSOLVE"; duration: number }
      | { type: "SMART_ANIMATE"; duration: number; easing: { type: string } };
    preserveScrollPosition: false;
  }>;
}

export function buildNavigateReaction(input: BuildInput): BuiltReaction {
  let transition: BuiltReaction["actions"][number]["transition"];
  if (input.transition === "INSTANT") {
    transition = { type: "INSTANT" };
  } else if (input.transition === "DISSOLVE") {
    transition = { type: "DISSOLVE", duration: 0.3 };
  } else {
    transition = { type: "SMART_ANIMATE", duration: 0.3, easing: { type: "EASE_OUT" } };
  }

  return {
    trigger: { type: input.trigger },
    actions: [
      {
        type: "NODE",
        destinationId: input.targetFrameId,
        navigation: "NAVIGATE",
        transition,
        preserveScrollPosition: false,
      },
    ],
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/reaction-builder.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/reaction-builder.test.ts src/figma-plugin/reaction-builder.ts
git commit -m "feat: add reaction-builder pure function with tests"
```

---

## Task 5: Port `socket.ts` from Bun to Node + ws

**Files:**
- Create: `src/socket.ts`

- [ ] **Step 1: Create `src/socket.ts` (Node + `ws` port)**

```ts
// Adapted from grab/cursor-talk-to-figma-mcp (MIT) — ported from Bun.serve to Node + ws.
// Behavior preserved: channel-based broadcast relay for MCP server <-> Figma plugin.

import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 3055);
const channels = new Map<string, Set<WebSocket>>();

const wss = new WebSocketServer({ port: PORT });

wss.on("listening", () => {
  console.log(`[relay] listening on ws://localhost:${PORT}`);
});

wss.on("connection", (ws) => {
  console.log("[relay] client connected");

  ws.send(
    JSON.stringify({
      type: "system",
      message: "Please join a channel to start chatting",
    })
  );

  ws.on("close", () => {
    console.log("[relay] client disconnected");
    for (const [channelName, clients] of channels) {
      if (clients.has(ws)) {
        clients.delete(ws);
        broadcast(clients, ws, {
          type: "system",
          message: "A user has left the channel",
          channel: channelName,
        });
      }
    }
  });

  ws.on("message", (raw) => {
    let data: any;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (data.type === "join") {
      handleJoin(ws, data);
      return;
    }

    if (data.type === "message") {
      handleMessage(ws, data);
      return;
    }

    if (data.type === "progress_update") {
      handleProgress(ws, data);
      return;
    }
  });
});

function handleJoin(ws: WebSocket, data: any) {
  const channelName: unknown = data.channel;
  if (typeof channelName !== "string" || channelName.length === 0) {
    ws.send(JSON.stringify({ type: "error", message: "Channel name is required" }));
    return;
  }

  if (!channels.has(channelName)) channels.set(channelName, new Set());
  const clients = channels.get(channelName)!;
  clients.add(ws);
  console.log(`[relay] joined "${channelName}" (${clients.size} clients)`);

  ws.send(
    JSON.stringify({
      type: "system",
      message: `Joined channel: ${channelName}`,
      channel: channelName,
    })
  );
  ws.send(
    JSON.stringify({
      type: "system",
      message: { id: data.id, result: "Connected to channel: " + channelName },
      channel: channelName,
    })
  );

  broadcast(clients, ws, {
    type: "system",
    message: "A new user has joined the channel",
    channel: channelName,
  });
}

function handleMessage(ws: WebSocket, data: any) {
  const channelName: unknown = data.channel;
  if (typeof channelName !== "string") {
    ws.send(JSON.stringify({ type: "error", message: "Channel name is required" }));
    return;
  }
  const clients = channels.get(channelName);
  if (!clients || !clients.has(ws)) {
    ws.send(JSON.stringify({ type: "error", message: "You must join the channel first" }));
    return;
  }
  broadcast(clients, ws, {
    type: "broadcast",
    message: data.message,
    sender: "peer",
    channel: channelName,
  });
}

function handleProgress(ws: WebSocket, data: any) {
  const channelName: unknown = data.channel;
  if (typeof channelName !== "string") return;
  const clients = channels.get(channelName);
  if (!clients || !clients.has(ws)) return;
  broadcast(clients, ws, data);
}

function broadcast(clients: Set<WebSocket>, exclude: WebSocket, payload: unknown) {
  const str = JSON.stringify(payload);
  for (const c of clients) {
    if (c !== exclude && c.readyState === WebSocket.OPEN) c.send(str);
  }
}
```

- [ ] **Step 2: Smoke-test the relay**

Run (in one terminal): `npm run relay`
Expected: prints `[relay] listening on ws://localhost:3055`

Open another terminal and verify with a quick websocket ping (optional sanity check — skip if no `wscat` installed):
```bash
# requires: npm i -g wscat
wscat -c ws://localhost:3055
> {"type":"join","channel":"test","id":"1"}
```
Expected response: two system messages, second one includes `"Connected to channel: test"`.

Kill the relay (Ctrl+C) before next step.

- [ ] **Step 3: Commit**

```bash
git add src/socket.ts
git commit -m "feat: port grab's WebSocket relay from Bun to Node + ws"
```

---

## Task 6: plugin-bridge WebSocket client (TDD with real relay)

**Files:**
- Create: `src/mcp-server/plugin-bridge.ts`, `tests/bridge.test.ts`

- [ ] **Step 1: Write failing test in `tests/bridge.test.ts`**

This test boots a real WebSocket server (mock plugin echo), connects the bridge as if it were the MCP server, sends one command, and verifies the response.

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import { PluginBridge } from "../src/mcp-server/plugin-bridge.js";

let server: WebSocketServer;
const PORT = 39055; // unique test port

// Mini relay that mimics src/socket.ts join + broadcast semantics.
const channels = new Map<string, Set<WebSocket>>();

function startRelay() {
  server = new WebSocketServer({ port: PORT });
  server.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === "join") {
        const ch = data.channel as string;
        if (!channels.has(ch)) channels.set(ch, new Set());
        channels.get(ch)!.add(ws);
        ws.send(JSON.stringify({
          type: "system",
          message: { id: data.id, result: "Connected to channel: " + ch },
          channel: ch,
        }));
        return;
      }
      if (data.type === "message") {
        const ch = data.channel as string;
        const clients = channels.get(ch);
        if (!clients) return;
        for (const c of clients) {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({
              type: "broadcast",
              message: data.message,
              channel: ch,
              sender: "peer",
            }));
          }
        }
      }
    });
    ws.on("close", () => {
      for (const set of channels.values()) set.delete(ws);
    });
  });
}

function startMockPlugin(channel: string) {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  ws.on("open", () => ws.send(JSON.stringify({ type: "join", channel, id: "plugin-join" })));
  ws.on("message", (raw) => {
    const data = JSON.parse(raw.toString());
    if (data.type !== "broadcast") return;
    const req = data.message;
    if (req.type !== "command") return;
    // Echo a response with the inverted shape.
    ws.send(JSON.stringify({
      type: "message",
      channel,
      message: { id: req.id, type: "response", status: "ok", result: { echoed: req.params } },
    }));
  });
  return ws;
}

beforeAll(() => startRelay());
afterAll(() => server.close());

describe("PluginBridge", () => {
  it("sends a command and receives a response", async () => {
    const channel = "test-bridge-" + Date.now();
    const plugin = startMockPlugin(channel);
    // wait for plugin to join
    await new Promise<void>((r) => {
      const check = () => {
        if (channels.get(channel)?.size === 1) return r();
        setTimeout(check, 10);
      };
      check();
    });

    const bridge = new PluginBridge({ url: `ws://localhost:${PORT}`, channel, timeoutMs: 5000 });
    await bridge.connect();

    const res = await bridge.sendCommand("GET_CANVAS_OVERVIEW", { hello: 1 });
    expect(res).toEqual({ echoed: { hello: 1 } });

    bridge.close();
    plugin.close();
  });

  it("rejects on timeout when no plugin responds", async () => {
    const channel = "test-timeout-" + Date.now();
    const bridge = new PluginBridge({ url: `ws://localhost:${PORT}`, channel, timeoutMs: 200 });
    await bridge.connect();
    await expect(bridge.sendCommand("GET_CANVAS_OVERVIEW", {})).rejects.toThrow(/timeout/i);
    bridge.close();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/bridge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/mcp-server/plugin-bridge.ts`**

```ts
import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import type { CommandName } from "./types.js";

interface BridgeOptions {
  url: string;
  channel: string;
  timeoutMs?: number;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class PluginBridge {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly channel: string;
  private readonly timeoutMs: number;
  private pending = new Map<string, PendingCall>();
  private joinResolved: (() => void) | null = null;

  constructor(opts: BridgeOptions) {
    this.url = opts.url;
    this.channel = opts.channel;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.url);

    await new Promise<void>((resolve, reject) => {
      this.ws!.once("open", () => resolve());
      this.ws!.once("error", (err) => reject(err));
    });

    this.ws.on("message", (raw) => this.handleMessage(raw.toString()));
    this.ws.on("close", () => this.failAllPending(new Error("WebSocket closed")));

    // Join channel.
    const joinPromise = new Promise<void>((resolve) => {
      this.joinResolved = resolve;
    });
    this.ws.send(
      JSON.stringify({ type: "join", channel: this.channel, id: "mcp-join" })
    );
    await joinPromise;
  }

  async sendCommand(command: CommandName, params: unknown): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Bridge not connected. Is the relay running and plugin connected?");
    }
    const id = randomUUID();
    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Command ${command} timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });

    this.ws.send(
      JSON.stringify({
        type: "message",
        channel: this.channel,
        message: { id, type: "command", command, params },
      })
    );

    return promise;
  }

  close(): void {
    this.failAllPending(new Error("Bridge closed by caller"));
    this.ws?.close();
    this.ws = null;
  }

  private handleMessage(text: string) {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return;
    }

    // Detect join success (relay echoes a system message with our join id).
    if (
      data.type === "system" &&
      data.message?.id === "mcp-join" &&
      typeof data.message?.result === "string"
    ) {
      this.joinResolved?.();
      this.joinResolved = null;
      return;
    }

    if (data.type !== "broadcast") return;
    const resp = data.message;
    if (!resp || resp.type !== "response") return;

    const pending = this.pending.get(resp.id);
    if (!pending) return;
    this.pending.delete(resp.id);
    clearTimeout(pending.timer);

    if (resp.status === "ok") pending.resolve(resp.result);
    else pending.reject(new Error(resp.error?.message ?? "Unknown plugin error"));
  }

  private failAllPending(err: Error) {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(id);
    }
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/bridge.test.ts`
Expected: both tests PASS (the success one ~50ms, the timeout one ~250ms).

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server/plugin-bridge.ts tests/bridge.test.ts
git commit -m "feat: add plugin-bridge WebSocket client with timeout and integration test"
```

---

## Task 7: MCP server entry — wire tools to bridge

**Files:**
- Create: `src/mcp-server/index.ts`

- [ ] **Step 1: Create `src/mcp-server/index.ts`**

```ts
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  GetCanvasOverviewInput,
  FindNodesInput,
  CreateNavigateReactionsInput,
  ListReactionsInput,
  ClearReactionsInput,
} from "./tools.js";
import { PluginBridge } from "./plugin-bridge.js";
import type { CommandName } from "./types.js";

const RELAY_URL = process.env.FIGMA_RELAY_URL ?? "ws://localhost:3055";
const CHANNEL = process.env.FIGMA_CHANNEL;
if (!CHANNEL) {
  console.error("FIGMA_CHANNEL env var is required (must match plugin UI channel input)");
  process.exit(1);
}

const bridge = new PluginBridge({ url: RELAY_URL, channel: CHANNEL });

const TOOLS = [
  {
    name: "get_canvas_overview",
    description:
      "Return the current Figma page, its top-level frames, and currently selected nodes. " +
      "Use as the first call in any scenario to understand context.",
    schema: GetCanvasOverviewInput,
    command: "GET_CANVAS_OVERVIEW" as CommandName,
  },
  {
    name: "find_nodes",
    description:
      "Search nodes on the current page (or document) by name substring, with optional type filter.",
    schema: FindNodesInput,
    command: "FIND_NODES" as CommandName,
  },
  {
    name: "create_navigate_reactions",
    description:
      "Create On-click → Navigate to <frame> prototype reactions in batch. " +
      "Each connection succeeds or fails independently.",
    schema: CreateNavigateReactionsInput,
    command: "CREATE_NAVIGATE_REACTIONS" as CommandName,
  },
  {
    name: "list_reactions",
    description: "List existing prototype reactions on a single node.",
    schema: ListReactionsInput,
    command: "LIST_REACTIONS" as CommandName,
  },
  {
    name: "clear_reactions",
    description:
      "Remove reactions from one or more nodes. If `indices` is given, exactly one nodeId is allowed.",
    schema: ClearReactionsInput,
    command: "CLEAR_REACTIONS" as CommandName,
  },
];

const server = new Server(
  { name: "figma-prototype-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.schema) as Record<string, unknown>,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  }
  const parsed = tool.schema.safeParse(req.params.arguments ?? {});
  if (!parsed.success) {
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
    };
  }
  try {
    const result = await bridge.sendCommand(tool.command, parsed.data);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: (err as Error).message }],
    };
  }
});

async function main() {
  await bridge.connect();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp] figma-prototype-mcp connected on channel "${CHANNEL}"`);
}

main().catch((err) => {
  console.error("[mcp] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add `zod-to-json-schema` dependency**

Run: `npm install zod-to-json-schema`
Expected: installs successfully.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/mcp-server/index.ts package.json package-lock.json
git commit -m "feat: MCP server entry wiring 5 tools to plugin bridge"
```

---

## Task 8: Figma plugin manifest, UI, and WebSocket forwarder

**Files:**
- Create: `src/figma-plugin/manifest.json`, `src/figma-plugin/ui.html`, `src/figma-plugin/ui.ts`

- [ ] **Step 1: Create `src/figma-plugin/manifest.json`**

```json
{
  "name": "Figma Prototype MCP",
  "id": "figma-prototype-mcp-local",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["ws://localhost:3055"],
    "reasoning": "Local WebSocket relay for MCP server bridge"
  }
}
```

- [ ] **Step 2: Create `src/figma-plugin/ui.html`**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; font-size: 13px; padding: 12px; margin: 0; }
      label { display: block; margin: 8px 0 4px; font-weight: 500; }
      input { width: 100%; padding: 6px 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
      button { margin-top: 12px; padding: 8px 12px; cursor: pointer; }
      #status { margin-top: 12px; font-size: 12px; }
      .ok { color: #18a058; }
      .err { color: #d03050; }
      .pending { color: #888; }
    </style>
  </head>
  <body>
    <label for="channel">Channel</label>
    <input id="channel" placeholder="e.g. my-session" />
    <button id="connect">Connect</button>
    <div id="status" class="pending">Not connected</div>

    <script>
      // ui.ts is compiled inline by tsup. We use vanilla JS here for the build to be trivial.
      const channelInput = document.getElementById('channel');
      const connectBtn = document.getElementById('connect');
      const statusEl = document.getElementById('status');
      let ws = null;

      function setStatus(text, cls) {
        statusEl.textContent = text;
        statusEl.className = cls;
      }

      connectBtn.onclick = () => {
        const channel = channelInput.value.trim();
        if (!channel) { setStatus('Channel name required', 'err'); return; }
        if (ws) ws.close();
        setStatus('Connecting...', 'pending');
        ws = new WebSocket('ws://localhost:3055');

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'join', channel, id: 'plugin-join' }));
        };
        ws.onerror = () => setStatus('Connection failed', 'err');
        ws.onclose = () => setStatus('Disconnected', 'err');

        ws.onmessage = (e) => {
          let data;
          try { data = JSON.parse(e.data); } catch { return; }

          if (data.type === 'system' && data.message && data.message.id === 'plugin-join') {
            setStatus('Connected on channel: ' + channel, 'ok');
            parent.postMessage({ pluginMessage: { type: 'set-channel', channel } }, '*');
            return;
          }

          if (data.type === 'broadcast' && data.message && data.message.type === 'command') {
            // Forward command into the plugin sandbox.
            parent.postMessage({ pluginMessage: { type: 'command', envelope: data.message } }, '*');
          }
        };
      };

      // Forward responses from the plugin sandbox out to WebSocket.
      window.onmessage = (event) => {
        const msg = event.data.pluginMessage;
        if (!msg) return;
        if (msg.type === 'response' && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'message',
            channel: channelInput.value.trim(),
            message: msg.envelope,
          }));
        }
      };
    </script>
  </body>
</html>
```

(No separate `ui.ts` — the inline `<script>` is the entire UI logic. Keeps the build trivial.)

- [ ] **Step 3: Commit**

```bash
git add src/figma-plugin/manifest.json src/figma-plugin/ui.html
git commit -m "feat: Figma plugin manifest and UI with channel input + ws forwarder"
```

---

## Task 9: Figma plugin command handlers (`code.ts`)

**Files:**
- Create: `src/figma-plugin/code.ts`

- [ ] **Step 1: Create `src/figma-plugin/code.ts`**

```ts
// Runs in the Figma plugin sandbox (main thread). Receives commands from ui.html
// over postMessage, dispatches to handlers, and returns responses via postMessage.

import { buildNavigateReaction } from "./reaction-builder.js";

figma.showUI(__html__, { width: 320, height: 220 });

type Command =
  | { type: "GET_CANVAS_OVERVIEW"; params: { pageId?: string } }
  | { type: "FIND_NODES"; params: { query: string; nodeTypes?: string[]; scope?: "page" | "document"; limit?: number } }
  | { type: "CREATE_NAVIGATE_REACTIONS"; params: {
      connections: Array<{
        sourceNodeId: string;
        targetFrameId: string;
        trigger: "ON_CLICK" | "ON_HOVER" | "ON_PRESS";
        transition: "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
      }>;
      replaceExisting: boolean;
    } }
  | { type: "LIST_REACTIONS"; params: { nodeId: string } }
  | { type: "CLEAR_REACTIONS"; params: { nodeIds: string[]; indices?: number[] } };

figma.ui.onmessage = async (msg: any) => {
  if (msg?.type !== "command" || !msg.envelope) return;
  const envelope = msg.envelope as { id: string; command: Command["type"]; params: any };
  const response = await dispatch(envelope.command, envelope.params);
  figma.ui.postMessage({
    type: "response",
    envelope: { id: envelope.id, type: "response", ...response },
  });
};

async function dispatch(command: Command["type"], params: any): Promise<
  { status: "ok"; result: unknown } | { status: "error"; error: { code: string; message: string } }
> {
  try {
    switch (command) {
      case "GET_CANVAS_OVERVIEW": return { status: "ok", result: await handleGetCanvasOverview(params) };
      case "FIND_NODES":          return { status: "ok", result: await handleFindNodes(params) };
      case "CREATE_NAVIGATE_REACTIONS": return { status: "ok", result: await handleCreateNavigateReactions(params) };
      case "LIST_REACTIONS":      return { status: "ok", result: await handleListReactions(params) };
      case "CLEAR_REACTIONS":     return { status: "ok", result: await handleClearReactions(params) };
      default: return { status: "error", error: { code: "UNKNOWN_COMMAND", message: `Unknown command: ${command}` } };
    }
  } catch (err: any) {
    return { status: "error", error: { code: "PLUGIN_EXCEPTION", message: err?.message ?? String(err) } };
  }
}

async function loadPage(pageId?: string): Promise<PageNode> {
  if (!pageId) {
    await figma.loadAllPagesAsync(); // safe; plugin already needs access
    return figma.currentPage;
  }
  await figma.loadAllPagesAsync();
  const page = figma.getNodeById(pageId);
  if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${pageId}`);
  return page as PageNode;
}

function findEnclosingFrameId(node: SceneNode | BaseNode): string | null {
  let cur: BaseNode | null = node.parent ?? null;
  while (cur) {
    if (cur.type === "FRAME") return cur.id;
    cur = (cur as any).parent ?? null;
  }
  return null;
}

function hasReactions(node: BaseNode): boolean {
  return "reactions" in node && Array.isArray((node as any).reactions) && (node as any).reactions.length > 0;
}

async function handleGetCanvasOverview(params: { pageId?: string }) {
  const page = await loadPage(params.pageId);
  const frames = page.children
    .filter((n) => n.type === "FRAME")
    .map((f) => ({
      id: f.id,
      name: f.name,
      width: (f as FrameNode).width,
      height: (f as FrameNode).height,
      isStartFrame: page.flowStartingPoints?.some((p) => p.nodeId === f.id) ?? false,
    }));

  const selection = figma.currentPage.selection.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    parentFrameId: findEnclosingFrameId(n),
    hasExistingReactions: hasReactions(n),
  }));

  return { page: { id: page.id, name: page.name }, frames, selection };
}

async function handleFindNodes(params: { query: string; nodeTypes?: string[]; scope?: "page" | "document"; limit?: number }) {
  const scope = params.scope ?? "page";
  const limit = params.limit ?? 50;
  const q = params.query.toLowerCase();

  let root: BaseNode & ChildrenMixin;
  if (scope === "document") {
    await figma.loadAllPagesAsync();
    root = figma.root;
  } else {
    root = figma.currentPage;
  }

  const matches: BaseNode[] = root.findAll((n) => {
    if (!n.name.toLowerCase().includes(q)) return false;
    if (params.nodeTypes && params.nodeTypes.length && !params.nodeTypes.includes(n.type)) return false;
    return true;
  });

  const truncated = matches.length > limit;
  const sliced = matches.slice(0, limit);

  return {
    nodes: sliced.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parentFrameId: findEnclosingFrameId(n),
      path: pathOf(n),
    })),
    truncated,
  };
}

function pathOf(node: BaseNode): string {
  const parts: string[] = [];
  let cur: BaseNode | null = node;
  while (cur && cur.type !== "DOCUMENT") {
    parts.unshift(cur.name);
    cur = (cur as any).parent ?? null;
  }
  return parts.join(" > ");
}

async function handleCreateNavigateReactions(params: {
  connections: Array<{
    sourceNodeId: string;
    targetFrameId: string;
    trigger: "ON_CLICK" | "ON_HOVER" | "ON_PRESS";
    transition: "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
  }>;
  replaceExisting: boolean;
}) {
  await figma.loadAllPagesAsync();
  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const conn of params.connections) {
    try {
      const source = figma.getNodeById(conn.sourceNodeId);
      if (!source) throw new Error(`Source node not found: ${conn.sourceNodeId}`);
      const target = figma.getNodeById(conn.targetFrameId);
      if (!target) throw new Error(`Target frame not found: ${conn.targetFrameId}`);
      if (target.type !== "FRAME") throw new Error(`Target must be a frame: ${conn.targetFrameId} (got ${target.type})`);
      if (!("setReactionsAsync" in source) || typeof (source as any).setReactionsAsync !== "function") {
        throw new Error(`Node cannot have reactions: ${source.name} (type: ${source.type})`);
      }

      const newReaction = buildNavigateReaction({
        sourceNodeId: conn.sourceNodeId,
        targetFrameId: conn.targetFrameId,
        trigger: conn.trigger,
        transition: conn.transition,
      });

      const existing = ("reactions" in source ? (source as any).reactions : []) as any[];
      const next = params.replaceExisting ? [newReaction] : [...existing, newReaction];
      await (source as any).setReactionsAsync(next);

      results.push({
        sourceNodeId: conn.sourceNodeId,
        status: "success",
        reactionIndex: next.length - 1,
      });
      successCount++;
    } catch (err: any) {
      results.push({
        sourceNodeId: conn.sourceNodeId,
        status: "error",
        error: err?.message ?? String(err),
      });
      errorCount++;
    }
  }

  return { results, successCount, errorCount };
}

async function handleListReactions(params: { nodeId: string }) {
  await figma.loadAllPagesAsync();
  const node = figma.getNodeById(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  if (!("reactions" in node)) throw new Error(`Node has no reactions field: ${node.name}`);
  const reactions = ((node as any).reactions ?? []) as any[];
  return {
    nodeId: node.id,
    nodeName: node.name,
    reactions: reactions.map((r, i) => {
      const action = r.actions?.[0] ?? r.action ?? {};
      const destId = action.destinationId;
      const destNode = destId ? figma.getNodeById(destId) : null;
      return {
        index: i,
        trigger: { type: r.trigger?.type ?? "UNKNOWN" },
        action: {
          type: action.type ?? "UNKNOWN",
          destinationId: destId,
          destinationName: destNode?.name,
          transition: action.transition,
        },
      };
    }),
  };
}

async function handleClearReactions(params: { nodeIds: string[]; indices?: number[] }) {
  await figma.loadAllPagesAsync();
  const results = [];

  for (const nodeId of params.nodeIds) {
    try {
      const node = figma.getNodeById(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (!("setReactionsAsync" in node)) throw new Error(`Node cannot have reactions: ${node.name}`);

      const existing = ((node as any).reactions ?? []) as any[];
      let next: any[];
      let removedCount: number;

      if (params.indices && params.indices.length > 0) {
        const toRemove = new Set(params.indices);
        next = existing.filter((_, i) => !toRemove.has(i));
        removedCount = existing.length - next.length;
      } else {
        next = [];
        removedCount = existing.length;
      }

      await (node as any).setReactionsAsync(next);
      results.push({ nodeId, removedCount, status: "success" });
    } catch (err: any) {
      results.push({ nodeId, removedCount: 0, status: "error", error: err?.message ?? String(err) });
    }
  }

  return { results };
}
```

- [ ] **Step 2: Typecheck (with Figma types)**

The plugin code uses Figma's global types. Add a reference to the typings.

Edit `tsconfig.json` to include the Figma types — replace the existing file with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "tests/**/*"],
  "files": ["node_modules/@figma/plugin-typings/index.d.ts"]
}
```

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/figma-plugin/code.ts tsconfig.json
git commit -m "feat: Figma plugin command handlers for 5 prototype tools"
```

---

## Task 10: Plugin bundle (`tsup`)

**Files:**
- Create: `tsup.config.ts`

- [ ] **Step 1: Create `tsup.config.ts`**

```ts
import { defineConfig } from "tsup";
import { copyFileSync } from "node:fs";

export default defineConfig({
  entry: ["src/figma-plugin/code.ts"],
  outDir: "dist/figma-plugin",
  format: ["iife"],
  target: "es2017",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: false,
  // Figma plugins run in a sandboxed JS environment — no Node, no externals.
  noExternal: [/.*/],
  onSuccess: async () => {
    copyFileSync("src/figma-plugin/manifest.json", "dist/figma-plugin/manifest.json");
    copyFileSync("src/figma-plugin/ui.html", "dist/figma-plugin/ui.html");
  },
});
```

- [ ] **Step 2: Build the plugin**

Run: `npm run build:plugin`
Expected: creates `dist/figma-plugin/code.js`, `manifest.json`, `ui.html`.

- [ ] **Step 3: Verify outputs**

Run: `ls dist/figma-plugin`
Expected output includes:
```
code.js
manifest.json
ui.html
```

- [ ] **Step 4: Commit**

```bash
git add tsup.config.ts
git commit -m "build: tsup config to bundle Figma plugin into dist/"
```

---

## Task 11: README with install + manual E2E checklist

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with install, run instructions, and manual E2E checklist"
```

---

## Final verification (after all tasks done)

- [ ] **Step 1: Full test suite passes**

Run: `npm test`
Expected: all tests across `tools.test.ts`, `reaction-builder.test.ts`, `bridge.test.ts` PASS.

- [ ] **Step 2: Typecheck clean**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Plugin bundle builds**

Run: `npm run build:plugin && ls dist/figma-plugin`
Expected: `code.js`, `manifest.json`, `ui.html` present.

- [ ] **Step 4: Manual E2E (5 scenarios)**

Follow the checklist in `README.md`. All 5 scenarios must pass before declaring v1 done.

- [ ] **Step 5: Tag v0.1.0**

```bash
git tag -a v0.1.0 -m "v0.1.0: prototype interaction creation via natural language"
```
