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
