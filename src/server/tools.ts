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
  ListVariablesInput,
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
  ProtoSetVariableInput,
  ProtoToggleVariableInput,
  ProtoConditionalInput,
  ProtoGetLastHistoryInput,
  compileProtoWire,
  compileProtoOverlay,
  compileProtoScroll,
  compileProtoBack,
  compileProtoUrl,
  compileProtoSetVariable,
  compileProtoToggleVariable,
  compileProtoConditional,
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
      name: "list_variables",
      description:
        "List Figma variables usable by name in set/toggle/conditional tools. Returns `local` variables " +
        "(in this file) and `library` variables (from connected libraries) — library variables are usable " +
        "directly in set/toggle/conditional and are auto-imported on first use. " +
        "Call this BEFORE proto_set_variable / proto_toggle_variable / proto_conditional instead of guessing " +
        "a variable name. `remoteEnumerated:false` means library enumeration was unavailable (local list still valid).",
      schema: ListVariablesInput,
      command: "LIST_VARIABLES" as CommandName,
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
        "Use when the WHOLE screen changes to the destination. For a modal/popup/dialog/toast/sheet " +
        "that appears ON TOP of the current screen ('떠/팝업/모달'), use proto_overlay (open) instead. " +
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
        "'open' = content floating above the current screen (modal/popup/dialog/toast/bottom-sheet); " +
        "for a full screen change use proto_wire. 'close' = dismiss an open overlay, revealing the screen " +
        "underneath it. If the user says 'go back / 돌아가 / 뒤로' while on an overlay, that is AMBIGUOUS " +
        "between close (reveal the underlying screen) and proto_back (history pop) — ask the user which " +
        "they mean rather than guessing. " +
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
        "NOT for the general 'scroll feel' between pages ('스크롤 느낌으로 화면이 부드럽게 넘어가게') — for that effect, use a directional transition " +
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
        "Use for 'go back / 뒤로' = return to whatever screen the user came from (dynamic, no fixed destination). " +
        "To navigate to a SPECIFIC previous frame, use proto_wire instead. " +
        "⚠️ If the source is on an OVERLAY (popup/modal/dialog/sheet shown on top of another screen), " +
        "'go back / 돌아가 / 뒤로' is AMBIGUOUS — it may mean dismiss the overlay to reveal the screen " +
        "underneath (= proto_overlay close) or pop the navigation history (= Back, which on an overlay " +
        "often lands on an unexpected earlier frame). Ask the user which they mean before wiring. " +
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
      name: "proto_set_variable",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Wire source nodes to the Set Variable action — clicking the source assigns a literal value to a " +
        "Figma variable (resolved by NAME — local or library/remote; library variables are auto-imported on use). " +
        "Input `{ sets: [{ from, variable, value }] }`. " +
        "`value` is boolean / number / string and must match the variable's resolvedType; for COLOR variables, " +
        "pass `value` as a hex string (\"#RRGGBB\" or \"#RRGGBBAA\"). " +
        "To flip a BOOLEAN without naming the target value ('토글/켜고 끄기'), use proto_toggle_variable — " +
        "this tool assigns a SPECIFIC value. " +
        "Defaults: trigger=ON_CLICK. No `motion` field — variable changes are instant (transition defaults to INSTANT). " +
        "Compiles to create_reactions internally.",
      schema: ProtoSetVariableInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoSetVariableInput;
        return recordedHandler(historyStore, "proto_set_variable", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoSetVariable(parsedInput)),
        );
      },
    },
    {
      name: "proto_toggle_variable",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Wire source nodes to the Toggle Variable action — clicking the source flips a BOOLEAN variable " +
        "(resolved by NAME — local or library/remote, auto-imported on use). " +
        "Input `{ toggles: [{ from, variable }] }`. The variable's resolvedType MUST be BOOLEAN " +
        "(plugin rejects otherwise). " +
        "Use to flip/switch a boolean ('토글') with no named target value; to assign a specific value " +
        "(true/false/number/string/color) use proto_set_variable instead. " +
        "Defaults: trigger=ON_CLICK. No `motion` field — variable changes are instant. " +
        "Compiles to create_reactions internally (desugars to CONDITIONAL + 2 SET_VARIABLE under the hood; " +
        "list_reactions round-trips to toggle_variable shape).",
      schema: ProtoToggleVariableInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoToggleVariableInput;
        return recordedHandler(historyStore, "proto_toggle_variable", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoToggleVariable(parsedInput)),
        );
      },
    },
    {
      name: "proto_conditional",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Wire a conditional reaction (if/then/else) on a source node based on a variable comparison. " +
        "Use for '~면 ~하고 아니면 ~' / '조건에 따라' branching interactions. " +
        "The variable is referenced by NAME; the plugin resolves it at runtime — local variables match directly, " +
        "library/remote variables are auto-imported on use. Use list_variables to find exact names. " +
        "Input `{ conditions: [{ from, if: { variable, operator?, value }, then, else? }] }`. " +
        "`if.operator` defaults to \"==\" if omitted (most common case); other operators: !=, <, <=, >, >=. " +
        "`then` / `else` each take exactly ONE branch action (single sugar entry). Branch sugar keys: " +
        "`navigate` / `scroll` / `overlay` / `swap` / `close` / `back` / `url` / `set`. " +
        "`toggle_variable` is not available inside conditional (toggle itself desugars to CONDITIONAL — nesting is meaningless). " +
        "For multi-action branches, use low-level `create_reactions` (escape hatch). " +
        "Overlay/swap branches: if either branch is `{ overlay }` or `{ swap }`, SMART_ANIMATE auto-rewrites to " +
        "DISSOLVE (Figma's overlay transition constraint); the motion intent (duration/easing) is preserved. " +
        "Variable type must match `if.value` (BOOLEAN/FLOAT/STRING); COLOR variables are NOT comparable. " +
        "`trigger` / `motion` apply at the conditional level (shared across branches); branch sugars do NOT accept them.",
      schema: ProtoConditionalInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoConditionalInput;
        return recordedHandler(historyStore, "proto_conditional", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoConditional(parsedInput)),
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

/**
 * Build a fresh MCP Server with all tool handlers registered, sharing the
 * process-singleton PluginSession + HistoryStore. One Server per SSE connection
 * (see SseSession) — avoids reusing a single Server's transport state across
 * sequential client connections.
 */
export function createMcpServer(
  session: PluginSession,
  historyStore: HistoryStore,
  version: string,
): Server {
  const server = new Server(
    { name: "figma-prototype-mcp", version },
    { capabilities: { tools: {} } },
  );
  registerToolHandlers(server, session, historyStore);
  return server;
}
