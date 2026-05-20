// Message envelope shared between MCP server, relay, and Figma plugin.

export type CommandName =
  | "GET_CANVAS_OVERVIEW"
  | "FIND_NODES"
  | "CREATE_REACTIONS"
  | "LIST_REACTIONS"
  | "CLEAR_REACTIONS";

export interface CommandRequest {
  id: string;            // uuid for request/response matching
  type: "command";
  command: CommandName;
  params: unknown;       // schema-validated upstream
}

export interface CommandResponse {
  id: string;
  type: "response";
  status: "ok" | "error";
  result?: unknown;
  error?: { code: string; message: string };
}

// Relay-level envelope: wraps CommandRequest/Response with channel info.
// This is what travels over the WebSocket.
export interface RelayMessage {
  id: string;
  type: "message";
  channel: string;
  message: CommandRequest | CommandResponse;
}

export interface JoinMessage {
  type: "join";
  channel: string;
  id?: string;
}

export type IncomingRelayMessage =
  | RelayMessage
  | JoinMessage
  | { type: "system"; message: unknown; channel?: string }
  | { type: "broadcast"; message: CommandRequest | CommandResponse; channel: string; sender: string }
  | { type: "error"; message: string };

// Tool output types (for type-checking handlers).
export interface FrameInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  isStartFrame: boolean;
}

export interface SelectionInfo {
  id: string;
  name: string;
  type: string;
  parentFrameId: string | null;
  hasExistingReactions: boolean;
}

export interface CanvasOverview {
  page: { id: string; name: string };
  frames: FrameInfo[];
  selection: SelectionInfo[];
}

export interface FoundNode {
  id: string;
  name: string;
  type: string;
  parentFrameId: string | null;
  path: string;
}

export type ReactionAction =
  | { type: "navigate"; targetFrameId: string }
  | { type: "scroll"; targetNodeId: string }
  | { type: "overlay"; targetFrameId: string }
  | { type: "close" }
  | { type: "back" }
  | { type: "url"; url: string; openInNewTab?: boolean }
  | { type: "swap_overlay"; targetFrameId: string };

export interface ReactionConnectionInput {
  sourceNodeId: string;
  trigger?: "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "AFTER_TIMEOUT";
  afterTimeoutSeconds?: number;
  transition?:
    | "INSTANT" | "DISSOLVE" | "SMART_ANIMATE"
    | {
        type: "DISSOLVE" | "SMART_ANIMATE" | "SCROLL_ANIMATE";
        duration?: number;
        easing?:
          // 11 named
          | "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT"
          | "EASE_IN_BACK" | "EASE_OUT_BACK" | "EASE_IN_AND_OUT_BACK"
          | "GENTLE" | "QUICK" | "BOUNCY" | "SLOW"
          // 2 custom flat
          | { type: "CUSTOM_CUBIC_BEZIER"; x1: number; y1: number; x2: number; y2: number }
          | { type: "CUSTOM_SPRING"; mass: number; stiffness: number; damping: number };
      };
  action: ReactionAction;
}

export interface ReactionConnectionResult {
  sourceNodeId: string;
  status: "success" | "error";
  error?: string;
  reactionIndex?: number;
  warning?: string;
}

export interface CreateReactionsResult {
  results: ReactionConnectionResult[];
  successCount: number;
  errorCount: number;
  warningCount: number;
}

export interface ReactionSummary {
  index: number;
  trigger: { type: string; timeout?: number };
  action: {
    type: string;
    navigation?: string;
    url?: string;
    openInNewTab?: boolean;
    destinationId?: string;
    destinationName?: string;
    transition?: {
      type: string;
      duration?: number;
      easing?: {
        type: string;
        easingFunctionCubicBezier?: { x1: number; y1: number; x2: number; y2: number };
        easingFunctionSpring?: { mass: number; stiffness: number; damping: number };
      };
    };
  };
}
