# SSE single-active session (newest-wins) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a new `/sse` MCP-client connection cleanly replace any prior one (newest-wins), fixing the zombie-SSE-blocks-new-connection friction and the shared-`Server` response-routing bug.

**Architecture:** Extract a small testable `SseSession` holder that tracks the single active `{ server, transport }` and closes the previous transport when a new one is adopted. Give each `/sse` connection its own MCP `Server` via a `createMcpServer` factory (sharing the singleton `PluginSession` + `HistoryStore`), instead of re-using one shared `Server` across transports. Mirrors the plugin (WS) side's already-shipped single-active model.

**Tech Stack:** TypeScript + Express 5 + @modelcontextprotocol/sdk (SSEServerTransport) + Vitest. No new dependencies.

**Source spec:** `docs/superpowers/specs/2026-06-01-sse-single-active-session-design.md`

---

## File Map

| 작업 | 경로 | 책임 |
|---|---|---|
| **생성** | `src/server/sse-session.ts` | (Task 1) `SseSession` — single active `{server, transport}`; `activate` closes prior transport; `get(sessionId)`; `clear`; `isActive` |
| **생성** | `tests/sse-session.test.ts` | (Task 1) unit tests with stub transports |
| **수정** | `src/server/tools.ts` | (Task 2) export `createMcpServer(session, historyStore, version)` factory |
| **수정** | `src/server/index.ts` | (Task 2) `/sse` + `/messages` use `SseSession` + factory; remove shared `mcp` + `transports` Map |

Plugin side (`sessions.ts`, `plugin-ws.ts`) is untouched.

---

## Task 1: `SseSession` unit (TDD)

**Files:**
- Create: `src/server/sse-session.ts`
- Create: `tests/sse-session.test.ts`

- [ ] **Step 1: Run baseline suite**

Run: `npm test -- --reporter=basic`
Expected: 335 passing.

- [ ] **Step 2: Write the failing tests**

Create `tests/sse-session.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { SseSession } from "../src/server/sse-session.js";

// Minimal stub mirroring the bits SseSession uses from SSEServerTransport.
function makeTransport(sessionId: string) {
  return { sessionId, close: vi.fn() };
}
const SERVER = {}; // opaque stand-in for an MCP Server

describe("SseSession", () => {
  it("starts with no active connection", () => {
    const s = new SseSession();
    expect(s.isActive()).toBe(false);
    expect(s.get("anything")).toBeNull();
  });

  it("activate adopts a transport and routes by sessionId", () => {
    const s = new SseSession();
    const t = makeTransport("abc");
    s.activate(SERVER, t);
    expect(s.isActive()).toBe(true);
    expect(s.get("abc")).toBe(t);
    expect(s.get("other")).toBeNull();
  });

  it("activating a second connection closes the first and routes to the second", () => {
    const s = new SseSession();
    const t1 = makeTransport("one");
    const t2 = makeTransport("two");
    s.activate(SERVER, t1);
    s.activate(SERVER, t2);
    expect(t1.close).toHaveBeenCalledTimes(1);
    expect(t2.close).not.toHaveBeenCalled();
    expect(s.get("two")).toBe(t2);
    expect(s.get("one")).toBeNull();
  });

  it("re-activating the SAME transport does not close it", () => {
    const s = new SseSession();
    const t = makeTransport("same");
    s.activate(SERVER, t);
    s.activate(SERVER, t);
    expect(t.close).not.toHaveBeenCalled();
    expect(s.get("same")).toBe(t);
  });

  it("clear removes the active transport when it matches", () => {
    const s = new SseSession();
    const t = makeTransport("x");
    s.activate(SERVER, t);
    s.clear(t);
    expect(s.isActive()).toBe(false);
    expect(s.get("x")).toBeNull();
  });

  it("clear is a no-op when the transport is not the active one", () => {
    const s = new SseSession();
    const active = makeTransport("active");
    const stale = makeTransport("stale");
    s.activate(SERVER, active);
    s.clear(stale);
    expect(s.isActive()).toBe(true);
    expect(s.get("active")).toBe(active);
  });

  it("adopts the new transport even if closing the old one throws", () => {
    const s = new SseSession();
    const t1 = { sessionId: "boom", close: vi.fn(() => { throw new Error("already dead"); }) };
    const t2 = makeTransport("ok");
    s.activate(SERVER, t1);
    expect(() => s.activate(SERVER, t2)).not.toThrow();
    expect(s.get("ok")).toBe(t2);
  });
});
```

- [ ] **Step 3: Run tests — verify FAIL (module missing)**

Run: `npm test -- tests/sse-session.test.ts --reporter=basic`
Expected: FAIL — cannot import `SseSession` (file does not exist yet).

- [ ] **Step 4: Implement `SseSession`**

Create `src/server/sse-session.ts`:

```ts
/**
 * Tracks the single active MCP-client (SSE) connection — newest wins.
 * Symmetric with PluginSession's single-active model on the plugin (WS) side.
 * Transport-shape-agnostic (only needs `sessionId` + `close`) so it unit-tests
 * without a real SSEServerTransport.
 */
interface ActiveTransport {
  readonly sessionId: string;
  close(): Promise<void> | void;
}

export class SseSession<T extends ActiveTransport = ActiveTransport> {
  private active: { server: unknown; transport: T } | null = null;

  /** Adopt `transport` as the active connection; close + discard any prior one. */
  activate(server: unknown, transport: T): void {
    if (this.active && this.active.transport !== transport) {
      try {
        void this.active.transport.close();
      } catch {
        /* prior stream already dead — ignore */
      }
    }
    this.active = { server, transport };
  }

  /** The active transport iff its id matches `sessionId` (POST routing); else null. */
  get(sessionId: string): T | null {
    return this.active && this.active.transport.sessionId === sessionId
      ? this.active.transport
      : null;
  }

  /** Clear iff `transport` is still the active one (called on stream close). */
  clear(transport: T): void {
    if (this.active && this.active.transport === transport) {
      this.active = null;
    }
  }

  isActive(): boolean {
    return this.active !== null;
  }
}
```

- [ ] **Step 5: Run tests — verify PASS**

Run: `npm test -- tests/sse-session.test.ts --reporter=basic`
Expected: 7 tests pass.

- [ ] **Step 6: Typecheck + full suite**

Run: `npm run typecheck && npm test -- --reporter=basic`
Expected: typecheck clean; ~342 tests pass (335 + 7 new).

- [ ] **Step 7: Commit**

```bash
git add src/server/sse-session.ts tests/sse-session.test.ts
git commit -m "feat(server): add SseSession single-active holder (newest-wins)"
```

**디자이너 요약 (include verbatim in report):** SSE 연결을 "최신 우선 단일 활성"으로 관리하는 작은 유닛 추가. 배선은 다음 task. 사용자 체감 변화는 다음 task에서.

---

## Task 2: `createMcpServer` factory + `index.ts` wiring

**Files:**
- Modify: `src/server/tools.ts` (add `createMcpServer` export)
- Modify: `src/server/index.ts` (use `SseSession` + factory; remove shared `mcp` + `transports` Map)

`index.ts` is the Express/SDK composition root — not unit-tested. Gated by typecheck + a boot smoke test.

- [ ] **Step 1: Add the `createMcpServer` factory to `tools.ts`**

`Server` is already imported at the top of `src/server/tools.ts` (line 1). After the existing `registerToolHandlers` function, append:

```ts
/**
 * Build a fresh MCP Server with all tool handlers registered, sharing the
 * process-singleton PluginSession + HistoryStore. One Server per SSE connection
 * (see SseSession) — avoids reusing a single Server's transport state across
 * sequential client connections.
 */
export function createMcpServer(
  session: PluginSession,
  historyStore: HistoryStore,
  version: string,
): Server {
  const server = new Server(
    { name: "figma-prototype-mcp", version },
    { capabilities: { tools: {} } },
  );
  registerToolHandlers(server, session, historyStore);
  return server;
}
```

(`PluginSession` and `HistoryStore` are already imported in `tools.ts` — they appear in `registerToolHandlers`'s signature. If either is type-only imported and the factory needs no value use of them, no change is required; the factory only passes them through.)

- [ ] **Step 2: Typecheck the factory**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Rewrite `index.ts` SSE wiring**

Replace the current `src/server/index.ts` body. The new file:

```ts
import express, { type Request, type Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { readFileSync } from "node:fs";
import { PluginSession } from "./sessions.js";
import { attachPluginWebSocket } from "./plugin-ws.js";
import { createMcpServer } from "./tools.js";
import { HistoryStore } from "./history.js";
import { SseSession } from "./sse-session.js";

const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const PORT = Number(process.env.PORT ?? 3000);

const session = new PluginSession();
const historyStore = new HistoryStore();
const sse = new SseSession<SSEServerTransport>();

const app = express();

app.get("/sse", async (_req: Request, res: Response) => {
  const server = createMcpServer(session, historyStore, pkg.version);
  const transport = new SSEServerTransport("/messages", res);
  sse.activate(server, transport); // closes any prior active stream (newest-wins)
  res.on("close", () => sse.clear(transport));
  await server.connect(transport);
});

app.post("/messages", express.json(), async (req: Request, res: Response) => {
  const t = sse.get(String(req.query.sessionId ?? ""));
  if (!t) {
    res.status(400).send("unknown session");
    return;
  }
  await t.handlePostMessage(req, res, req.body);
});

const httpServer = app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server]   MCP SSE endpoint: GET /sse`);
  console.log(`[server]   Plugin WebSocket:  ws://localhost:${PORT}/ws`);
});

attachPluginWebSocket(httpServer, session);

process.on("unhandledRejection", (err) => {
  console.error("[server] unhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
});
```

Key changes from the old file: import `createMcpServer` (not `registerToolHandlers`) + `SseSession`; drop the module-level `mcp = new Server(...)` and the `transports = new Map(...)`; `/sse` now builds a per-connection `Server`, activates it via `sse`, and clears on close; `/messages` routes via `sse.get(...)`. The Express 5 `req.body` third-arg passthrough (v0.18.0 fix) is preserved.

- [ ] **Step 4: Typecheck + full suite**

Run: `npm run typecheck && npm test -- --reporter=basic`
Expected: typecheck clean; ~342 tests pass (unchanged from Task 1 — no new tests this task).

- [ ] **Step 5: Boot smoke test (server starts + serves /sse, then exits)**

Run:

```bash
PORT=3011 npm start &
SERVER_PID=$!
sleep 2
# /sse should open an SSE stream (HTTP 200, content-type text/event-stream); curl with a 1s cap
curl -sS -m 1 -D - http://localhost:3011/sse -o /dev/null | head -n 3 || true
kill $SERVER_PID 2>/dev/null
echo "boot smoke done"
```

Expected: the server logs the three startup lines and the curl shows `HTTP/1.1 200 OK` with `Content-Type: text/event-stream` (the 1s timeout then drops the stream — that's fine). No crash. "boot smoke done" prints.

- [ ] **Step 6: Commit**

```bash
git add src/server/tools.ts src/server/index.ts
git commit -m "feat(server): SSE newest-wins via per-connection Server + SseSession"
```

**디자이너 요약 (include verbatim in report):** 이제 새 MCP 클라이언트 연결이 이전 연결을 자동으로 대체 — zombie SSE 때문에 수동으로 죽이던 일이 사라짐. 플러그인 쪽 single-active와 대칭.

---

## Task 3: Live verification + memory/README

**Files:** (no production change unless a probe surfaces an issue)
- Modify: `README.md` (optional one-line note if behavior is user-visible)

- [ ] **Step 1: Restart server + connect plugin**

Stop any running server, `npm start`, run the Figma plugin → "Connected".

- [ ] **Step 2: Probe — newest-wins takeover**

Use two short-lived MCP SSE clients (the project's probe style). Pseudocode for a `tmp/probe-sse.mjs`:

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
const URL_ = new URL("http://localhost:3000/sse");
async function connect(name) {
  const c = new Client({ name, version: "0.0.0" }, { capabilities: {} });
  await c.connect(new SSEClientTransport(URL_));
  return c;
}
const a = await connect("client-A");
console.log("A listTools:", (await a.listTools()).tools.length); // works
const b = await connect("client-B");                              // should evict A
console.log("B listTools:", (await b.listTools()).tools.length);  // works
// A is now evicted; a follow-up call on A should fail (stream closed)
try { await a.listTools(); console.log("A still works (unexpected)"); }
catch { console.log("A correctly evicted"); }
await b.close();
```

Expected: B works after connecting; A's subsequent call fails (its stream was closed by the newest-wins eviction). Confirms takeover.

- [ ] **Step 3: Probe — active client still drives the plugin**

With B connected, call a real tool through B (e.g. `list_reactions` on a known node) and confirm it reaches the plugin and returns. Confirms the per-connection Server + shared PluginSession path is intact.

- [ ] **Step 4: Clean up + (optional) README note**

```bash
rm -rf tmp
```

If desired, add to the README Run section: a line noting "connecting a new MCP client automatically replaces any previous one (newest-wins); no need to kill a stale session." Commit if changed:

```bash
git add README.md
git commit -m "docs(readme): note SSE newest-wins client takeover"
```

- [ ] **Step 5: Memory note (controller wrap-up, not a code task)**

The parent controller updates the server-architecture memory: SSE side is now newest-wins single-active, symmetric with the plugin side; the v0.22.0 zombie-SSE friction is resolved.

**디자이너 요약:** 실제로 두 번째 클라이언트 연결이 첫 번째를 깔끔히 대체하고, 활성 클라이언트가 플러그인을 정상 구동함을 확인.

---

## Plan Self-Review (writer's checklist)

**Spec coverage:**
- Spec §2 `SseSession` unit → Task 1 (code + 7 tests matching §6 test plan).
- Spec §3 `createMcpServer` factory → Task 2 Step 1.
- Spec §4 `index.ts` wiring → Task 2 Step 3.
- Spec §5 edge cases → covered by Task 1 tests (re-activate-same no-op, clear-non-active no-op, close-throws-still-adopts) + the `res.on("close")` → `sse.clear` identity guard in Task 2 wiring.
- Spec §6 test plan → Task 1 unit tests + Task 2 boot smoke + Task 3 live probes.
- Spec §7 non-goals → respected (single-active, no auth, plugin side untouched).
- Spec §8 after-ship → Task 3 Step 5 (memory) + optional README.

**Placeholder scan:** no TBD/TODO. The `tmp/probe-sse.mjs` in Task 3 is labeled pseudocode and is a throwaway diagnostic (not committed), consistent with prior live-verification tasks.

**Type/name consistency:**
- `SseSession` (class), `activate(server, transport)`, `get(sessionId)`, `clear(transport)`, `isActive()` — identical across Task 1 definition, Task 1 tests, and Task 2 wiring.
- `createMcpServer(session, historyStore, version)` — defined Task 2 Step 1, called Task 2 Step 3 with `(session, historyStore, pkg.version)`. Matches.
- `SseSession<SSEServerTransport>` in index.ts — `SSEServerTransport` has `sessionId: string` + `close(): Promise<void>`, satisfying the `ActiveTransport` constraint.
- Task 1 must land before Task 2 (index imports `SseSession`). Task ordering enforces it.

**Scope:** 3 tasks, single plan, robustness-only (no new MCP tools). Backward-compatible from the client's perspective; the only behavior change is that a new connection now cleanly replaces a prior one.
