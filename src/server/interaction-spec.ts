// Pure transform: GET_PROTOTYPE_FLOW output -> canonical, framework-agnostic
// interaction spec, scoped to designated screen frame IDs. No figma.* / no I/O.

export interface NodeRef {
  id: string | null;
  name: string | null;
}

export type ConditionNode =
  | { variable: unknown; operator: unknown; value: unknown }
  | { all: ConditionNode[] }
  | { any: ConditionNode[] }
  | { raw: unknown };

export type Action =
  | { type: "navigate"; to: NodeRef; transition?: unknown }
  | { type: "scrollTo"; to: NodeRef; transition?: unknown }
  | { type: "openOverlay"; to: NodeRef; transition?: unknown }
  | { type: "swapOverlay"; to: NodeRef; transition?: unknown }
  | { type: "changeVariant"; to: NodeRef }
  | { type: "back" }
  | { type: "closeOverlay" }
  | { type: "openUrl"; url: unknown; openInNewTab?: unknown }
  | { type: "setVariable"; variable: unknown; value: unknown }
  | { type: "toggleVariable"; variable: unknown }
  | { type: "conditional"; if: ConditionNode; then: Action[]; else?: Action[] };

export interface InteractionEntry {
  source: NodeRef;
  trigger: unknown;
  actions: Action[];
}

export interface ScreenSpec {
  id: string;
  name: string | null;
  interactions: InteractionEntry[];
}

export interface Unsupported {
  source: NodeRef;
  reason: string;
  raw: unknown;
}

export interface InteractionSpec {
  schemaVersion: "1.0";
  page: { id: string; name: string };
  screens: ScreenSpec[];
  requestedScreens: string[];
  missingScreens: string[];
  unsupported: Unsupported[];
  truncated: boolean;
}

interface RawFlow {
  page?: { id: string; name: string };
  frames: Array<{ id: string; name: string; isStartFrame?: boolean }>;
  interactions: Array<{
    frameId: string | null;
    sourceNodeId: string;
    sourceNodeName: string;
    trigger: unknown;
    actions: unknown[];
  }>;
  truncated?: boolean;
}

function mapCondition(c: any): ConditionNode {
  if (c && typeof c === "object") {
    if (Array.isArray(c.all)) return { all: c.all.map(mapCondition) };
    if (Array.isArray(c.any)) return { any: c.any.map(mapCondition) };
    if ("variable" in c && "operator" in c) {
      return { variable: c.variable, operator: c.operator, value: c.value };
    }
    if ("raw" in c) return { raw: c.raw };
  }
  return { raw: c };
}

function mapAction(a: any, source: NodeRef, unsupported: Unsupported[]): Action | null {
  if (!a || typeof a !== "object") {
    unsupported.push({ source, reason: "non-object action", raw: a });
    return null;
  }
  switch (a.type) {
    case "BACK":
      return { type: "back" };
    case "CLOSE":
      return { type: "closeOverlay" };
    case "URL":
      return { type: "openUrl", url: a.url, openInNewTab: a.openInNewTab };
    case "set_variable":
      return { type: "setVariable", variable: a.variable, value: a.value };
    case "toggle_variable":
      return { type: "toggleVariable", variable: a.variable };
    case "NODE": {
      const to: NodeRef = { id: a.destinationId ?? null, name: a.destinationName ?? null };
      switch (a.navigation) {
        case "NAVIGATE": return { type: "navigate", to, transition: a.transition };
        case "SCROLL_TO": return { type: "scrollTo", to, transition: a.transition };
        case "OVERLAY": return { type: "openOverlay", to, transition: a.transition };
        case "SWAP": return { type: "swapOverlay", to, transition: a.transition };
        case "CHANGE_TO": return { type: "changeVariant", to };
        default:
          unsupported.push({ source, reason: `unknown navigation: ${String(a.navigation)}`, raw: a });
          return null;
      }
    }
    case "CONDITIONAL": {
      if (a.condition === undefined || a.then === undefined) {
        unsupported.push({ source, reason: "non-standard conditional", raw: a });
        return null;
      }
      const then = (Array.isArray(a.then) ? a.then : [])
        .map((x: unknown) => mapAction(x, source, unsupported))
        .filter((x: Action | null): x is Action => x !== null);
      const elseActions = a.else !== undefined
        ? (Array.isArray(a.else) ? a.else : [])
            .map((x: unknown) => mapAction(x, source, unsupported))
            .filter((x: Action | null): x is Action => x !== null)
        : undefined;
      return { type: "conditional", if: mapCondition(a.condition), then, else: elseActions };
    }
    default:
      unsupported.push({ source, reason: `unknown action type: ${String(a.type)}`, raw: a });
      return null;
  }
}

export function buildInteractionSpec(flow: RawFlow, screens: string[]): InteractionSpec {
  const frameById = new Map((flow.frames ?? []).map((f) => [f.id, f]));
  const byFrame = new Map<string, RawFlow["interactions"]>();
  for (const it of flow.interactions ?? []) {
    if (it.frameId == null) continue;
    const arr = byFrame.get(it.frameId) ?? [];
    arr.push(it);
    byFrame.set(it.frameId, arr);
  }

  const unsupported: Unsupported[] = [];
  const screensOut: ScreenSpec[] = [];
  const missingScreens: string[] = [];

  for (const id of screens) {
    const frame = frameById.get(id);
    if (!frame) {
      missingScreens.push(id);
      continue;
    }
    const interactions: InteractionEntry[] = (byFrame.get(id) ?? []).map((it) => {
      const source: NodeRef = { id: it.sourceNodeId, name: it.sourceNodeName ?? null };
      const actions = (Array.isArray(it.actions) ? it.actions : [])
        .map((a) => mapAction(a, source, unsupported))
        .filter((x): x is Action => x !== null);
      return { source, trigger: it.trigger, actions };
    });
    screensOut.push({ id, name: frame.name ?? null, interactions });
  }

  return {
    schemaVersion: "1.0",
    page: flow.page ?? { id: "", name: "" },
    screens: screensOut,
    requestedScreens: screens,
    missingScreens,
    unsupported,
    truncated: Boolean(flow.truncated),
  };
}
