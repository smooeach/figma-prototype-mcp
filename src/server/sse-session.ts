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

  /**
   * Adopt `transport` as the active connection; close + discard any prior one.
   * Returns `true` iff a *different* prior connection was evicted — the caller
   * logs this so a silent takeover (a second MCP client displacing the first) is
   * diagnosable. A well-behaved MCP client fast-fails its next call after eviction
   * (the displaced POST gets HTTP 400 "unknown session"; verified 2026-06-12). A
   * stdio↔SSE bridge such as supergateway may NOT propagate that failure to its
   * stdio client, which then hangs to its own timeout — so keep ONE MCP client per
   * server. Newest-wins is deliberate: it lets a fresh reconnect replace a dead
   * prior stream (the zombie-SSE case) without manual cleanup.
   */
  activate(server: unknown, transport: T): boolean {
    const evicted = this.active !== null && this.active.transport !== transport;
    if (evicted) {
      try {
        void this.active!.transport.close();
      } catch {
        /* prior stream already dead — ignore */
      }
    }
    this.active = { server, transport };
    return evicted;
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
