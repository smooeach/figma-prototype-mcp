// Message envelope shared between MCP server, relay, and Figma plugin.

import type {
  TriggerName,
  TriggerNoParamType,
  MouseClickType,
  MouseHoverType,
  KeyboardDevice,
  TransitionName,
  SimpleTransitionType,
  DirectionalTransitionType,
  NamedEasingName,
  Direction,
  ComparisonOperator,
} from "../shared/wire-vocabulary.js";

export type CommandName =
  | "GET_CANVAS_OVERVIEW"
  | "FIND_NODES"
  | "CREATE_REACTIONS"
  | "LIST_REACTIONS"
  | "CLEAR_REACTIONS"
  | "SET_FRAME_SCROLL";

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
  | { type: "navigate"; targetFrameId: string; resetScrollPosition?: boolean }
  | { type: "scroll"; targetNodeId: string; resetScrollPosition?: boolean }
  | { type: "overlay"; targetFrameId: string; resetScrollPosition?: boolean }
  | { type: "close" }
  | { type: "back" }
  | { type: "url"; url: string; openInNewTab?: boolean }
  | { type: "swap_overlay"; targetFrameId: string; resetScrollPosition?: boolean }
  | { type: "set_variable"; variable: string; value: boolean | number | string }
  | { type: "toggle_variable"; variable: string }
  | {
      type: "conditional";
      condition: { variable: string; operator: ComparisonOperator; value: boolean | number | string };
      then: Exclude<ReactionAction, { type: "conditional" } | { type: "toggle_variable" }>[];
      else?: Exclude<ReactionAction, { type: "conditional" } | { type: "toggle_variable" }>[];
    };

export interface ReactionConnectionInput {
  sourceNodeId: string;
  trigger?:
    | TriggerName
    | { type: TriggerNoParamType }
    | { type: "AFTER_TIMEOUT"; timeout: number }
    | { type: MouseClickType; delay?: number }
    | { type: MouseHoverType; delay?: number }
    | { type: "ON_KEY_DOWN";
        device: KeyboardDevice;
        keyCodes: number[]; }
    | { type: "ON_MEDIA_HIT"; mediaHitTime: number };
  afterTimeoutSeconds?: number;
  transition?:
    | TransitionName
    | {
        type: SimpleTransitionType;
        duration?: number;
        easing?:
          // 11 named
          | NamedEasingName
          // 2 custom flat
          | { type: "CUSTOM_CUBIC_BEZIER"; x1: number; y1: number; x2: number; y2: number }
          | { type: "CUSTOM_SPRING"; mass: number; stiffness: number; damping: number };
      }
    | {
        type: DirectionalTransitionType;
        direction: Direction;
        matchLayers?: boolean;
        duration?: number;
        easing?:
          | NamedEasingName
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
  trigger: {
    type: string;
    timeout?: number;
    delay?: number;
    device?: string;
    keyCodes?: number[];
    mediaHitTime?: number;
  };
  action: {
    type: string;
    navigation?: string;
    url?: string;
    openInNewTab?: boolean;
    destinationId?: string;
    destinationName?: string;
    transition?: {
      type: string;
      direction?: string;
      matchLayers?: boolean;
      duration?: number;
      easing?: {
        type: string;
        easingFunctionCubicBezier?: { x1: number; y1: number; x2: number; y2: number };
        easingFunctionSpring?: { mass: number; stiffness: number; damping: number };
      };
    };
  };
}
