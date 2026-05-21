// Runs in the Figma plugin sandbox (main thread). Receives commands from ui.html
// over postMessage, dispatches to handlers, and returns responses via postMessage.

import {
  buildNavigateReaction,
  buildScrollReaction,
  buildOverlayReaction,
  buildCloseReaction,
  buildBackReaction,
  buildUrlReaction,
  buildSwapOverlayReaction,
  buildTrigger,
  type BuiltReaction,
  type BuiltAction,
  type TriggerInput,
  type TransitionInput,
} from "./reaction-builder.js";
import { CommandQueue } from "./command-queue.js";

figma.showUI(__html__, { width: 320, height: 220 });

const commandQueue = new CommandQueue();

type NonConditionalActionShape =
  | { type: "navigate"; targetFrameId: string; resetScrollPosition?: boolean }
  | { type: "scroll"; targetNodeId: string; resetScrollPosition?: boolean }
  | { type: "overlay"; targetFrameId: string; resetScrollPosition?: boolean }
  | { type: "close" }
  | { type: "back" }
  | { type: "url"; url: string; openInNewTab?: boolean }
  | { type: "swap_overlay"; targetFrameId: string; resetScrollPosition?: boolean };

type Command =
  | { type: "GET_CANVAS_OVERVIEW"; params: { pageId?: string } }
  | { type: "FIND_NODES"; params: { query: string; nodeTypes?: string[]; scope?: "page" | "document"; limit?: number } }
  | {
      type: "CREATE_REACTIONS";
      params: {
        connections: Array<{
          sourceNodeId: string;
          trigger:
            | "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "AFTER_TIMEOUT"
            | { type: "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "ON_DRAG" | "ON_MEDIA_END" }
            | { type: "AFTER_TIMEOUT"; timeout: number }
            | { type: "MOUSE_UP" | "MOUSE_DOWN"; delay?: number }
            | { type: "MOUSE_ENTER" | "MOUSE_LEAVE"; delay?: number }
            | { type: "ON_KEY_DOWN";
                device: "KEYBOARD" | "XBOX_ONE" | "PS4" | "SWITCH_PRO" | "UNKNOWN_CONTROLLER";
                keyCodes: number[];
              }
            | { type: "ON_MEDIA_HIT"; mediaHitTime: number };
          afterTimeoutSeconds?: number;
          transition:
            | "INSTANT" | "DISSOLVE" | "SMART_ANIMATE"
            | {
                type: "DISSOLVE" | "SMART_ANIMATE" | "SCROLL_ANIMATE";
                duration?: number;
                easing?:
                  | "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT"
                  | "EASE_IN_BACK" | "EASE_OUT_BACK" | "EASE_IN_AND_OUT_BACK"
                  | "GENTLE" | "QUICK" | "BOUNCY" | "SLOW"
                  | { type: "CUSTOM_CUBIC_BEZIER"; x1: number; y1: number; x2: number; y2: number }
                  | { type: "CUSTOM_SPRING"; mass: number; stiffness: number; damping: number };
              }
            | {
                type: "MOVE_IN" | "MOVE_OUT" | "PUSH" | "SLIDE_IN" | "SLIDE_OUT";
                direction: "LEFT" | "RIGHT" | "TOP" | "BOTTOM";
                matchLayers?: boolean;
                duration?: number;
                easing?:
                  | "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT"
                  | "EASE_IN_BACK" | "EASE_OUT_BACK" | "EASE_IN_AND_OUT_BACK"
                  | "GENTLE" | "QUICK" | "BOUNCY" | "SLOW"
                  | { type: "CUSTOM_CUBIC_BEZIER"; x1: number; y1: number; x2: number; y2: number }
                  | { type: "CUSTOM_SPRING"; mass: number; stiffness: number; damping: number };
              };
          action:
            | { type: "navigate"; targetFrameId: string; resetScrollPosition?: boolean }
            | { type: "scroll"; targetNodeId: string; resetScrollPosition?: boolean }
            | { type: "overlay"; targetFrameId: string; resetScrollPosition?: boolean }
            | { type: "close" }
            | { type: "back" }
            | { type: "url"; url: string; openInNewTab?: boolean }
            | { type: "swap_overlay"; targetFrameId: string; resetScrollPosition?: boolean }
            | {
                type: "conditional";
                condition: { variable: string; operator: "==" | "!=" | "<" | "<=" | ">" | ">="; value: boolean | number | string };
                then: NonConditionalActionShape[];
                else?: NonConditionalActionShape[];
              };
        }>;
        replaceExisting: boolean;
      };
    }
  | { type: "LIST_REACTIONS"; params: { nodeId: string } }
  | { type: "CLEAR_REACTIONS"; params: { nodeIds: string[]; indices?: number[] } }
  | {
      type: "SET_FRAME_SCROLL";
      params: {
        frames: Array<{
          frameId: string;
          direction?: "NONE" | "HORIZONTAL" | "VERTICAL" | "BOTH";
          fixedChildren?: number;
        }>;
      };
    };

figma.ui.onmessage = (msg: any) => {
  if (msg?.type === "load-channel") {
    figma.clientStorage.getAsync("channel").then((value) => {
      figma.ui.postMessage({
        type: "channel-loaded",
        channel: typeof value === "string" && value.length > 0 ? value : null,
      });
    });
    return;
  }

  if (msg?.type === "save-channel" && typeof msg.channel === "string" && msg.channel.length > 0) {
    figma.clientStorage.setAsync("channel", msg.channel).catch(() => {
      // Storage failures are non-critical; user can re-type next session.
    });
    return;
  }

  if (msg?.type === "command" && msg.envelope) {
    const envelope = msg.envelope as { id: string; command: Command["type"]; params: any };
    // Serialise commands: Figma's async APIs (loadAllPagesAsync, setReactionsAsync)
    // can deadlock when invoked concurrently from overlapping message handlers.
    void commandQueue.enqueue(async () => {
      const response = await dispatch(envelope.command, envelope.params);
      figma.ui.postMessage({
        type: "response",
        envelope: { id: envelope.id, type: "response", ...response },
      });
    });
  }
};

async function dispatch(command: Command["type"], params: any): Promise<
  { status: "ok"; result: unknown } | { status: "error"; error: { code: string; message: string } }
> {
  try {
    switch (command) {
      case "GET_CANVAS_OVERVIEW": return { status: "ok", result: await handleGetCanvasOverview(params) };
      case "FIND_NODES":          return { status: "ok", result: await handleFindNodes(params) };
      case "CREATE_REACTIONS": return { status: "ok", result: await handleCreateReactions(params) };
      case "LIST_REACTIONS":      return { status: "ok", result: await handleListReactions(params) };
      case "CLEAR_REACTIONS":     return { status: "ok", result: await handleClearReactions(params) };
      case "SET_FRAME_SCROLL":    return { status: "ok", result: await handleSetFrameScroll(params) };
      default: return { status: "error", error: { code: "UNKNOWN_COMMAND", message: `Unknown command: ${command}` } };
    }
  } catch (err: any) {
    return { status: "error", error: { code: "PLUGIN_EXCEPTION", message: err?.message ?? String(err) } };
  }
}

async function loadPage(pageId?: string): Promise<PageNode> {
  if (!pageId) {
    await figma.loadAllPagesAsync();
    return figma.currentPage;
  }
  await figma.loadAllPagesAsync();
  const page = figma.getNodeById(pageId);
  if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${pageId}`);
  return page as PageNode;
}

function findEnclosingFrameId(node: SceneNode | BaseNode): string | null {
  let cur: BaseNode | null = node.parent ?? null;
  while (cur) {
    if (cur.type === "FRAME") return cur.id;
    cur = (cur as any).parent ?? null;
  }
  return null;
}

function hasReactions(node: BaseNode): boolean {
  return "reactions" in node && Array.isArray((node as any).reactions) && (node as any).reactions.length > 0;
}

function findScrollableAncestor(node: BaseNode): BaseNode | null {
  let cur: BaseNode | null = node.parent ?? null;
  while (cur) {
    if (
      "overflowDirection" in cur &&
      (cur as any).overflowDirection !== "NONE"
    ) {
      return cur;
    }
    cur = (cur as any).parent ?? null;
  }
  return null;
}

/**
 * Build a single BuiltAction from one of the 7 non-conditional action shapes.
 * Validates target nodes and returns an optional warning (currently only the
 * scroll-action no-scrollable-ancestor case).
 *
 * Throws if a target node is missing or the wrong type — caller handles the
 * try/catch.
 */
function buildNonConditionalAction(
  action: NonConditionalActionShape,
  trigger: TriggerInput,
  afterTimeoutSeconds: number | undefined,
  transition: TransitionInput,
): { built: BuiltAction; warning?: string } {
  if (action.type === "navigate") {
    const target = figma.getNodeById(action.targetFrameId);
    if (!target) throw new Error(`Target frame not found: ${action.targetFrameId}`);
    if (target.type !== "FRAME") {
      throw new Error(`Target must be a frame: ${action.targetFrameId} (got ${target.type})`);
    }
    const reaction = buildNavigateReaction({
      targetFrameId: action.targetFrameId,
      trigger, afterTimeoutSeconds, transition,
      resetScrollPosition: action.resetScrollPosition,
    });
    return { built: reaction.actions[0]! };
  }
  if (action.type === "scroll") {
    const target = figma.getNodeById(action.targetNodeId);
    if (!target) throw new Error(`Scroll target node not found: ${action.targetNodeId}`);
    const scrollable = findScrollableAncestor(target);
    let warning: string | undefined;
    if (!scrollable) {
      warning = `Scroll target ${action.targetNodeId} (${target.name}) has no scrollable ancestor frame; the prototype scroll will not animate at runtime`;
    }
    const reaction = buildScrollReaction({
      targetNodeId: action.targetNodeId,
      trigger, afterTimeoutSeconds, transition,
      resetScrollPosition: action.resetScrollPosition,
    });
    return { built: reaction.actions[0]!, warning };
  }
  if (action.type === "overlay") {
    const target = figma.getNodeById(action.targetFrameId);
    if (!target) throw new Error(`Overlay target frame not found: ${action.targetFrameId}`);
    if (target.type !== "FRAME") {
      throw new Error(`Overlay target must be a frame: ${action.targetFrameId} (got ${target.type})`);
    }
    const reaction = buildOverlayReaction({
      targetFrameId: action.targetFrameId,
      trigger, afterTimeoutSeconds, transition,
      resetScrollPosition: action.resetScrollPosition,
    });
    return { built: reaction.actions[0]! };
  }
  if (action.type === "close") {
    const reaction = buildCloseReaction({ trigger, afterTimeoutSeconds });
    return { built: reaction.actions[0]! };
  }
  if (action.type === "back") {
    const reaction = buildBackReaction({ trigger, afterTimeoutSeconds });
    return { built: reaction.actions[0]! };
  }
  if (action.type === "url") {
    const reaction = buildUrlReaction({
      trigger, afterTimeoutSeconds,
      url: action.url, openInNewTab: action.openInNewTab,
    });
    return { built: reaction.actions[0]! };
  }
  // swap_overlay
  const target = figma.getNodeById(action.targetFrameId);
  if (!target) throw new Error(`Swap overlay target frame not found: ${action.targetFrameId}`);
  if (target.type !== "FRAME") {
    throw new Error(`Swap overlay target must be a frame: ${action.targetFrameId} (got ${target.type})`);
  }
  const reaction = buildSwapOverlayReaction({
    trigger, afterTimeoutSeconds, transition,
    targetFrameId: action.targetFrameId,
    resetScrollPosition: action.resetScrollPosition,
  });
  return { built: reaction.actions[0]! };
}

async function handleGetCanvasOverview(params: { pageId?: string }) {
  const page = await loadPage(params.pageId);
  const frames = page.children
    .filter((n) => n.type === "FRAME")
    .map((f) => ({
      id: f.id,
      name: f.name,
      width: (f as FrameNode).width,
      height: (f as FrameNode).height,
      isStartFrame: page.flowStartingPoints?.some((p) => p.nodeId === f.id) ?? false,
    }));

  const selection = figma.currentPage.selection.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    parentFrameId: findEnclosingFrameId(n),
    hasExistingReactions: hasReactions(n),
  }));

  return { page: { id: page.id, name: page.name }, frames, selection };
}

async function handleFindNodes(params: { query: string; nodeTypes?: string[]; scope?: "page" | "document"; limit?: number }) {
  const scope = params.scope ?? "page";
  const limit = params.limit ?? 50;
  const q = params.query.toLowerCase();

  let root: BaseNode & ChildrenMixin;
  if (scope === "document") {
    await figma.loadAllPagesAsync();
    root = figma.root as unknown as BaseNode & ChildrenMixin;
  } else {
    root = figma.currentPage;
  }

  const matches: BaseNode[] = root.findAll((n) => {
    if (!n.name.toLowerCase().includes(q)) return false;
    if (params.nodeTypes && params.nodeTypes.length && !params.nodeTypes.includes(n.type)) return false;
    return true;
  });

  const truncated = matches.length > limit;
  const sliced = matches.slice(0, limit);

  return {
    nodes: sliced.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parentFrameId: findEnclosingFrameId(n),
      path: pathOf(n),
    })),
    truncated,
  };
}

function pathOf(node: BaseNode): string {
  const parts: string[] = [];
  let cur: BaseNode | null = node;
  while (cur && cur.type !== "DOCUMENT") {
    parts.unshift(cur.name);
    cur = (cur as any).parent ?? null;
  }
  return parts.join(" > ");
}

async function handleCreateReactions(params: {
  connections: Array<{
    sourceNodeId: string;
    trigger:
      | "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "AFTER_TIMEOUT"
      | { type: "ON_CLICK" | "ON_HOVER" | "ON_PRESS" | "ON_DRAG" | "ON_MEDIA_END" }
      | { type: "AFTER_TIMEOUT"; timeout: number }
      | { type: "MOUSE_UP" | "MOUSE_DOWN"; delay?: number }
      | { type: "MOUSE_ENTER" | "MOUSE_LEAVE"; delay?: number }
      | { type: "ON_KEY_DOWN";
          device: "KEYBOARD" | "XBOX_ONE" | "PS4" | "SWITCH_PRO" | "UNKNOWN_CONTROLLER";
          keyCodes: number[];
        }
      | { type: "ON_MEDIA_HIT"; mediaHitTime: number };
    afterTimeoutSeconds?: number;
    transition:
      | "INSTANT" | "DISSOLVE" | "SMART_ANIMATE"
      | {
          type: "DISSOLVE" | "SMART_ANIMATE" | "SCROLL_ANIMATE";
          duration?: number;
          easing?:
            | "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT"
            | "EASE_IN_BACK" | "EASE_OUT_BACK" | "EASE_IN_AND_OUT_BACK"
            | "GENTLE" | "QUICK" | "BOUNCY" | "SLOW"
            | { type: "CUSTOM_CUBIC_BEZIER"; x1: number; y1: number; x2: number; y2: number }
            | { type: "CUSTOM_SPRING"; mass: number; stiffness: number; damping: number };
        }
      | {
          type: "MOVE_IN" | "MOVE_OUT" | "PUSH" | "SLIDE_IN" | "SLIDE_OUT";
          direction: "LEFT" | "RIGHT" | "TOP" | "BOTTOM";
          matchLayers?: boolean;
          duration?: number;
          easing?:
            | "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT"
            | "EASE_IN_BACK" | "EASE_OUT_BACK" | "EASE_IN_AND_OUT_BACK"
            | "GENTLE" | "QUICK" | "BOUNCY" | "SLOW"
            | { type: "CUSTOM_CUBIC_BEZIER"; x1: number; y1: number; x2: number; y2: number }
            | { type: "CUSTOM_SPRING"; mass: number; stiffness: number; damping: number };
        };
    action:
      | { type: "navigate"; targetFrameId: string; resetScrollPosition?: boolean }
      | { type: "scroll"; targetNodeId: string; resetScrollPosition?: boolean }
      | { type: "overlay"; targetFrameId: string; resetScrollPosition?: boolean }
      | { type: "close" }
      | { type: "back" }
      | { type: "url"; url: string; openInNewTab?: boolean }
      | { type: "swap_overlay"; targetFrameId: string; resetScrollPosition?: boolean }
      | {
          type: "conditional";
          condition: { variable: string; operator: "==" | "!=" | "<" | "<=" | ">" | ">="; value: boolean | number | string };
          then: NonConditionalActionShape[];
          else?: NonConditionalActionShape[];
        };
  }>;
  replaceExisting: boolean;
}) {
  await figma.loadAllPagesAsync();
  const results: Array<{
    sourceNodeId: string;
    status: "success" | "error";
    error?: string;
    reactionIndex?: number;
    warning?: string;
  }> = [];
  let successCount = 0;
  let errorCount = 0;
  let warningCount = 0;

  for (const conn of params.connections) {
    try {
      const source = figma.getNodeById(conn.sourceNodeId);
      if (!source) throw new Error(`Source node not found: ${conn.sourceNodeId}`);
      if (!("setReactionsAsync" in source) || typeof (source as any).setReactionsAsync !== "function") {
        throw new Error(`Node cannot have reactions: ${source.name} (type: ${source.type})`);
      }

      let newReaction: BuiltReaction;
      let warning: string | undefined;

      if (conn.action.type === "conditional") {
        // Conditional handler arrives in Task 6
        throw new Error("Conditional action handler not yet implemented (v1.16 Task 6)");
      } else {
        const { built, warning: branchWarning } = buildNonConditionalAction(
          conn.action,
          conn.trigger,
          conn.afterTimeoutSeconds,
          conn.transition,
        );
        if (branchWarning) warning = branchWarning;
        newReaction = {
          trigger: buildTrigger(conn.trigger, conn.afterTimeoutSeconds),
          actions: [built],
        };
      }

      const existing = ("reactions" in source ? (source as any).reactions : []) as any[];
      const next = params.replaceExisting ? [newReaction] : [...existing, newReaction];
      await (source as any).setReactionsAsync(next);

      const result: {
        sourceNodeId: string;
        status: "success";
        reactionIndex: number;
        warning?: string;
      } = {
        sourceNodeId: conn.sourceNodeId,
        status: "success",
        reactionIndex: next.length - 1,
      };
      if (warning) {
        result.warning = warning;
        warningCount++;
      }
      results.push(result);
      successCount++;
    } catch (err: any) {
      results.push({
        sourceNodeId: conn.sourceNodeId,
        status: "error",
        error: err?.message ?? String(err),
      });
      errorCount++;
    }
  }

  return { results, successCount, errorCount, warningCount };
}

async function handleListReactions(params: { nodeId: string }) {
  await figma.loadAllPagesAsync();
  const node = figma.getNodeById(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  if (!("reactions" in node)) throw new Error(`Node has no reactions field: ${node.name}`);
  const reactions = ((node as any).reactions ?? []) as any[];
  return {
    nodeId: node.id,
    nodeName: node.name,
    reactions: reactions.map((r, i) => {
      const action = r.actions?.[0] ?? r.action ?? {};
      const destId = action.destinationId;
      const destNode = destId ? figma.getNodeById(destId) : null;
      return {
        index: i,
        trigger: r.trigger ?? { type: "UNKNOWN" },
        action: {
          type: action.type ?? "UNKNOWN",
          navigation: action.navigation,
          url: action.url,
          openInNewTab: action.openInNewTab,
          destinationId: destId,
          destinationName: destNode?.name,
          transition: action.transition,
          resetScrollPosition: action.resetScrollPosition,
        },
      };
    }),
  };
}

async function handleClearReactions(params: { nodeIds: string[]; indices?: number[] }) {
  await figma.loadAllPagesAsync();
  const results = [];

  for (const nodeId of params.nodeIds) {
    try {
      const node = figma.getNodeById(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (!("setReactionsAsync" in node)) throw new Error(`Node cannot have reactions: ${node.name}`);

      const existing = ((node as any).reactions ?? []) as any[];
      let next: any[];
      let removedCount: number;

      if (params.indices && params.indices.length > 0) {
        const toRemove = new Set(params.indices);
        next = existing.filter((_, i) => !toRemove.has(i));
        removedCount = existing.length - next.length;
      } else {
        next = [];
        removedCount = existing.length;
      }

      await (node as any).setReactionsAsync(next);
      results.push({ nodeId, removedCount, status: "success" });
    } catch (err: any) {
      results.push({ nodeId, removedCount: 0, status: "error", error: err?.message ?? String(err) });
    }
  }

  return { results };
}

async function handleSetFrameScroll(params: {
  frames: Array<{
    frameId: string;
    direction?: "NONE" | "HORIZONTAL" | "VERTICAL" | "BOTH";
    fixedChildren?: number;
  }>;
}) {
  await figma.loadAllPagesAsync();
  const results: Array<{
    frameId: string;
    status: "success" | "error";
    applied?: string[];
    error?: string;
  }> = [];
  let successCount = 0;
  let errorCount = 0;
  for (const { frameId, direction, fixedChildren } of params.frames) {
    // Lifted out so a mid-loop throw (e.g. OOR fixedChildren) still surfaces which fields
    // were already mutated before the throw — caller-visible partial state.
    const applied: string[] = [];
    try {
      const node = figma.getNodeById(frameId);
      if (!node) throw new Error(`Frame not found: ${frameId}`);
      if (node.type !== "FRAME") {
        throw new Error(`Node is not a FRAME: ${node.name} (type: ${node.type})`);
      }
      if (direction !== undefined) {
        (node as FrameNode).overflowDirection = direction;
        applied.push("direction");
      }
      if (fixedChildren !== undefined) {
        (node as FrameNode).numberOfFixedChildren = fixedChildren;
        applied.push("fixedChildren");
      }
      results.push({ frameId, status: "success", applied });
      successCount++;
    } catch (e: any) {
      results.push({ frameId, status: "error", applied, error: e?.message ?? String(e) });
      errorCount++;
    }
  }
  return { results, successCount, errorCount };
}
