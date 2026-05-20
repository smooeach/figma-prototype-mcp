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

export interface NavigateConnectionInput {
  sourceNodeId: string;
  targetFrameId: string;
  trigger?: "ON_CLICK" | "ON_HOVER" | "ON_PRESS";
  transition?: "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
}

export interface NavigateConnectionResult {
  sourceNodeId: string;
  status: "success" | "error";
  error?: string;
  reactionIndex?: number;
}

export interface ReactionSummary {
  index: number;
  trigger: { type: string };
  action: {
    type: string;
    destinationId?: string;
    destinationName?: string;
    transition?: { type: string; duration?: number };
  };
}
