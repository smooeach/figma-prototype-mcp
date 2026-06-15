import { describe, it, expect } from "vitest";
import { parseArgs, createDeps, runStdio } from "../src/server/run.js";

describe("parseArgs", () => {
  it("defaults to sse when no flag is present", () => {
    expect(parseArgs([])).toEqual({ mode: "sse" });
    expect(parseArgs(["foo", "bar"])).toEqual({ mode: "sse" });
  });

  it("selects stdio when --stdio is present (any position)", () => {
    expect(parseArgs(["--stdio"])).toEqual({ mode: "stdio" });
    expect(parseArgs(["--x", "--stdio", "--y"])).toEqual({ mode: "stdio" });
  });
});

// Minimal Transport-shaped fake: Server.connect calls start() and assigns the
// on* handlers. We only need to observe start() and listening state.
class FakeTransport {
  started = false;
  closed = false;
  onclose?: () => void;
  onerror?: (e: Error) => void;
  onmessage?: (m: unknown) => void;
  async start() { this.started = true; }
  async send() {}
  async close() { this.closed = true; this.onclose?.(); }
}

describe("runStdio", () => {
  it("connects the injected transport and starts the plugin WebSocket", async () => {
    const deps = createDeps();
    const transport = new FakeTransport();
    const { httpServer, mcpServer } = await runStdio(deps, 0, transport as any);
    expect(transport.started).toBe(true);     // Server.connect called transport.start()
    expect(httpServer.listening).toBe(true);   // plugin WS http server is up (ephemeral port)
    await mcpServer.close();                    // triggers transport.close()
    if (httpServer.listening) httpServer.close();
  });
});
