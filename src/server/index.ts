import express, { type Request, type Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { readFileSync } from "node:fs";
import { PluginSession } from "./sessions.js";
import { attachPluginWebSocket } from "./plugin-ws.js";
import { createMcpServer } from "./tools.js";
import { HistoryStore } from "./history.js";
import { SseSession } from "./sse-session.js";

const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const PORT = Number(process.env.PORT ?? 3000);

const session = new PluginSession();
const historyStore = new HistoryStore();
const sse = new SseSession<SSEServerTransport>();

const app = express();

app.get("/sse", async (_req: Request, res: Response) => {
  const server = createMcpServer(session, historyStore, pkg.version);
  const transport = new SSEServerTransport("/messages", res);
  res.on("close", () => sse.clear(transport));
  await server.connect(transport); // establish first (sends the SSE endpoint event); if this throws, the prior connection stays active
  sse.activate(server, transport); // then evict any prior + mark this the active connection (newest-wins)
});

app.post("/messages", express.json(), async (req: Request, res: Response) => {
  const t = sse.get(String(req.query.sessionId ?? ""));
  if (!t) {
    res.status(400).send("unknown session");
    return;
  }
  await t.handlePostMessage(req, res, req.body);
});

const httpServer = app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server]   MCP SSE endpoint: GET /sse`);
  console.log(`[server]   Plugin WebSocket:  ws://localhost:${PORT}/ws`);
});

attachPluginWebSocket(httpServer, session);

process.on("unhandledRejection", (err) => {
  console.error("[server] unhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
});
