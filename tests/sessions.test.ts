import { describe, it, expect, vi } from "vitest";
import { PluginSession } from "../src/server/sessions.js";
import {
  PLUGIN_NOT_CONNECTED,
  PLUGIN_DISCONNECTED,
  PLUGIN_CONNECTION_REPLACED,
} from "../src/server/messages.js";

// Minimal mock that mirrors the bits PluginSession uses.
class MockWs {
  readyState = 1;            // 1 === OPEN
  sent: string[] = [];
  closed = false;
  send(data: string) { this.sent.push(data); }
  close() { this.closed = true; this.readyState = 3; }
}

describe("PluginSession", () => {
  it("starts not connected", () => {
    const s = new PluginSession();
    expect(s.isConnected()).toBe(false);
  });

  it("setActive marks the socket active and sends 'ready'", () => {
    const s = new PluginSession();
    const ws = new MockWs();
    s.setActive(ws as any);
    expect(s.isConnected()).toBe(true);
    const parsed = JSON.parse(ws.sent[0]!);
    expect(parsed).toEqual({ type: "ready" });
  });

  it("replaces the previous active socket on new setActive", () => {
    const s = new PluginSession();
    const ws1 = new MockWs();
    const ws2 = new MockWs();
    s.setActive(ws1 as any);
    s.setActive(ws2 as any);
    expect(ws1.closed).toBe(true);
    const replacedMsg = ws1.sent.find((m) => m.includes("Replaced"));
    expect(replacedMsg).toBeDefined();
    expect(s.isConnected()).toBe(true);
  });

  it("sendCommand rejects with the user-facing message when no plugin connects within 3s", async () => {
    vi.useFakeTimers();
    const s = new PluginSession();
    // Attach .catch immediately so Node sees a handled rejection from the start.
    const promise = s.sendCommand("CMD", {});
    promise.catch(() => {});
    // Advance fake time past the 3s waitForConnection
    await vi.advanceTimersByTimeAsync(3_100);
    await expect(promise).rejects.toThrow(PLUGIN_NOT_CONNECTED);
    vi.useRealTimers();
  });

  it("handleResponse resolves a pending command by id", async () => {
    const s = new PluginSession();
    const ws = new MockWs();
    s.setActive(ws as any);
    const promise = s.sendCommand("PING", { a: 1 });
    // Inspect what was sent to extract the assigned id
    const sentCmd = JSON.parse(ws.sent[1]!);
    expect(sentCmd.type).toBe("command");
    expect(sentCmd.command).toBe("PING");
    expect(typeof sentCmd.id).toBe("string");
    s.handleResponse({ id: sentCmd.id, status: "ok", result: { ok: true } });
    await expect(promise).resolves.toEqual({ ok: true });
  });

  it("rejects pending commands with disconnect guidance when the plugin drops", async () => {
    const s = new PluginSession();
    const ws = new MockWs();
    s.setActive(ws as any);
    const promise = s.sendCommand("CMD", {});
    promise.catch(() => {});
    s.clearActive(ws as any);
    await expect(promise).rejects.toThrow(PLUGIN_DISCONNECTED);
  });

  it("rejects pending commands with replaced-connection guidance when a newer plugin connects", async () => {
    const s = new PluginSession();
    const ws1 = new MockWs();
    const ws2 = new MockWs();
    s.setActive(ws1 as any);
    const promise = s.sendCommand("CMD", {});
    promise.catch(() => {});
    s.setActive(ws2 as any);
    await expect(promise).rejects.toThrow(PLUGIN_CONNECTION_REPLACED);
  });

  it("rejects with timeout guidance naming the command when the plugin never responds", async () => {
    vi.useFakeTimers();
    const s = new PluginSession();
    const ws = new MockWs();
    s.setActive(ws as any);
    const promise = s.sendCommand("PING", {});
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(30_100);
    await expect(promise).rejects.toThrow("PING");
    await expect(promise).rejects.toThrow("didn't respond");
    vi.useRealTimers();
  });
});
