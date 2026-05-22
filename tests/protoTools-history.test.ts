import { describe, it, expect, vi } from "vitest";
import { HistoryStore } from "../src/server/history.js";
import { makeTools, type ToolEntry } from "../src/server/tools.js";
import type { PluginSession } from "../src/server/sessions.js";

function makeStubSession(response: unknown): PluginSession {
  return { sendCommand: vi.fn().mockResolvedValue(response) } as unknown as PluginSession;
}

function findHandler(tools: ToolEntry[], name: string) {
  const t = tools.find((x) => x.name === name);
  if (!t || t.handler === undefined) throw new Error(`no handler for ${name}`);
  return t.handler;
}

describe("proto_wire records on success", () => {
  it("records one entry with the parsed input", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_wire");
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    await handler({ wires: [{ from: "1:1", to: "1:2" }], replaceExisting: false }, session);
    expect(store.size()).toBe(1);
    const last = store.getLast()[0]!;
    expect(last.tool).toBe("proto_wire");
    expect(last.input).toMatchObject({ wires: [{ from: "1:1", to: "1:2" }] });
    expect(last.result.successCount).toBe(1);
  });

  it("does not record when successCount is 0", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_wire");
    const session = makeStubSession({ successCount: 0, errorCount: 1, warningCount: 0, results: [] });
    await handler({ wires: [{ from: "1:1", to: "1:2" }], replaceExisting: false }, session);
    expect(store.size()).toBe(0);
  });

  it("FIFO ring: 11 sequential proto_wire calls leave store size 10", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_wire");
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    for (let i = 0; i < 11; i++) {
      await handler({ wires: [{ from: `1:${i}`, to: "1:99" }], replaceExisting: false }, session);
    }
    expect(store.size()).toBe(10);
    const oldest = store.getLast(10)[0]!;
    expect((oldest.input as { wires: { from: string }[] }).wires[0]!.from).toBe("1:1");
  });
});

describe("proto_overlay records on success", () => {
  it("records one entry with tool='proto_overlay'", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_overlay");
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    await handler({ overlays: [{ mode: "open", from: "1:1", overlay: "1:9" }], replaceExisting: false }, session);
    expect(store.size()).toBe(1);
    expect(store.getLast()[0]!.tool).toBe("proto_overlay");
  });

  it("does not record when successCount is 0", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_overlay");
    const session = makeStubSession({ successCount: 0, errorCount: 1, warningCount: 0, results: [] });
    await handler({ overlays: [{ mode: "open", from: "1:1", overlay: "1:9" }], replaceExisting: false }, session);
    expect(store.size()).toBe(0);
  });
});

describe("proto_scroll records on success", () => {
  it("records one entry with tool='proto_scroll'", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_scroll");
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    await handler({ scrolls: [{ from: "1:1", to: "1:5" }], replaceExisting: false }, session);
    expect(store.size()).toBe(1);
    expect(store.getLast()[0]!.tool).toBe("proto_scroll");
  });
});

describe("proto_back records on success", () => {
  it("records one entry with tool='proto_back'", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_back");
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    await handler({ backs: [{ from: "1:1" }], replaceExisting: false }, session);
    expect(store.size()).toBe(1);
    expect(store.getLast()[0]!.tool).toBe("proto_back");
  });

  it("does not record when successCount is 0", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_back");
    const session = makeStubSession({ successCount: 0, errorCount: 1, warningCount: 0, results: [] });
    await handler({ backs: [{ from: "1:1" }], replaceExisting: false }, session);
    expect(store.size()).toBe(0);
  });
});

describe("proto_url records on success", () => {
  it("records one entry with tool='proto_url'", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_url");
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    await handler(
      { urls: [{ from: "1:1", url: "https://figma.com" }], replaceExisting: false },
      session,
    );
    expect(store.size()).toBe(1);
    expect(store.getLast()[0]!.tool).toBe("proto_url");
  });

  it("captures openInNewTab in the recorded input", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_url");
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    await handler(
      { urls: [{ from: "1:1", url: "https://figma.com", openInNewTab: true }], replaceExisting: false },
      session,
    );
    const entry = store.getLast()[0]!;
    expect((entry.input as { urls: { openInNewTab: boolean }[] }).urls[0]!.openInNewTab).toBe(true);
  });

  it("does not record when successCount is 0", async () => {
    const store = new HistoryStore();
    const handler = findHandler(makeTools(store), "proto_url");
    const session = makeStubSession({ successCount: 0, errorCount: 1, warningCount: 0, results: [] });
    await handler(
      { urls: [{ from: "1:1", url: "https://figma.com" }], replaceExisting: false },
      session,
    );
    expect(store.size()).toBe(0);
  });
});

describe("mixed proto_* calls preserve ordering", () => {
  it("proto_overlay then proto_wire → getLast(2) returns [overlay, wire]", async () => {
    const store = new HistoryStore();
    const tools = makeTools(store);
    const overlayHandler = findHandler(tools, "proto_overlay");
    const wireHandler = findHandler(tools, "proto_wire");
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    await overlayHandler({ overlays: [{ mode: "open", from: "1:1", overlay: "1:9" }], replaceExisting: false }, session);
    await wireHandler({ wires: [{ from: "1:2", to: "1:3" }], replaceExisting: false }, session);
    const last2 = store.getLast(2);
    expect(last2).toHaveLength(2);
    expect(last2[0]!.tool).toBe("proto_overlay");
    expect(last2[1]!.tool).toBe("proto_wire");
  });
});
