import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { PluginSession } from "./sessions.js";

const PLUGIN_PATH = "/ws";

/**
 * Attach a WebSocket upgrade handler at `/ws` to the existing http.Server.
 * Routes the connected socket into the single-active PluginSession.
 */
export function attachPluginWebSocket(httpServer: HttpServer, session: PluginSession): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url === PLUGIN_PATH) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    session.setActive(ws);
    ws.on("message", (raw) => {
      let msg: unknown;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "response") {
        session.handleResponse(msg as { id: string; status: "ok" | "error"; result?: unknown; error?: { message?: string } });
      }
    });
    ws.on("close", () => session.clearActive(ws));
    ws.on("error", () => session.clearActive(ws));
  });

  return wss;
}
