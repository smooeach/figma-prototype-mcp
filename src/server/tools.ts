import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  GetCanvasOverviewInput,
  FindNodesInput,
  CreateReactionsInput,
  ListReactionsInput,
  ClearReactionsInput,
  SetFrameScrollInput,
} from "../mcp-server/tools.js";
import {
  ProtoWireInput,
  ProtoOverlayInput,
  ProtoScrollInput,
  ProtoBackInput,
  ProtoUrlInput,
  ProtoGetLastHistoryInput,
  compileProtoWire,
  compileProtoOverlay,
  compileProtoScroll,
  compileProtoBack,
  compileProtoUrl,
} from "../mcp-server/protoTools.js";
import type { CommandName } from "../mcp-server/types.js";
import type { PluginSession } from "./sessions.js";
import type { HistoryStore, ProtoToolName } from "./history.js";
import { summarizeResult } from "./history.js";

export type ToolEntry =
  | {
      name: string;
      description: string;
      schema: z.ZodTypeAny;
      command: CommandName;
      handler?: undefined;
    }
  | {
      name: string;
      description: string;
      schema: z.ZodTypeAny;
      command?: undefined;
      handler: (input: unknown, session: PluginSession) => Promise<unknown>;
    };

async function recordedHandler<S>(
  store: HistoryStore,
  tool: ProtoToolName,
  parsedInput: S,
  send: () => Promise<unknown>,
): Promise<unknown> {
  const result = await send();
  store.record(tool, parsedInput, summarizeResult(result));
  return result;
}

export function makeTools(historyStore: HistoryStore): ToolEntry[] {
  return [
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
        "independently. Low-level escape hatch — proto_wire/overlay/scroll cover " +
        "the common cases with named motion presets.",
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
    {
      name: "proto_wire",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Wire one or more source nodes to destination frames with Navigate To. " +
        "Accepts a `motion` preset name (e.g. \"M3_EMPHASIZED\") or a full TransitionInput. " +
        "Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED. Compiles to create_reactions internally.",
      schema: ProtoWireInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoWireInput;
        return recordedHandler(historyStore, "proto_wire", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoWire(parsedInput)),
        );
      },
    },
    {
      name: "proto_overlay",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Create overlay reactions in batch. Each entry has mode = \"open\" | \"swap\" | \"close\". " +
        "open/swap require an `overlay` frameId; close has none. " +
        "Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED. Compiles to create_reactions internally. " +
        "Note: Figma's runtime rejects SMART_ANIMATE on overlay/swap/close navigation, so any SMART_ANIMATE-based " +
        "motion (including all M3/HIG presets) is silently rewritten to DISSOLVE while preserving duration + easing.",
      schema: ProtoOverlayInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoOverlayInput;
        return recordedHandler(historyStore, "proto_overlay", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoOverlay(parsedInput)),
        );
      },
    },
    {
      name: "proto_scroll",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Wire source nodes to scroll targets — Figma's SCROLL_TO action: clicking the source jumps the prototype " +
        "view to a target NODE inside the same scrollable frame (the target frame must have overflowDirection set, " +
        "e.g. via set_frame_scroll). " +
        "NOT for the general 'scroll feel' between pages — for that effect, use a directional transition " +
        "(PUSH or SLIDE_*) via proto_wire instead. " +
        "Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED. Compiles to create_reactions internally.",
      schema: ProtoScrollInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoScrollInput;
        return recordedHandler(historyStore, "proto_scroll", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoScroll(parsedInput)),
        );
      },
    },
    {
      name: "proto_back",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Wire source nodes to the Back navigation action (pops the prototype history stack — no destination). " +
        "Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED. Compiles to create_reactions internally.",
      schema: ProtoBackInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoBackInput;
        return recordedHandler(historyStore, "proto_back", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoBack(parsedInput)),
        );
      },
    },
    {
      name: "proto_url",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Wire source nodes to the Open URL action. Input `{ urls: [{ from, url, openInNewTab? }] }`. " +
        "Defaults: trigger=ON_CLICK, openInNewTab=false. No `motion` field — URL is a terminal " +
        "event and the underlying reaction's transition defaults to INSTANT. Compiles to create_reactions internally.",
      schema: ProtoUrlInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoUrlInput;
        return recordedHandler(historyStore, "proto_url", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoUrl(parsedInput)),
        );
      },
    },
    {
      name: "proto_get_last_history",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Returns the most-recent successful proto_* tool calls as an array of HistoryEntry objects, " +
        "newest-last. Use when the user references \"the last thing I made\" / \"방금 만든 거\" " +
        "to recover the source/target IDs and motion preset, then re-call the corresponding proto_* " +
        "with replaceExisting=true to apply a modification.",
      schema: ProtoGetLastHistoryInput,
      handler: async (input) => {
        const { count } = input as ProtoGetLastHistoryInput;
        return { entries: historyStore.getLast(count) };
      },
    },
  ];
}

export function registerToolHandlers(
  mcp: Server,
  session: PluginSession,
  historyStore: HistoryStore,
): void {
  const TOOLS = makeTools(historyStore);

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
      const result = tool.handler !== undefined
        ? await tool.handler(parsed.data, session)
        : await session.sendCommand(tool.command, parsed.data);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: (err as Error).message }] };
    }
  });
}
