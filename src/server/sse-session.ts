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
