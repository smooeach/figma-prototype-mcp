import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { PluginSession } from "./sessions.js";
import { attachPluginWebSocket } from "./plugin-ws.js";
import { HistoryStore } from "./history.js";
import { createMcpServer } from "./tools.js";
import { SseSession } from "./sse-session.js";

export interface Deps {
  session: PluginSession;
  historyStore: HistoryStore;
  version: string;
}

export function parseArgs(argv: string[]): { mode: "sse" | "stdio" } {
  return { mode: argv.includes("--stdio") ? "stdio" : "sse" };
}

export function createDeps(): Deps {
  const pkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  return {
    session: new PluginSession(),
    historyStore: new HistoryStore(),
    version: pkg.version,
  };
}

/**
 * Attach the plugin WebSocket to `httpServer`, wire an EADDRINUSE guard, and listen.
 * Caller supplies the http.Server (Express-backed for SSE; bare for stdio) because
 * SSE needs Express on the same server while stdio needs no HTTP routes.
 * Resolves once the server is listening.
 */
export function listenWithWs(
  httpServer: http.Server,
  port: number,
  session: PluginSession,
): Promise<void> {
  attachPluginWebSocket(httpServer, session);
  return new Promise<void>((resolve) => {
    httpServer.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `[server] port ${port} is already in use — another figma-prototype-mcp server may be running. ` +
            `Stop it, or set PORT to a free port (and update the plugin manifest if you change it).`,
        );
      } else {
        console.error("[server] http server error:", err);
      }
      process.exit(1);
    });
    httpServer.listen(port, () => {
      resolve();
    });
  });
}

/** Print the startup banner to stderr after the server is listening. */
export function logStartup(port: number, mode: "sse" | "stdio"): void {
  if (mode === "sse") {
    console.error(`[server] listening on http://localhost:${port}`);
    console.error(`[server]   MCP SSE endpoint: GET /sse`);
  } else {
    console.error(`[server] stdio MCP mode (MCP over stdio; stdout is the JSON-RPC channel)`);
  }
  console.error(`[server]   Plugin WebSocket:  ws://localhost:${port}/ws`);
  console.error(
    `[server]   Figma plugin manifest: ${fileURLToPath(new URL("../figma-plugin/manifest.json", import.meta.url))}`,
  );
}

/** SSE mode (default): Express /sse + /messages, newest-wins single-active client. */
export async function runSse(
  deps: Deps,
  port = Number(process.env.PORT ?? 3000),
): Promise<http.Server> {
  const sse = new SseSession<SSEServerTransport>();
  const app = express();

  app.get("/sse", async (_req: Request, res: Response) => {
    const server = createMcpServer(deps.session, deps.historyStore, deps.version);
    const transport = new SSEServerTransport("/messages", res);
    res.on("close", () => sse.clear(transport));
    await server.connect(transport);
    const evicted = sse.activate(server, transport);
    if (evicted) {
      console.error(
        "[server] a second MCP client connected — evicted the prior SSE connection (newest-wins). " +
          "The displaced client's next call fails fast with HTTP 400 and it should reconnect; " +
          "keep a single MCP client per server (a supergateway bridge may hang instead of surfacing the eviction).",
      );
    }
  });

  app.post("/messages", express.json(), async (req: Request, res: Response) => {
    const t = sse.get(String(req.query.sessionId ?? ""));
    if (!t) {
      res.status(400).send("unknown session");
      return;
    }
    await t.handlePostMessage(req, res, req.body);
  });

  const httpServer = http.createServer(app);
  await listenWithWs(httpServer, port, deps.session);
  logStartup(port, "sse");
  return httpServer;
}

/**
 * stdio mode: serve MCP over stdio (stdout = JSON-RPC) for a client that launches
 * this process directly. Still hosts the plugin WebSocket on :PORT/ws. `transport`
 * is injectable for testing; defaults to a real StdioServerTransport.
 */
export async function runStdio(
  deps: Deps,
  port = Number(process.env.PORT ?? 3000),
  transport: Transport = new StdioServerTransport(),
): Promise<{
  httpServer: http.Server;
  mcpServer: ReturnType<typeof createMcpServer>;
}> {
  const httpServer = http.createServer();
  await listenWithWs(httpServer, port, deps.session);
  const mcpServer = createMcpServer(deps.session, deps.historyStore, deps.version);
  mcpServer.onclose = () => {
    try { httpServer.close(); } catch { /* already closing */ }
  };
  await mcpServer.connect(transport).catch((err) => {
    httpServer.close();
    throw err;
  });
  logStartup(port, "stdio");
  return { httpServer, mcpServer };
}
