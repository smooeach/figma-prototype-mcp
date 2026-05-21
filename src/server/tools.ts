import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  GetCanvasOverviewInput,
  FindNodesInput,
  CreateReactionsInput,
  ListReactionsInput,
  ClearReactionsInput,
  SetFrameScrollInput,
} from "../mcp-server/tools.js";
import type { CommandName } from "../mcp-server/types.js";
import type { PluginSession } from "./sessions.js";

export const TOOLS = [
  {
    name: "get_canvas_overview",
    description:
      "Return the current Figma page, its top-level frames, and currently selected nodes. " +
      "Use as the first call in any scenario to understand context.",
    schema: GetCanvasOverviewInput,
    command: "GET_CANVAS_OVERVIEW" as CommandName,
  },
  {
    name: "find_nodes",
    description:
      "Search nodes on the current page (or document) by name substring, with optional type filter.",
    schema: FindNodesInput,
    command: "FIND_NODES" as CommandName,
  },
  {
    name: "create_reactions",
    description:
      "Create prototype reactions in batch. Each connection's action picks " +
      "between Navigate To (action.type=navigate, targetFrameId) and Scroll To " +
      "(action.type=scroll, targetNodeId). Each connection succeeds or fails " +
      "independently.",
    schema: CreateReactionsInput,
    command: "CREATE_REACTIONS" as CommandName,
  },
  {
    name: "list_reactions",
    description: "List existing prototype reactions on a single node.",
    schema: ListReactionsInput,
    command: "LIST_REACTIONS" as CommandName,
  },
  {
    name: "clear_reactions",
    description:
      "Remove reactions from one or more nodes. If `indices` is given, exactly one nodeId is allowed.",
    schema: ClearReactionsInput,
    command: "CLEAR_REACTIONS" as CommandName,
  },
  {
    name: "set_frame_scroll",
    description:
      "Configure a frame's scroll behavior (overflowDirection) for prototype mode. " +
      "Accepts a batch of { frameId, direction }; each succeeds or fails independently. " +
      "Direction values: NONE (no scrolling), HORIZONTAL, VERTICAL, BOTH.",
    schema: SetFrameScrollInput,
    command: "SET_FRAME_SCROLL" as CommandName,
  },
];

export function registerToolHandlers(mcp: Server, session: PluginSession): void {
  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.schema) as Record<string, unknown>,
    })),
  }));

  mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS.find((t) => t.name === req.params.name);
    if (!tool) {
      return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
    }
    const parsed = tool.schema.safeParse(req.params.arguments ?? {});
    if (!parsed.success) {
      return { isError: true, content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }] };
    }
    try {
      const result = await session.sendCommand(tool.command, parsed.data);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: (err as Error).message }] };
    }
  });
}
