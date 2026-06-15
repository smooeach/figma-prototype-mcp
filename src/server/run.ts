import http from "node:http";
import { readFileSync } from "node:fs";
import { PluginSession } from "./sessions.js";
import { attachPluginWebSocket } from "./plugin-ws.js";
import { HistoryStore } from "./history.js";

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
      console.error(`[server]   Plugin WebSocket:  ws://localhost:${port}/ws`);
      resolve();
    });
  });
}
