import { describe, it, expect } from "vitest";
import { HistoryStore, summarizeResult } from "../src/server/history.js";

describe("HistoryStore — record()", () => {
  it("records a proto_wire entry with UUID + timestamp", () => {
    const store = new HistoryStore();
    const before = Date.now();
    const e = store.record("proto_wire", { wires: [{ from: "1:1", to: "1:2" }] }, { successCount: 1, errorCount: 0, warningCount: 0 });
    const after = Date.now();
    expect(e).not.toBeNull();
    expect(e!.tool).toBe("proto_wire");
    expect(e!.historyId).toMatch(/^[0-9a-f-]{36}$/);
    expect(e!.timestamp).toBeGreaterThanOrEqual(before);
    expect(e!.timestamp).toBeLessThanOrEqual(after);
    expect(e!.input).toEqual({ wires: [{ from: "1:1", to: "1:2" }] });
    expect(e!.result).toEqual({ successCount: 1, errorCount: 0, warningCount: 0 });
    expect(store.size()).toBe(1);
  });

  it("skips entry when successCount === 0 and returns null", () => {
    const store = new HistoryStore();
    const e = store.record("proto_wire", {}, { successCount: 0, errorCount: 1, warningCount: 0 });
    expect(e).toBeNull();
    expect(store.size()).toBe(0);
  });

  it("FIFO drops the oldest at capacity overflow", () => {
    const store = new HistoryStore(3);
    for (let i = 0; i < 4; i++) {
      store.record("proto_wire", { iter: i }, { successCount: 1, errorCount: 0, warningCount: 0 });
    }
    expect(store.size()).toBe(3);
    const all = store.getLast(10);
    expect(all).toHaveLength(3);
    expect((all[0]!.input as { iter: number }).iter).toBe(1);
    expect((all[2]!.input as { iter: number }).iter).toBe(3);
  });

  it("default capacity is 10", () => {
    const store = new HistoryStore();
    for (let i = 0; i < 11; i++) {
      store.record("proto_wire", { iter: i }, { successCount: 1, errorCount: 0, warningCount: 0 });
    }
    expect(store.size()).toBe(10);
  });
});

describe("HistoryStore — getLast()", () => {
  function seeded(): HistoryStore {
    const store = new HistoryStore();
    for (let i = 0; i < 5; i++) {
      store.record("proto_wire", { iter: i }, { successCount: 1, errorCount: 0, warningCount: 0 });
    }
    return store;
  }

  it("defaults count to 1 and returns newest entry", () => {
    const r = seeded().getLast();
    expect(r).toHaveLength(1);
    expect((r[0]!.input as { iter: number }).iter).toBe(4);
  });

  it("returns array in oldest-to-newest order", () => {
    const r = seeded().getLast(3);
    expect(r).toHaveLength(3);
    expect((r[0]!.input as { iter: number }).iter).toBe(2);
    expect((r[1]!.input as { iter: number }).iter).toBe(3);
    expect((r[2]!.input as { iter: number }).iter).toBe(4);
  });

  it("clamps count to buffer.length when count > buffer.length", () => {
    const r = seeded().getLast(99);
    expect(r).toHaveLength(5);
  });

  it("returns empty array for count < 1", () => {
    expect(seeded().getLast(0)).toEqual([]);
    expect(seeded().getLast(-3)).toEqual([]);
  });

  it("returns empty array when store is empty", () => {
    expect(new HistoryStore().getLast()).toEqual([]);
  });
});

describe("summarizeResult", () => {
  it("extracts the three count fields", () => {
    expect(summarizeResult({ successCount: 2, errorCount: 1, warningCount: 3 })).toEqual({
      successCount: 2, errorCount: 1, warningCount: 3,
    });
  });

  it("defaults missing fields to 0", () => {
    expect(summarizeResult({})).toEqual({ successCount: 0, errorCount: 0, warningCount: 0 });
    expect(summarizeResult({ successCount: 5 })).toEqual({ successCount: 5, errorCount: 0, warningCount: 0 });
  });

  it("handles non-object input gracefully (returns all zeros)", () => {
    expect(summarizeResult(null)).toEqual({ successCount: 0, errorCount: 0, warningCount: 0 });
    expect(summarizeResult("error string")).toEqual({ successCount: 0, errorCount: 0, warningCount: 0 });
  });
});
