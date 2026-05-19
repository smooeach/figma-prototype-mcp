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
