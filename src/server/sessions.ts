import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export interface PluginSessionOptions {
  /** Per-command timeout in ms (default 30s). */
  commandTimeoutMs?: number;
  /** How long sendCommand will wait for a plugin to become active before failing (default 3s). */
  connectWaitMs?: number;
}

export class PluginSession {
  private active: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private waiters = new Set<() => void>();
  private readonly commandTimeoutMs: number;
  private readonly connectWaitMs: number;

  constructor(opts: PluginSessionOptions = {}) {
    this.commandTimeoutMs = opts.commandTimeoutMs ?? 30_000;
    this.connectWaitMs = opts.connectWaitMs ?? 3_000;
  }

  isConnected(): boolean {
    return this.active !== null && this.active.readyState === 1;
  }

  setActive(ws: WebSocket): void {
    if (this.active && this.active !== ws) {
      try { this.active.send(JSON.stringify({ type: "system", message: "Replaced by newer connection" })); } catch {}
      try { this.active.close(); } catch {}
      this.failAllPending(new Error("Plugin connection replaced by newer connection"));
    }
    this.active = ws;
    try { ws.send(JSON.stringify({ type: "ready" })); } catch {}
    this.notifyWaiters();
  }

  clearActive(ws: WebSocket): void {
    if (this.active === ws) {
      this.active = null;
      this.failAllPending(new Error("Plugin disconnected"));
    }
  }

  handleResponse(msg: { id: string; status: "ok" | "error"; result?: unknown; error?: { message?: string } }): void {
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.status === "ok") p.resolve(msg.result);
    else p.reject(new Error(msg.error?.message ?? "plugin error"));
  }

  async sendCommand(command: string, params: unknown): Promise<unknown> {
    if (!this.isConnected()) {
      await this.waitForConnection(this.connectWaitMs);
      if (!this.isConnected()) {
        throw new Error("피그마 플러그인 연결을 확인해주세요");
      }
    }
    const id = randomUUID();
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Command ${command} timed out after ${this.commandTimeoutMs}ms`));
      }, this.commandTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.active!.send(JSON.stringify({ type: "command", id, command, params }));
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  private waitForConnection(timeoutMs: number): Promise<void> {
    if (this.isConnected()) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        resolve();
      }, timeoutMs);
      const waiter = () => {
        clearTimeout(timer);
        this.waiters.delete(waiter);
        resolve();
      };
      this.waiters.add(waiter);
    });
  }

  private notifyWaiters(): void {
    for (const w of [...this.waiters]) w();
  }

  private failAllPending(err: Error): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(id);
    }
  }
}
