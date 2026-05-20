import { describe, it, expect } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import { PluginBridge } from "../src/mcp-server/plugin-bridge.js";

// ---- Mini relay per-test ----

interface MiniRelay {
  port: number;
  server: WebSocketServer;
  channels: Map<string, Set<WebSocket>>;
  stop: () => Promise<void>;
}

let nextPort = 39100;

function attachRelayBehavior(server: WebSocketServer, channels: Map<string, Set<WebSocket>>) {
  server.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }
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

function startMiniRelay(port?: number): MiniRelay {
  const p = port ?? nextPort++;
  const channels = new Map<string, Set<WebSocket>>();
  const server = new WebSocketServer({ port: p });
  attachRelayBehavior(server, channels);
  return {
    port: p,
    server,
    channels,
    stop: () => new Promise<void>((resolve) => {
      for (const ws of server.clients) ws.terminate();
      server.close(() => resolve());
    }),
  };
}

function startMockPlugin(relay: MiniRelay, channel: string) {
  const ws = new WebSocket(`ws://localhost:${relay.port}`);
  ws.on("open", () => ws.send(JSON.stringify({ type: "join", channel, id: "plugin-join" })));
  ws.on("message", (raw) => {
    const data = JSON.parse(raw.toString());
    if (data.type !== "broadcast") return;
    const req = data.message;
    if (req.type !== "command") return;
    ws.send(JSON.stringify({
      type: "message",
      channel,
      message: { id: req.id, type: "response", status: "ok", result: { echoed: req.params } },
    }));
  });
  return ws;
}

async function waitForPluginJoined(relay: MiniRelay, channel: string, timeoutMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (relay.channels.get(channel)?.size === 1) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("plugin did not join in time");
}

describe("PluginBridge", () => {
  it("sends a command and receives a response", async () => {
    const relay = startMiniRelay();
    const channel = "test-bridge-" + Date.now();
    const plugin = startMockPlugin(relay, channel);
    await waitForPluginJoined(relay, channel);

    const bridge = new PluginBridge({ url: `ws://localhost:${relay.port}`, channel, timeoutMs: 5000 });
    await bridge.connect();

    const res = await bridge.sendCommand("GET_CANVAS_OVERVIEW", { hello: 1 });
    expect(res).toEqual({ echoed: { hello: 1 } });

    bridge.close();
    plugin.close();
    await relay.stop();
  });

  it("rejects on timeout when no plugin responds", async () => {
    const relay = startMiniRelay();
    const channel = "test-timeout-" + Date.now();
    const bridge = new PluginBridge({ url: `ws://localhost:${relay.port}`, channel, timeoutMs: 200 });
    await bridge.connect();
    await expect(bridge.sendCommand("GET_CANVAS_OVERVIEW", {})).rejects.toThrow(/timeout/i);
    bridge.close();
    await relay.stop();
  });

  it("auto-reconnects when the relay is restarted", async () => {
    const relay1 = startMiniRelay();
    const port = relay1.port;
    const channel = "test-reconnect-" + Date.now();
    const plugin1 = startMockPlugin(relay1, channel);
    await waitForPluginJoined(relay1, channel);

    const bridge = new PluginBridge({ url: `ws://localhost:${port}`, channel, timeoutMs: 3000 });
    await bridge.connect();

    const first = await bridge.sendCommand("GET_CANVAS_OVERVIEW", { i: 1 });
    expect(first).toEqual({ echoed: { i: 1 } });

    plugin1.close();
    await relay1.stop();

    // Give the OS a moment to release the port, then restart on the SAME port.
    await new Promise((r) => setTimeout(r, 100));
    const relay2 = startMiniRelay(port);
    const plugin2 = startMockPlugin(relay2, channel);
    await waitForPluginJoined(relay2, channel, 3000);

    const second = await bridge.sendCommand("GET_CANVAS_OVERVIEW", { i: 2 });
    expect(second).toEqual({ echoed: { i: 2 } });

    bridge.close();
    plugin2.close();
    await relay2.stop();
  });

  it("rejects sendCommand with a clear error when the bridge cannot reconnect in time", async () => {
    const relay = startMiniRelay();
    const channel = "test-wait-timeout-" + Date.now();
    const bridge = new PluginBridge({ url: `ws://localhost:${relay.port}`, channel, timeoutMs: 300 });
    await bridge.connect();

    // Stop relay; sendCommand should wait up to 300ms then fail.
    await relay.stop();

    await expect(bridge.sendCommand("GET_CANVAS_OVERVIEW", {})).rejects.toThrow(/Bridge not connected|timeout/i);

    bridge.close();
  });

  it("close() prevents auto-reconnect", async () => {
    const relay = startMiniRelay();
    const channel = "test-no-retry-" + Date.now();
    const port = relay.port;
    const bridge = new PluginBridge({ url: `ws://localhost:${port}`, channel, timeoutMs: 1000 });
    await bridge.connect();

    bridge.close();
    await relay.stop();
    await new Promise((r) => setTimeout(r, 100));

    // Spin a new relay on the same port. If bridge auto-reconnected, channels would grow.
    const relay2 = startMiniRelay(port);

    // Wait a generous window to give the (would-be) retry timer a chance.
    await new Promise((r) => setTimeout(r, 1500));
    expect(relay2.channels.get(channel)?.size ?? 0).toBe(0);

    await relay2.stop();
  });
});
