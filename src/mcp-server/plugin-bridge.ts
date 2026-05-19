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
