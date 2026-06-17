import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  GetCanvasOverviewInput,
  GetPrototypeFlowInput,
  ExportInteractionsInput,
  GenerateInteractionCodeInput,
  FindNodesInput,
  ListVariablesInput,
  CreateVariableInput,
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
  ProtoChangeToInput,
  compileProtoWire,
  compileProtoOverlay,
  compileProtoScroll,
  compileProtoBack,
  compileProtoUrl,
  compileProtoSetVariable,
  compileProtoToggleVariable,
  compileProtoConditional,
  compileProtoChangeTo,
} from "../mcp-server/protoTools.js";
import type { CommandName } from "../mcp-server/types.js";
import { buildInteractionSpec } from "./interaction-spec.js";
import { runEmitter } from "../codegen/registry.js";
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
        "Optional orientation: when the user already names the screens/elements to wire, the proto_* tools " +
        "accept those names directly — you can skip straight to wiring. Reach for this when the request is " +
        "abstract (you need the screen list / start frame) or to recover from an ambiguous/not-found name.",
      schema: GetCanvasOverviewInput,
      command: "GET_CANVAS_OVERVIEW" as CommandName,
    },
    {
      name: "get_prototype_flow",
      description:
        "Return the whole prototype interaction graph of a page in ONE call: its frames " +
        "(each with `isStartFrame`) and every wired interaction — `{ frameId, frameName, sourceNodeId, " +
        "sourceNodeName, trigger, actions }`. Each entry in `actions` is decoded exactly as `list_reactions` returns it " +
        "(navigate / scroll / overlay / swap / close / back / url / change_to / set_variable / " +
        "toggle_variable / conditional incl. all/any compound). Use this to see what is ALREADY wired " +
        "before adding more (avoid duplicates, check what a screen connects to); for a single node use " +
        "list_reactions. Page-scoped — optional `pageId` (defaults to current page); `limit` caps " +
        "interactions (default 500) and sets `truncated`.",
      schema: GetPrototypeFlowInput,
      command: "GET_PROTOTYPE_FLOW" as CommandName,
    },
    {
      name: "export_interactions",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Export the wired prototype interactions of the given completed screens as a canonical, " +
        "framework-agnostic JSON spec for developer handoff. Input `{ screens: string[] (frame node IDs), pageId? }`. " +
        "Returns `{ schemaVersion, page, screens:[{id,name,interactions:[{source,trigger,actions}]}], " +
        "requestedScreens, missingScreens, unsupported, truncated }`. Each action is a typed entry " +
        "(navigate / scrollTo / openOverlay / swapOverlay / closeOverlay / back / openUrl / setVariable / " +
        "toggleVariable / changeVariant / conditional). This is a READ/handoff tool — developers (or you) " +
        "derive framework code (React, etc.) from the JSON; it does NOT generate framework or UI code.",
      schema: ExportInteractionsInput,
      handler: async (input, session) => {
        const { screens, pageId } = input as ExportInteractionsInput;
        const params = pageId ? { pageId, limit: 5000 } : { limit: 5000 };
        const flow = await session.sendCommand("GET_PROTOTYPE_FLOW" as CommandName, params);
        return buildInteractionSpec(flow as Parameters<typeof buildInteractionSpec>[0], screens);
      },
    },
    {
      name: "generate_interaction_code",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Generate framework code from the wired interactions of the given screens. Input " +
        "`{ screens: string[] (frame node IDs), target: \"react\" | \"react-native\" | \"swiftui\", pageId? }`. Returns " +
        "`{ schemaVersion, target, files: [{ path, content }], unsupported, missingScreens, truncated }`. " +
        "Emits the INTERACTION layer (react-router routes, a React Context variable store, per-screen " +
        "interaction hooks, transitions, README) — NOT screen UI; pair it with design→UI code. " +
        "Deterministic; built on the same spec as export_interactions.",
      schema: GenerateInteractionCodeInput,
      handler: async (input, session) => {
        const { screens, target, pageId } = input as GenerateInteractionCodeInput;
        const params = pageId ? { pageId, limit: 5000 } : { limit: 5000 };
        const flow = await session.sendCommand("GET_PROTOTYPE_FLOW" as CommandName, params);
        const spec = buildInteractionSpec(flow as Parameters<typeof buildInteractionSpec>[0], screens);
        const files = runEmitter(target, spec);
        return {
          schemaVersion: spec.schemaVersion,
          target,
          files,
          unsupported: spec.unsupported,
          missingScreens: spec.missingScreens,
          truncated: spec.truncated,
        };
      },
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
      name: "create_variable",
      description:
        "Find-or-create a Figma Variable. Creates one ONLY when the prototype needs a variable that does not " +
        "exist yet — if a variable of the same name already exists it is REUSED (reused:true), never duplicated. " +
        "Call list_variables first and prefer an existing variable. New variables go into a dedicated `forProto` " +
        "collection by default (override with `collection`). `type` (BOOLEAN/FLOAT/STRING/COLOR) is required; " +
        "`value` is optional (defaults to the type's neutral value; COLOR takes a hex string). After creating, " +
        "reference it by name in proto_set_variable / proto_toggle_variable / proto_conditional.",
      schema: CreateVariableInput,
      command: "CREATE_VARIABLE" as CommandName,
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
        "`from`/`to` are node IDs (e.g. \"1404:1947\"), NOT frame names — resolve names to IDs " +
        "with find_nodes or get_canvas_overview first. " +
        "Use when the WHOLE screen changes to the destination. For a modal/popup/dialog/toast/sheet " +
        "that appears ON TOP of the current screen ('떠/팝업/모달'), use proto_overlay (open) instead. " +
        "Accepts a `motion` preset name (e.g. \"M3_EMPHASIZED\") or a full TransitionInput. " +
        "Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED (a SMART_ANIMATE preset). " +
        "SMART_ANIMATE only morphs layers shared by name between the two frames; when they share none " +
        "it auto-degrades to the connection's `degradeTo` (DISSOLVE by default). For a spatial 'slides/pushes in' " +
        "feel between distinct screens, pass a directional TransitionInput (PUSH/MOVE_IN/MOVE_OUT) as `motion`. " +
        "Compiles to create_reactions internally. " +
        "If the user already names the nodes/screens, pass those names directly — you don't need " +
        "get_canvas_overview or find_nodes first (this tool resolves names, scoped by fromScreen when a name " +
        "repeats). Orient first only for abstract requests (e.g. 'every screen', 'the back button') or when a " +
        "name returns ambiguous/not-found.",
      schema: ProtoWireInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoWireInput;
        return recordedHandler(historyStore, "proto_wire", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoWire(parsedInput)),
        );
      },
    },
    {
      name: "proto_change_to",
      description:
        "이 도구는 오직 피그마의 프로토타입 인터랙션/애니메이션 생성·수정 목적으로만 사용합니다. " +
        "Switch a component INSTANCE to a sibling VARIANT on interaction (Figma's 'Change to'). " +
        "This is a ONE-SHOT switch to a SPECIFIC target variant (→ selected, → highlight, → on), NOT an " +
        "alternating flip — for tabs, segmented controls, and 'set this to its <state> state' changes driven " +
        "by variants of one component. KO cues: '선택 상태로', 'highlight 상태로 바꿔', 'variant 바꿔', '~상태로 바꿔'. " +
        "`from` = a component instance node ID (or a node inside one); `to` = the target variant node ID " +
        "(a COMPONENT inside the same component set, and NOT the instance's current variant) — both are node IDs, " +
        "NOT names; resolve names via find_nodes first. " +
        "Boundaries: a whole-screen change → proto_wire; a data value → proto_set_variable; an on/off that flips " +
        "BACK on every tap ('켜고 끄기', a repeating toggle) must be driven by a BOOLEAN variable → use " +
        "proto_toggle_variable (a single change_to only goes one direction, it cannot alternate). " +
        "Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED (SMART_ANIMATE morph between variants). " +
        "Compiles to create_reactions internally.",
      schema: ProtoChangeToInput,
      handler: async (input, session) => {
        const parsedInput = input as ProtoChangeToInput;
        return recordedHandler(historyStore, "proto_change_to", parsedInput, () =>
          session.sendCommand("CREATE_REACTIONS" as CommandName, compileProtoChangeTo(parsedInput)),
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
        "motion (including all M3/HIG presets) is silently rewritten to DISSOLVE while preserving duration + easing. " +
        "If the user already names the nodes/screens, pass those names directly — you don't need " +
        "get_canvas_overview or find_nodes first (this tool resolves names, scoped by fromScreen when a name " +
        "repeats). Orient first only for abstract requests (e.g. 'every screen', 'the back button') or when a " +
        "name returns ambiguous/not-found.",
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
        "Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED. Compiles to create_reactions internally. " +
        "If the user already names the nodes/screens, pass those names directly — you don't need " +
        "get_canvas_overview or find_nodes first (this tool resolves names, scoped by fromScreen when a name " +
        "repeats). Orient first only for abstract requests (e.g. 'every screen', 'the back button') or when a " +
        "name returns ambiguous/not-found.",
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
        "Choosing the source node: for an abstract request ('뒤로가기 달아줘/add back to each screen') FIRST look for a " +
        "visible back affordance in each frame — a small top-left icon, or a node whose name contains back/arrow/chevron/prev, " +
        "or a '<'/'‹' glyph — and wire THAT with ON_CLICK. Only use a frame-level ON_DRAG swipe-back when the request names a " +
        "gesture ('스와이프/밀어서 뒤로'). If the intent is abstract AND no back-affordance node exists, ASK the user " +
        "('백버튼이 안 보이는데 스와이프 제스처로 할까요?') rather than silently wiring a swipe — do not create a node (this tool only wires). " +
        "⚠️ If the source is on an OVERLAY (popup/modal/dialog/sheet shown on top of another screen), " +
        "'go back / 돌아가 / 뒤로' is AMBIGUOUS — it may mean dismiss the overlay to reveal the screen " +
        "underneath (= proto_overlay close) or pop the navigation history (= Back, which on an overlay " +
        "often lands on an unexpected earlier frame). Ask the user which they mean before wiring. " +
        "Defaults: trigger=ON_CLICK, motion=M3_EMPHASIZED. Compiles to create_reactions internally. " +
        "If the user already names the nodes/screens, pass those names directly — you don't need " +
        "get_canvas_overview or find_nodes first (this tool resolves names, scoped by fromScreen when a name " +
        "repeats). Orient first only for abstract requests (e.g. 'every screen', 'the back button') or when a " +
        "name returns ambiguous/not-found.",
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
        "event and the underlying reaction's transition defaults to INSTANT. Compiles to create_reactions internally. " +
        "If the user already names the source node, pass it directly — you don't need get_canvas_overview or " +
        "find_nodes first (this tool resolves names, scoped by fromScreen when a name repeats). Orient first only " +
        "for abstract requests or when a name returns ambiguous/not-found.",
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
        "Use to flip/switch a boolean ('토글', '켜고 끄기') with no named target value; to assign a specific value " +
        "(true/false/number/string/color) use proto_set_variable instead. " +
        "This is the right tool for a REPEATING on/off that flips back on every tap. If the on/off is a VISUAL " +
        "component built from variants and NOT backed by a boolean variable, a one-directional switch to a " +
        "specific state is proto_change_to instead; toggle_variable requires a BOOLEAN variable to flip. " +
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
        "Input `{ conditions: [{ from, if, then, else? }] }`. " +
        "`if` is a single comparison `{ variable, operator?, value }`, OR a one-level compound: " +
        "`{ all: [<comparison>, …] }` (AND — 모두 참일 때; cues: '그리고 / 이고 / 둘 다 / 모두') or " +
        "`{ any: [<comparison>, …] }` (OR — 하나라도 참일 때; cues: '또는 / 거나 / 하나라도'). " +
        "Each array needs ≥2 comparisons; `all` and `any` cannot be mixed or nested (one level only) — " +
        "for multi-way branching use separate reactions (Figma has no else-if). " +
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
