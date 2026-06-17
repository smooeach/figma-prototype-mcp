import { describe, it, expect, vi } from "vitest";
import { makeTools } from "../src/server/tools.js";
import { HistoryStore } from "../src/server/history.js";
import { analyzeFlow } from "../src/server/validate-flow.js";

const fixtureFlow = {
  page: { id: "0:1", name: "Flow" },
  frames: [
    { id: "A", name: "Home", isStartFrame: true },
    { id: "B", name: "Detail", isStartFrame: false },
  ],
  interactions: [
    { frameId: "A", sourceNodeId: "a1", sourceNodeName: "btn", trigger: { type: "ON_CLICK" },
      actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: "B", destinationName: "Detail" }] },
    { frameId: "B", sourceNodeId: "b1", sourceNodeName: "back", trigger: { type: "ON_CLICK" },
      actions: [{ type: "BACK" }] },
  ],
  truncated: false,
};

describe("validate_prototype tool", () => {
  it("calls GET_PROTOTYPE_FLOW with limit 5000 and returns analyzeFlow(flow)", async () => {
    const tools = makeTools(new HistoryStore());
    const tool = tools.find((t) => t.name === "validate_prototype");
    expect(tool).toBeDefined();

    const sendCommand = vi.fn(async () => fixtureFlow);
    const session = { sendCommand } as any;

    const result = await tool!.handler!({}, session);

    expect(sendCommand).toHaveBeenCalledTimes(1);
    const [cmd, params] = sendCommand.mock.calls[0]!;
    expect(cmd).toBe("GET_PROTOTYPE_FLOW");
    expect(params).toMatchObject({ limit: 5000 });
    expect(result).toEqual(analyzeFlow(fixtureFlow));
  });

  it("forwards pageId when provided", async () => {
    const tools = makeTools(new HistoryStore());
    const tool = tools.find((t) => t.name === "validate_prototype");
    const sendCommand = vi.fn(async () => fixtureFlow);
    const session = { sendCommand } as any;

    await tool!.handler!({ pageId: "0:2" }, session);
    const [, params] = sendCommand.mock.calls[0]!;
    expect(params).toMatchObject({ pageId: "0:2", limit: 5000 });
  });
});
