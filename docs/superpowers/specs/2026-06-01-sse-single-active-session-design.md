# SSE single-active session (newest-wins) — design

Status: design (2026-06-01).
Predecessor: v0.23.0 (`proto_conditional`); follows the abandoned v0.24.0 (else-if, blocked by Figma).
Release type: patch/minor — robustness, no new MCP tools.
Scope: fix the MCP-client (SSE) side so a new `/sse` connection cleanly replaces any prior one (newest-wins), mirroring the plugin (WS) side's already-shipped single-active model. Eliminates the documented "zombie SSE blocks new connection" friction and the latent response-routing bug from sharing one MCP `Server` across multiple transports.

## Goal

Today, connecting a second MCP client (or reconnecting after a stale/backgrounded session) can fail: a zombie SSE stream from a prior client holds the connection, and the new client gets errors (observed HTTP 500 in v0.22.0; resolved only by manually killing the old process). The fix: the newest `/sse` connection wins — the server closes the previous active transport and serves the new one. No manual kill+retry.

## Background — current behavior (the bug)

`src/server/index.ts` today:
- One module-level `mcp = new Server(...)` with tool handlers registered once.
- `/sse` creates a `new SSEServerTransport(...)` per request, stores it in a `transports` Map keyed by `sessionId`, and calls `mcp.connect(transport)` — **on the same shared `Server`** for every client.

Problems:
1. **Response misrouting**: the MCP SDK `Server` holds a single `_transport` for sending responses/notifications. The second `mcp.connect()` overwrites it, so client 1's request responses get sent to client 2's transport. Concurrent/overlapping clients are broken.
2. **Zombie SSE**: a prior client's transport stays in the map with its SSE stream open; nothing evicts it. New connections pile onto the shared `Server`, producing errors instead of a clean takeover.

The plugin (WS) side already solves the analogous problem: `PluginSession.setActive(ws)` closes the previous socket, fails its pending work, and adopts the newest. This spec brings the SSE side to the same model.

## Decisions (from brainstorm)

- **Newest-wins single-active** (not true concurrent multi-client). The tool is local + single-user + drives one Figma; two simultaneous MCP clients commanding one plugin is a non-need (YAGNI). Newest-wins matches the plugin model for one mental model across both sides.
- **Fresh `Server` per connection via a factory** (not re-`connect()` on a shared `Server`). Closing a transport fires the SDK `Server`'s `onclose`, which resets response/progress handler state; reconnecting a new transport to that same `Server` is fragile. A per-connection `Server` (registered via a factory that shares the singleton `PluginSession` + `HistoryStore`) is pristine each time and avoids reasoning about SDK internal reconnect state. Bonus: relaxing the "evict old" step later would yield true multi-client with no other change.
- **Eviction = close the old transport's stream.** SSE has no app-level "you were replaced" hook (unlike the plugin's system message); closing the stream is the signal. MCP clients treat stream close as a disconnect and stop/reconnect.
- **Extract a small, testable unit** for the active-transport bookkeeping (option B from brainstorm), mirroring `PluginSession`'s shape, so the replace/evict logic is unit-tested without real HTTP.
- **POST `/messages`** routes only to the active transport by `sessionId`; a POST bearing a stale (evicted) `sessionId` returns the existing 400 "unknown session". This cleanly rejects a zombie client's residual POSTs.

## Section 1 — File map

| 작업 | 경로 | 책임 |
|---|---|---|
| **수정** | `src/server/tools.ts` | export a `createMcpServer(session, historyStore)` factory (`new Server(...)` + `registerToolHandlers`); keep `registerToolHandlers` as-is |
| **생성** | `src/server/sse-session.ts` | `SseSession` — tracks the single active `{ server, transport }`; `activate()` closes the previous transport; `get(sessionId)` returns the active transport iff its id matches; `clear(transport)` on stream close |
| **수정** | `src/server/index.ts` | `/sse` and `/messages` use `SseSession` + the factory instead of the shared `mcp` + `transports` Map |
| **생성** | `tests/sse-session.test.ts` | unit tests for `SseSession` (replace closes old, get-by-id, clear, idempotent clear) |
| **수정** | `tests/sessions.test.ts` | (no change expected; plugin side untouched) |

## Section 2 — `SseSession` unit (new)

A minimal holder, transport-shape-agnostic for testability. The transport only needs `sessionId: string` and `close(): Promise<void> | void`.

```ts
interface ActiveTransport {
  readonly sessionId: string;
  close(): Promise<void> | void;
}

export class SseSession<T extends ActiveTransport = ActiveTransport> {
  private active: { server: unknown; transport: T } | null = null;

  /** Adopt a new connection as the active one; close + discard any prior active. */
  activate(server: unknown, transport: T): void {
    if (this.active && this.active.transport !== transport) {
      try { void this.active.transport.close(); } catch { /* already dead */ }
    }
    this.active = { server, transport };
  }

  /** The active transport iff it matches sessionId (for POST routing); else null. */
  get(sessionId: string): T | null {
    return this.active && this.active.transport.sessionId === sessionId ? this.active.transport : null;
  }

  /** Clear iff `transport` is still the active one (on stream close). */
  clear(transport: T): void {
    if (this.active && this.active.transport === transport) this.active = null;
  }

  isActive(): boolean { return this.active !== null; }
}
```

(The `server` is held only to keep it alive / discardable with the connection; its type stays `unknown` here to keep this unit free of SDK imports.)

## Section 3 — `createMcpServer` factory

In `src/server/tools.ts` (or a small `mcp-server-factory.ts` if tools.ts is already large — implementer's call):

```ts
export function createMcpServer(session: PluginSession, historyStore: HistoryStore, version: string): Server {
  const server = new Server({ name: "figma-prototype-mcp", version }, { capabilities: { tools: {} } });
  registerToolHandlers(server, session, historyStore);
  return server;
}
```

`PluginSession` and `HistoryStore` remain process singletons (shared across connections); only the `Server` + `SSEServerTransport` are per-connection.

## Section 4 — `index.ts` wiring

```ts
const session = new PluginSession();
const historyStore = new HistoryStore();
const sse = new SseSession<SSEServerTransport>();

app.get("/sse", async (_req, res) => {
  const server = createMcpServer(session, historyStore, pkg.version);
  const transport = new SSEServerTransport("/messages", res);
  sse.activate(server, transport);                 // closes any prior active stream
  res.on("close", () => sse.clear(transport));
  await server.connect(transport);
});

app.post("/messages", express.json(), async (req, res) => {
  const t = sse.get(String(req.query.sessionId ?? ""));
  if (!t) { res.status(400).send("unknown session"); return; }
  await t.handlePostMessage(req, res, req.body);
});
```

The module-level `mcp`/`transports` are removed. Express 5 `req.body` passthrough (the v0.18.0 fix) is preserved.

## Section 5 — Error handling / edge cases

- **Evicting an already-dead transport**: `activate()` wraps `close()` in try/catch; a closed/errored stream throws are ignored.
- **`res.on("close")` ordering**: when `activate()` closes the old transport, the old `res`'s `close` fires → `sse.clear(oldTransport)` is a no-op because `active` already points to the new transport (the `clear` guard checks identity). No accidental clobber of the new active.
- **Stale POST**: a zombie client POSTing with the evicted `sessionId` → `sse.get()` returns null → 400 "unknown session". Clean rejection, no shared-Server corruption.
- **Plugin side untouched**: `PluginSession` and `/ws` handling are unchanged; this is purely the SSE/client side.

## Section 6 — Test plan

Unit (`tests/sse-session.test.ts`) with stub transports (`{ sessionId, close: vi.fn() }`):
- `activate` on empty → `isActive()` true; `get(id)` returns it.
- `activate` a second → first transport's `close()` called exactly once; `get(secondId)` returns second; `get(firstId)` returns null.
- `activate` the SAME transport twice → `close()` NOT called (identity guard).
- `clear(active)` → `isActive()` false; `get` returns null.
- `clear(non-active)` → no-op (active unchanged).
- `close()` that throws → `activate` still adopts the new transport (try/catch).

No live-API surprises expected (pure in-process server-side logic, no Figma runtime surface). Optional live smoke: connect probe A, connect probe B, confirm A's stream closes and B works; confirm a `create_reactions` via B still reaches the plugin.

## Section 7 — Non-goals

- True concurrent multi-client (per-session Servers kept alive simultaneously) — deliberately deferred; this design makes it a one-line change (skip the evict) if ever needed.
- Authentication / remote access — still localhost-only.
- Plugin (WS) side changes — already single-active.

## Section 8 — After ship (memory + release)

- Update server-architecture memory: SSE side now newest-wins single-active, symmetric with the plugin side; the v0.22.0 zombie-SSE friction is resolved.
- Version bump (patch/minor) + README run-section note if user-visible behavior changes (it doesn't materially — connecting a new client just works now).

---

## Live verification outcome (2026-06-01) — PASS

Server restarted with the new code; Figma plugin auto-reconnected.

- **Newest-wins takeover**: client-A connects (listTools → 15), client-B connects (listTools → 15), then A's follow-up call fails (stream evicted). PASS.
- **Active client drives the plugin**: a fresh client's `get_canvas_overview` (page "ㄴ MCP - Test Zone") + `list_reactions` on button01 (`1073:30`) returned through the per-connection Server + shared `PluginSession`. PASS.

No live-API surprises (pure in-process server-side change; no Figma runtime surface). The v0.22.0 zombie-SSE friction is resolved: a new connection cleanly replaces a prior/stale one without manual kill+retry.
