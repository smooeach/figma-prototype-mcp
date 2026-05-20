#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
} from "./tools.js";
import { PluginBridge } from "./plugin-bridge.js";
import type { CommandName } from "./types.js";

const RELAY_URL = process.env.FIGMA_RELAY_URL ?? "ws://localhost:3055";
const CHANNEL = process.env.FIGMA_CHANNEL;
if (!CHANNEL) {
  console.error("FIGMA_CHANNEL env var is required (must match plugin UI channel input)");
  process.exit(1);
}

const bridge = new PluginBridge({ url: RELAY_URL, channel: CHANNEL });

const TOOLS = [
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
];

const server = new Server(
  { name: "figma-prototype-mcp", version: "0.10.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.schema) as Record<string, unknown>,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  }
  const parsed = tool.schema.safeParse(req.params.arguments ?? {});
  if (!parsed.success) {
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
    };
  }
  try {
    const result = await bridge.sendCommand(tool.command, parsed.data);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: (err as Error).message }],
    };
  }
});

async function main() {
  await bridge.connect();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp] figma-prototype-mcp connected on channel "${CHANNEL}"`);
}

main().catch((err) => {
  console.error("[mcp] fatal:", err);
  process.exit(1);
});
