import { describe, it, expect, vi } from "vitest";
import { HistoryStore } from "../src/server/history.js";

// Helper: simulate what a proto_wire handler call would do, mirroring src/server/tools.ts.
// In the actual handler, the sequence is: parse → compile → sendCommand → record → return.
// This test exercises the record() step assuming the server-side handler wires it correctly.
//
// We don't import the handler directly because registerToolHandlers is the only export
// — instead we replicate the handler body inline against a mocked session.sendCommand.

import {
  ProtoWireInput,
  ProtoOverlayInput,
  ProtoScrollInput,
  compileProtoWire,
  compileProtoOverlay,
  compileProtoScroll,
} from "../src/mcp-server/protoTools.js";
import { summarizeResult } from "../src/server/history.js";

function makeStubSession(response: unknown) {
  return { sendCommand: vi.fn().mockResolvedValue(response) };
}

async function callProtoWire(session: ReturnType<typeof makeStubSession>, store: HistoryStore, input: unknown) {
  const parsed = ProtoWireInput.parse(input);
  const compiled = compileProtoWire(parsed);
  const result = await session.sendCommand("CREATE_REACTIONS", compiled);
  store.record("proto_wire", parsed, summarizeResult(result));
  return result;
}

describe("proto_wire records on success", () => {
  it("records one entry with the parsed input", async () => {
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    const store = new HistoryStore();
    await callProtoWire(session, store, { wires: [{ from: "1:1", to: "1:2" }] });
    expect(store.size()).toBe(1);
    const last = store.getLast()[0]!;
    expect(last.tool).toBe("proto_wire");
    expect(last.input).toMatchObject({ wires: [{ from: "1:1", to: "1:2" }] });
    expect(last.result.successCount).toBe(1);
  });

  it("does not record when successCount is 0", async () => {
    const session = makeStubSession({ successCount: 0, errorCount: 1, warningCount: 0, results: [] });
    const store = new HistoryStore();
    await callProtoWire(session, store, { wires: [{ from: "1:1", to: "1:2" }] });
    expect(store.size()).toBe(0);
  });

  it("FIFO ring: 11 sequential proto_wire calls leave store size 10", async () => {
    const session = makeStubSession({ successCount: 1, errorCount: 0, warningCount: 0, results: [] });
    const store = new HistoryStore();
    for (let i = 0; i < 11; i++) {
      await callProtoWire(session, store, { wires: [{ from: `1:${i}`, to: "1:99" }] });
    }
    expect(store.size()).toBe(10);
    const oldest = store.getLast(10)[0]!;
    expect((oldest.input as { wires: { from: string }[] }).wires[0]!.from).toBe("1:1");
  });
});
