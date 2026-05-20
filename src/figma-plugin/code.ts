// Runs in the Figma plugin sandbox (main thread). Receives commands from ui.html
// over postMessage, dispatches to handlers, and returns responses via postMessage.

import { buildNavigateReaction, buildScrollReaction } from "./reaction-builder.js";
import { CommandQueue } from "./command-queue.js";

figma.showUI(__html__, { width: 320, height: 220 });

const commandQueue = new CommandQueue();

type Command =
  | { type: "GET_CANVAS_OVERVIEW"; params: { pageId?: string } }
  | { type: "FIND_NODES"; params: { query: string; nodeTypes?: string[]; scope?: "page" | "document"; limit?: number } }
  | {
      type: "CREATE_REACTIONS";
      params: {
        connections: Array<{
          sourceNodeId: string;
          trigger: "ON_CLICK" | "ON_HOVER" | "ON_PRESS";
          transition: "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
          action:
            | { type: "navigate"; targetFrameId: string }
            | { type: "scroll"; targetNodeId: string };
        }>;
        replaceExisting: boolean;
      };
    }
  | { type: "LIST_REACTIONS"; params: { nodeId: string } }
  | { type: "CLEAR_REACTIONS"; params: { nodeIds: string[]; indices?: number[] } };

figma.ui.onmessage = (msg: any) => {
  if (msg?.type !== "command" || !msg.envelope) return;
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
      (cur as any).overflowDirection &&
      (cur as any).overflowDirection !== "NONE"
    ) {
      return cur;
    }
    cur = (cur as any).parent ?? null;
  }
  return null;
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
    trigger: "ON_CLICK" | "ON_HOVER" | "ON_PRESS";
    transition: "INSTANT" | "DISSOLVE" | "SMART_ANIMATE";
    action:
      | { type: "navigate"; targetFrameId: string }
      | { type: "scroll"; targetNodeId: string };
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

      let newReaction;
      let warning: string | undefined;

      if (conn.action.type === "navigate") {
        const target = figma.getNodeById(conn.action.targetFrameId);
        if (!target) throw new Error(`Target frame not found: ${conn.action.targetFrameId}`);
        if (target.type !== "FRAME") {
          throw new Error(`Target must be a frame: ${conn.action.targetFrameId} (got ${target.type})`);
        }
        newReaction = buildNavigateReaction({
          sourceNodeId: conn.sourceNodeId,
          targetFrameId: conn.action.targetFrameId,
          trigger: conn.trigger,
          transition: conn.transition,
        });
      } else {
        const target = figma.getNodeById(conn.action.targetNodeId);
        if (!target) throw new Error(`Scroll target node not found: ${conn.action.targetNodeId}`);
        const scrollable = findScrollableAncestor(target);
        if (!scrollable) {
          warning = `Scroll target ${conn.action.targetNodeId} (${target.name}) has no scrollable ancestor frame; the prototype scroll will not animate at runtime`;
        }
        newReaction = buildScrollReaction({
          sourceNodeId: conn.sourceNodeId,
          targetNodeId: conn.action.targetNodeId,
          trigger: conn.trigger,
          transition: conn.transition,
        });
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
        trigger: { type: r.trigger?.type ?? "UNKNOWN" },
        action: {
          type: action.type ?? "UNKNOWN",
          destinationId: destId,
          destinationName: destNode?.name,
          transition: action.transition,
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
