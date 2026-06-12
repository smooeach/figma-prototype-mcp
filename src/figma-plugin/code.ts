// Runs in the Figma plugin sandbox (main thread). Receives commands from ui.html
// over postMessage, dispatches to handlers, and returns responses via postMessage.

import {
  buildNavigateReaction,
  buildChangeToReaction,
  changeToCurrentVariantError,
  buildScrollReaction,
  buildOverlayReaction,
  buildCloseReaction,
  buildBackReaction,
  buildUrlReaction,
  buildSwapOverlayReaction,
  buildConditionalReaction,
  buildTrigger,
  type BuiltReaction,
  type BuiltAction,
  type TriggerInput,
  type TransitionInput,
} from "./reaction-builder.js";
import { CommandQueue } from "./command-queue.js";
import { validateVariableLiteralCompat } from "./variable-literal.js";
import {
  filterVariables,
  formatVariableNotFoundError,
  selectVariableMatch,
  formatAmbiguousVariableError,
  type LocalVarDescriptor,
  type LibraryVarDescriptor,
} from "./variable-catalog.js";
import { findEnclosingFrameId, hasReactions, findScrollableAncestor, pathOf } from "./node-tree.js";
import { encodeActionForListEcho, type EchoResolvers } from "./action-echo.js";
import { resolveNavigateTransition } from "./motion-degrade.js";
import {
  buildConditionExpression,
  buildCompoundConditionExpression,
  type ComparisonOperator,
} from "./condition-codec.js";
import { assembleFlowGraph, type RawInteraction } from "./flow-graph.js";
import type {
  GetCanvasOverviewInput,
  GetPrototypeFlowInput,
  FindNodesInput,
  ListVariablesInput,
  CreateReactionsInput,
  ListReactionsInput,
  ClearReactionsInput,
  SetFrameScrollInput,
  NonConditionalActionInput,
} from "../mcp-server/tools.js";

figma.showUI(__html__, { width: 320, height: 220 });

const commandQueue = new CommandQueue();

type Command =
  | { type: "GET_CANVAS_OVERVIEW"; params: GetCanvasOverviewInput }
  | { type: "GET_PROTOTYPE_FLOW"; params: GetPrototypeFlowInput }
  | { type: "FIND_NODES"; params: FindNodesInput }
  | { type: "LIST_VARIABLES"; params: ListVariablesInput }
  | { type: "CREATE_REACTIONS"; params: CreateReactionsInput }
  | { type: "LIST_REACTIONS"; params: ListReactionsInput }
  | { type: "CLEAR_REACTIONS"; params: ClearReactionsInput }
  | { type: "SET_FRAME_SCROLL"; params: SetFrameScrollInput };

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
      case "GET_PROTOTYPE_FLOW":   return { status: "ok", result: await handleGetPrototypeFlow(params) };
      case "FIND_NODES":          return { status: "ok", result: await handleFindNodes(params) };
      case "LIST_VARIABLES":      return { status: "ok", result: await handleListVariables(params) };
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
  const page = await figma.getNodeByIdAsync(pageId);
  if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${pageId}`);
  return page as PageNode;
}

/**
 * Build a single BuiltAction from one of the non-conditional action shapes.
 * Validates target nodes and returns an optional warning (currently only the
 * scroll-action no-scrollable-ancestor case).
 *
 * Throws if a target node is missing or the wrong type — caller handles the
 * try/catch.
 */
async function buildNonConditionalAction(
  action: NonConditionalActionInput,
  trigger: TriggerInput,
  afterTimeoutSeconds: number | undefined,
  transition: TransitionInput,
  sourceNode: BaseNode,
  degradeTo: "DISSOLVE" | "INSTANT" | undefined,
): Promise<{ built: BuiltAction; warning?: string }> {
  if (action.type === "navigate") {
    const target = await figma.getNodeByIdAsync(action.targetFrameId);
    if (!target) throw new Error(`Target frame not found: ${action.targetFrameId}`);
    if (target.type !== "FRAME") {
      throw new Error(`Target must be a frame: ${action.targetFrameId} (got ${target.type})`);
    }
    const { transition: effectiveTransition, warning } = resolveNavigateTransition({
      source: sourceNode,
      destFrame: target,
      transition,
      degradeTo,
    });
    const reaction = buildNavigateReaction({
      targetFrameId: action.targetFrameId,
      trigger, afterTimeoutSeconds, transition: effectiveTransition,
      resetScrollPosition: action.resetScrollPosition,
    });
    return { built: reaction.actions[0]!, warning };
  }
  if (action.type === "scroll") {
    const target = await figma.getNodeByIdAsync(action.targetNodeId);
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
    const target = await figma.getNodeByIdAsync(action.targetFrameId);
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
  if (action.type === "set_variable") {
    const { variable, warning } = await resolveVariableByName(action.variable, action.collection);
    const variableValue = buildSetVariableData(variable, action.value);
    const built: BuiltAction = {
      type: "SET_VARIABLE",
      variableId: variable.id,
      variableValue,
    };
    return { built, warning };
  }
  if (action.type === "swap_overlay") {
    const target = await figma.getNodeByIdAsync(action.targetFrameId);
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
  if (action.type === "change_to") {
    const target = await figma.getNodeByIdAsync(action.targetVariantId);
    if (!target) throw new Error(`Change-to target not found: ${action.targetVariantId}`);
    if (target.type !== "COMPONENT") {
      throw new Error(`Change-to target must be a component variant: ${action.targetVariantId} (got ${target.type})`);
    }
    // Figma applies CHANGE_TO to the nearest INSTANCE ancestor of the source node.
    let cur: BaseNode | null = sourceNode;
    let instance: InstanceNode | null = null;
    while (cur) {
      if (cur.type === "INSTANCE") { instance = cur as InstanceNode; break; }
      cur = cur.parent;
    }
    const hasInstance = instance !== null;
    // Figma rejects CHANGE_TO to the instance's own current variant with an opaque
    // runtime error (live probe 2026-06-12); catch it up front with a clear message.
    if (instance) {
      const mainComponent = await instance.getMainComponentAsync();
      const sameVariantError = changeToCurrentVariantError(
        mainComponent?.id ?? null,
        action.targetVariantId,
      );
      if (sameVariantError) throw new Error(sameVariantError);
    }
    const reaction = buildChangeToReaction({
      targetVariantId: action.targetVariantId,
      trigger, afterTimeoutSeconds, transition,
    });
    const warning = hasInstance
      ? undefined
      : `Change-to source ${sourceNode.id} is not (and is not inside) a component instance; the reaction will not animate at runtime`;
    return { built: reaction.actions[0]!, warning };
  }
  throw new Error(`Unhandled action type: ${(action as { type: string }).type}`);
}

async function resolveVariableByName(
  name: string,
  collection?: string,
): Promise<{
  variable: Variable;
  warning?: string;
}> {
  // Step 1: local. Build descriptors so collection-aware selection can run.
  // This fans out one getVariableCollectionByIdAsync per local variable on every
  // resolve. Acceptable at the current call frequency; if profiling ever shows
  // contention (many reaction writes × many variables), cache collection names
  // by id for the duration of a create_reactions call.
  const all = await figma.variables.getLocalVariablesAsync();
  const localDescriptors: Array<LocalVarDescriptor & { ref: Variable }> = await Promise.all(
    all.map(async (v) => {
      const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      return {
        name: v.name,
        id: v.id,
        resolvedType: v.resolvedType,
        collection: col?.name ?? "",
        ref: v,
      };
    }),
  );
  const localPick = selectVariableMatch(name, collection, localDescriptors);
  if (localPick.kind === "match") {
    return { variable: localPick.item.ref };
  }
  if (localPick.kind === "ambiguous") {
    throw new Error(formatAmbiguousVariableError(name, localPick.collections, "local"));
  }

  // Step 2: library. Reached when there's no usable local match — either the name
  // isn't local at all, OR a `collection` was given that no local variable of this
  // name belongs to. In the latter case falling through to library search is
  // intentional (local-wins: a local same-name+same-collection always short-circuits
  // above; otherwise we keep looking by name across library collections).
  // Enumerate ALL collections (no early break) so collisions are detectable.
  // Best-effort: a failure degrades to the candidate-listing error.
  const libraryDescriptors: Array<LibraryVarDescriptor> = [];
  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    for (const col of collections) {
      const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
      for (const v of vars) {
        libraryDescriptors.push({
          name: v.name,
          key: v.key,
          resolvedType: v.resolvedType,
          collection: col.name,
          libraryName: col.libraryName,
        });
      }
    }
  } catch {
    // Library enumeration unavailable — fall through to the candidate-listing error.
  }

  const libPick = selectVariableMatch(name, collection, libraryDescriptors);
  if (libPick.kind === "ambiguous") {
    throw new Error(formatAmbiguousVariableError(name, libPick.collections, "library"));
  }
  if (libPick.kind === "match") {
    // Import the matched library variable. A failure here is reported distinctly
    // (the name WAS found; only the import step failed) instead of as "not found".
    try {
      const imported = await figma.variables.importVariableByKeyAsync(libPick.item.key);
      return {
        variable: imported,
        warning: `Imported library variable "${name}" from "${libPick.item.libraryName}".`,
      };
    } catch (err: any) {
      throw new Error(
        `Found library variable "${name}" in "${libPick.item.libraryName}" but failed to import it: ${err?.message ?? String(err)}`,
      );
    }
  }

  // Step 3: not found — list candidates.
  throw new Error(
    formatVariableNotFoundError(name, all.map((v) => v.name), libraryDescriptors.map((v) => v.name)),
  );
}

/**
 * Build the condition VariableData (Expression form) that wraps a variable
 * reference + literal comparison. Also validates literal type vs variable type.
 * Accepts a single leaf comparison OR a compound { all: [...] } / { any: [...] }.
 */
type LeafComparison = { variable: string; operator: ComparisonOperator; value: boolean | number | string; collection?: string };
type ConditionArg = LeafComparison | { all: LeafComparison[] } | { any: LeafComparison[] };

async function buildCondition(input: ConditionArg): Promise<{ condition: unknown; warning?: string }> {
  let firstWarning: string | undefined;

  const buildLeaf = async (leaf: LeafComparison) => {
    const { variable, warning } = await resolveVariableByName(leaf.variable, leaf.collection);
    if (warning && !firstWarning) firstWarning = warning;
    const literalVD = validateVariableLiteralCompat(
      { name: variable.name, resolvedType: variable.resolvedType },
      leaf.value,
      "comparison",
    );
    return buildConditionExpression({
      variableId: variable.id,
      resolvedType: variable.resolvedType,
      operator: leaf.operator,
      literal: literalVD,
    });
  };

  if ("all" in input || "any" in input) {
    const join = "all" in input ? "AND" : "OR";
    const leaves = "all" in input ? input.all : input.any;
    const operands = await Promise.all(leaves.map(buildLeaf)); // ConditionExpression[]
    return { condition: buildCompoundConditionExpression({ join, operands }), warning: firstWarning };
  }

  const condition = await buildLeaf(input);
  return { condition, warning: firstWarning };
}

function buildSetVariableData(
  variable: Variable,
  value: boolean | number | string,
): unknown {
  return validateVariableLiteralCompat(
    { name: variable.name, resolvedType: variable.resolvedType },
    value,
    "assignment",
  );
}

async function handleGetCanvasOverview(params: GetCanvasOverviewInput) {
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

async function handleGetPrototypeFlow(params: GetPrototypeFlowInput) {
  const page = await loadPage(params.pageId);
  const limit = params.limit ?? 500;

  // findAll (recursive) — frames are commonly nested inside SECTIONs, so a
  // page.children filter would miss them and leave every interaction's frameName
  // null (live probe 2026-06-12, fixture MCP_test_13 section).
  const frames = page
    .findAll((n) => n.type === "FRAME")
    .map((f) => ({
      id: f.id,
      name: f.name,
      isStartFrame: page.flowStartingPoints?.some((p) => p.nodeId === f.id) ?? false,
    }));

  const reactiveNodes = page.findAll(
    (n) => "reactions" in n && (((n as { reactions?: readonly unknown[] }).reactions?.length ?? 0) > 0),
  );

  const interactions: RawInteraction[] = [];
  for (const node of reactiveNodes) {
    const frameId = node.type === "FRAME" ? node.id : findEnclosingFrameId(node);
    const reactions = ((node as { reactions?: readonly any[] }).reactions ?? []) as any[];
    for (const r of reactions) {
      const firstAction = r.actions?.[0] ?? r.action ?? {};
      interactions.push({
        frameId,
        sourceNodeId: node.id,
        sourceNodeName: node.name,
        trigger: r.trigger ?? { type: "UNKNOWN" },
        action: await encodeActionForListEcho(firstAction, echoResolvers),
      });
    }
  }

  return assembleFlowGraph({ page: { id: page.id, name: page.name }, frames, interactions, limit });
}

async function handleFindNodes(params: FindNodesInput) {
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

async function handleListVariables(params: ListVariablesInput) {
  const includeRemote = params.includeRemote ?? true;
  const filters = { resolvedType: params.resolvedType, nameQuery: params.nameQuery };

  const localVars = await figma.variables.getLocalVariablesAsync();
  const localDescriptors: LocalVarDescriptor[] = await Promise.all(
    localVars.map(async (v) => {
      const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      return {
        name: v.name,
        id: v.id,
        resolvedType: v.resolvedType,
        collection: col?.name ?? "",
      };
    }),
  );
  const local = filterVariables(localDescriptors, filters);

  let library: LibraryVarDescriptor[] = [];
  let remoteEnumerated = false;
  if (includeRemote) {
    try {
      const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      const all: LibraryVarDescriptor[] = [];
      for (const col of collections) {
        const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
        for (const v of vars) {
          all.push({
            name: v.name,
            key: v.key,
            resolvedType: v.resolvedType,
            collection: col.name,
            libraryName: col.libraryName,
          });
        }
      }
      library = filterVariables(all, filters);
      remoteEnumerated = true;
    } catch {
      // Library enumeration is best-effort: any failure (no library access,
      // permissions, runtime gaps) degrades to an empty list + remoteEnumerated:false
      // rather than failing the whole call. The local list above still stands.
      library = [];
      remoteEnumerated = false;
    }
  }

  return { local, library, remoteEnumerated };
}

async function handleCreateReactions(params: CreateReactionsInput) {
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
      const source = await figma.getNodeByIdAsync(conn.sourceNodeId);
      if (!source) throw new Error(`Source node not found: ${conn.sourceNodeId}`);
      if (!("setReactionsAsync" in source) || typeof (source as any).setReactionsAsync !== "function") {
        throw new Error(`Node cannot have reactions: ${source.name} (type: ${source.type})`);
      }

      let newReaction: BuiltReaction;
      let warning: string | undefined;

      if (conn.action.type === "conditional") {
        const { condition, warning: condWarning } = await buildCondition(conn.action.condition);
        if (condWarning) warning = condWarning;

        const thenBuilt: BuiltAction[] = [];
        for (const a of conn.action.then) {
          const r = await buildNonConditionalAction(a, conn.trigger, conn.afterTimeoutSeconds, conn.transition, source, conn.degradeTo);
          thenBuilt.push(r.built);
          // Inner-branch scroll warnings: surface the first one upward
          if (r.warning && !warning) warning = r.warning;
        }
        let elseBuilt: BuiltAction[] | undefined;
        if (conn.action.else) {
          elseBuilt = [];
          for (const a of conn.action.else) {
            const r = await buildNonConditionalAction(a, conn.trigger, conn.afterTimeoutSeconds, conn.transition, source, conn.degradeTo);
            elseBuilt.push(r.built);
            if (r.warning && !warning) warning = r.warning;
          }
        }

        newReaction = buildConditionalReaction({
          trigger: conn.trigger,
          afterTimeoutSeconds: conn.afterTimeoutSeconds,
          condition,
          thenActions: thenBuilt,
          elseActions: elseBuilt,
        });
      } else if (conn.action.type === "toggle_variable") {
        // Desugar: { type: "CONDITIONAL", conditionalBlocks: [
        //   { condition: x == true, actions: [SET_VARIABLE x = false] },
        //   { actions: [SET_VARIABLE x = true] }   // else
        // ]}
        const { variable, warning: resolveWarning } = await resolveVariableByName(
          conn.action.variable,
          conn.action.collection,
        );
        if (variable.resolvedType !== "BOOLEAN") {
          throw new Error(`Cannot toggle non-BOOLEAN variable "${conn.action.variable}" (type: ${variable.resolvedType}); toggle_variable requires BOOLEAN`);
        }
        if (resolveWarning) warning = resolveWarning;

        const condition = {
          type: "EXPRESSION",
          resolvedType: "BOOLEAN",
          value: {
            expressionFunction: "EQUALS",
            expressionArguments: [
              { type: "VARIABLE_ALIAS", resolvedType: "BOOLEAN",
                value: { type: "VARIABLE_ALIAS", id: variable.id } },
              { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true },
            ],
          },
        };
        const setFalseAction: BuiltAction = {
          type: "SET_VARIABLE",
          variableId: variable.id,
          variableValue: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: false },
        };
        const setTrueAction: BuiltAction = {
          type: "SET_VARIABLE",
          variableId: variable.id,
          variableValue: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true },
        };

        newReaction = buildConditionalReaction({
          trigger: conn.trigger,
          afterTimeoutSeconds: conn.afterTimeoutSeconds,
          condition,
          thenActions: [setFalseAction],
          elseActions: [setTrueAction],
        });
      } else {
        // set_variable + 7 non-conditional types: handled by buildNonConditionalAction
        // (set_variable branch added in Task 5)
        const { built, warning: branchWarning } = await buildNonConditionalAction(
          conn.action,
          conn.trigger,
          conn.afterTimeoutSeconds,
          conn.transition,
          source,
          conn.degradeTo,
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


// Figma-backed implementations of the echo id->name lookups; the deleted-id
// try/catch lives here (the pure encoder in action-echo.ts stays figma-free).
const echoResolvers: EchoResolvers = {
  variableName: async (id) => {
    try {
      return (await figma.variables.getVariableByIdAsync(id))?.name;
    } catch {
      return undefined; // variable was deleted
    }
  },
  nodeName: async (id) => (await figma.getNodeByIdAsync(id))?.name ?? undefined,
};

async function handleListReactions(params: ListReactionsInput) {
  await figma.loadAllPagesAsync();
  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  if (!("reactions" in node)) throw new Error(`Node has no reactions field: ${node.name}`);
  const reactions = ((node as any).reactions ?? []) as any[];
  return {
    nodeId: node.id,
    nodeName: node.name,
    reactions: await Promise.all(reactions.map(async (r, i) => {
      const firstAction = r.actions?.[0] ?? r.action ?? {};
      return {
        index: i,
        trigger: r.trigger ?? { type: "UNKNOWN" },
        action: await encodeActionForListEcho(firstAction, echoResolvers),
      };
    })),
  };
}

async function handleClearReactions(params: ClearReactionsInput) {
  await figma.loadAllPagesAsync();
  const results = [];

  for (const nodeId of params.nodeIds) {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
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

async function handleSetFrameScroll(params: SetFrameScrollInput) {
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
      const node = await figma.getNodeByIdAsync(frameId);
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
