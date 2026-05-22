import express, { type Request, type Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { readFileSync } from "node:fs";
import { PluginSession } from "./sessions.js";
import { attachPluginWebSocket } from "./plugin-ws.js";
import { registerToolHandlers } from "./tools.js";
import { HistoryStore } from "./history.js";

const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const PORT = Number(process.env.PORT ?? 3000);

const session = new PluginSession();
const historyStore = new HistoryStore();
const mcp = new Server(
  { name: "figma-prototype-mcp", version: pkg.version },
  { capabilities: { tools: {} } }
);
registerToolHandlers(mcp, session, historyStore);

const app = express();
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (_req: Request, res: Response) => {
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);
  res.on("close", () => transports.delete(transport.sessionId));
  await mcp.connect(transport);
});

app.post("/messages", express.json(), async (req: Request, res: Response) => {
  const t = transports.get(String(req.query.sessionId ?? ""));
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
