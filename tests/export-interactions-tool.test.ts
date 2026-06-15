import { describe, it, expect, vi } from "vitest";
import { makeTools } from "../src/server/tools.js";
import { HistoryStore } from "../src/server/history.js";
import { buildInteractionSpec } from "../src/server/interaction-spec.js";

const fixtureFlow = {
  page: { id: "0:1", name: "Flow" },
  frames: [{ id: "F1", name: "screenS3_01", isStartFrame: true }],
  interactions: [
    { frameId: "F1", sourceNodeId: "b1", sourceNodeName: "button01", trigger: { type: "ON_CLICK" },
      actions: [{ type: "set_variable", variable: "bg", value: "#000000" }] },
  ],
  truncated: false,
};

describe("export_interactions tool", () => {
  it("calls GET_PROTOTYPE_FLOW and returns buildInteractionSpec for the requested screens", async () => {
    const tools = makeTools(new HistoryStore());
    const tool = tools.find((t) => t.name === "export_interactions");
    expect(tool).toBeDefined();

    const sendCommand = vi.fn(async (_cmd: string, _params?: unknown) => fixtureFlow);
    const session = { sendCommand } as any;

    const result = await tool!.handler!({ screens: ["F1"] }, session);

    expect(sendCommand).toHaveBeenCalledTimes(1);
    const [cmd, params] = sendCommand.mock.calls[0]!;
    expect(cmd).toBe("GET_PROTOTYPE_FLOW");
    expect(params).toMatchObject({ limit: 5000 });

    expect(result).toEqual(buildInteractionSpec(fixtureFlow, ["F1"]));
  });

  it("forwards pageId when provided", async () => {
    const tools = makeTools(new HistoryStore());
    const tool = tools.find((t) => t.name === "export_interactions");

    const sendCommand = vi.fn(async (_cmd: string, _params?: unknown) => fixtureFlow);
    const session = { sendCommand } as any;

    await tool!.handler!({ screens: ["F1"], pageId: "0:2" }, session);

    const [, params] = sendCommand.mock.calls[0]!;
    expect(params).toMatchObject({ pageId: "0:2", limit: 5000 });
  });
});
