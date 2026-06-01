import { describe, it, expect, vi } from "vitest";
import { SseSession } from "../src/server/sse-session.js";

// Minimal stub mirroring the bits SseSession uses from SSEServerTransport.
function makeTransport(sessionId: string) {
  return { sessionId, close: vi.fn() };
}
const SERVER = {}; // opaque stand-in for an MCP Server

describe("SseSession", () => {
  it("starts with no active connection", () => {
    const s = new SseSession();
    expect(s.isActive()).toBe(false);
    expect(s.get("anything")).toBeNull();
  });

  it("activate adopts a transport and routes by sessionId", () => {
    const s = new SseSession();
    const t = makeTransport("abc");
    s.activate(SERVER, t);
    expect(s.isActive()).toBe(true);
    expect(s.get("abc")).toBe(t);
    expect(s.get("other")).toBeNull();
  });

  it("activating a second connection closes the first and routes to the second", () => {
    const s = new SseSession();
    const t1 = makeTransport("one");
    const t2 = makeTransport("two");
    s.activate(SERVER, t1);
    s.activate(SERVER, t2);
    expect(t1.close).toHaveBeenCalledTimes(1);
    expect(t2.close).not.toHaveBeenCalled();
    expect(s.get("two")).toBe(t2);
    expect(s.get("one")).toBeNull();
  });

  it("re-activating the SAME transport does not close it", () => {
    const s = new SseSession();
    const t = makeTransport("same");
    s.activate(SERVER, t);
    s.activate(SERVER, t);
    expect(t.close).not.toHaveBeenCalled();
    expect(s.get("same")).toBe(t);
  });

  it("clear removes the active transport when it matches", () => {
    const s = new SseSession();
    const t = makeTransport("x");
    s.activate(SERVER, t);
    s.clear(t);
    expect(s.isActive()).toBe(false);
    expect(s.get("x")).toBeNull();
  });

  it("clear is a no-op when the transport is not the active one", () => {
    const s = new SseSession();
    const active = makeTransport("active");
    const stale = makeTransport("stale");
    s.activate(SERVER, active);
    s.clear(stale);
    expect(s.isActive()).toBe(true);
    expect(s.get("active")).toBe(active);
  });

  it("adopts the new transport even if closing the old one throws", () => {
    const s = new SseSession();
    const t1 = { sessionId: "boom", close: vi.fn(() => { throw new Error("already dead"); }) };
    const t2 = makeTransport("ok");
    s.activate(SERVER, t1);
    expect(() => s.activate(SERVER, t2)).not.toThrow();
    expect(s.get("ok")).toBe(t2);
  });
});
