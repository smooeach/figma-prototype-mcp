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

interface ConnectionWaiter {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

const MAX_RETRY_DELAY = 30_000;
const INITIAL_RETRY_DELAY = 1_000;

export class PluginBridge {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly channel: string;
  private readonly timeoutMs: number;
  private pending = new Map<string, PendingCall>();
  private joinResolved: (() => void) | null = null;
  private joinRejected: ((err: Error) => void) | null = null;
  private intentionallyClosed = false;
  private retryDelay = INITIAL_RETRY_DELAY;
  private retryTimer: NodeJS.Timeout | null = null;
  private connectionWaiters = new Set<ConnectionWaiter>();

  constructor(opts: BridgeOptions) {
    this.url = opts.url;
    this.channel = opts.channel;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async connect(): Promise<void> {
    this.intentionallyClosed = false;
    await this.attemptConnect();
  }

  private async attemptConnect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.ws = new WebSocket(this.url);

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        this.ws?.removeListener("open", onOpen);
        this.ws = null;
        reject(err);
      };
      const onOpen = () => {
        this.ws?.removeListener("error", onError);
        resolve();
      };
      this.ws!.once("open", onOpen);
      this.ws!.once("error", onError);
    });

    this.ws.on("message", (raw) => this.handleMessage(raw.toString()));
    this.ws.on("close", () => {
      this.failAllPending(new Error("Bridge not connected: WebSocket closed unexpectedly"));
      if (!this.intentionallyClosed) this.scheduleReconnect();
    });
    this.ws.on("error", () => {
      // Errors after open are handled by the subsequent close event.
    });

    // Join channel.
    const joinPromise = new Promise<void>((resolve, reject) => {
      this.joinResolved = resolve;
      this.joinRejected = reject;
    });
    this.ws.send(
      JSON.stringify({ type: "join", channel: this.channel, id: "mcp-join" })
    );
    await joinPromise;

    // Successful connection — reset backoff and drain waiters.
    this.retryDelay = INITIAL_RETRY_DELAY;
    this.drainConnectionWaiters();
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed) return;
    if (this.retryTimer) return;
    const delay = this.retryDelay;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_DELAY);
      this.attemptConnect().catch(() => {
        this.scheduleReconnect();
      });
    }, delay);
  }

  async sendCommand(command: CommandName, params: unknown): Promise<unknown> {
    await this.waitUntilConnected(this.timeoutMs);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Bridge not connected");
    }
    const id = randomUUID();
    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Command ${command} timeout after ${this.timeoutMs}ms`));
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

  private waitUntilConnected(timeoutMs: number): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.connectionWaiters.delete(waiter);
        reject(new Error(`Bridge not connected (waited ${timeoutMs}ms)`));
      }, timeoutMs);
      const waiter: ConnectionWaiter = { resolve, reject, timer };
      this.connectionWaiters.add(waiter);
    });
  }

  private drainConnectionWaiters(): void {
    for (const w of this.connectionWaiters) {
      clearTimeout(w.timer);
      w.resolve();
    }
    this.connectionWaiters.clear();
  }

  close(): void {
    this.intentionallyClosed = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.failAllPending(new Error("Bridge closed by caller"));
    for (const w of this.connectionWaiters) {
      clearTimeout(w.timer);
      w.reject(new Error("Bridge closed by caller"));
    }
    this.connectionWaiters.clear();
    this.ws?.close();
    this.ws = null;
  }

  private handleMessage(text: string): void {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return;
    }

    if (
      data.type === "system" &&
      data.message?.id === "mcp-join" &&
      typeof data.message?.result === "string"
    ) {
      this.joinResolved?.();
      this.joinResolved = null;
      this.joinRejected = null;
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

  private failAllPending(err: Error): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(id);
    }
  }
}
