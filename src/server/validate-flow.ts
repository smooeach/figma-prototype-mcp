// Pure prototype-flow linter. GET_PROTOTYPE_FLOW output -> validation issues.
// No figma.* / no I/O. Reuses buildInteractionSpec to normalize actions.
import { buildInteractionSpec, type Action } from "./interaction-spec.js";

export type ValidationRule =
  | "broken-reference"
  | "unreachable"
  | "dead-end"
  | "start-frame";

export interface ValidationIssue {
  severity: "error" | "warning";
  rule: ValidationRule;
  frameId: string | null;
  frameName: string | null;
  sourceNodeId?: string;
  sourceNodeName?: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  page: { id: string; name: string };
  issues: ValidationIssue[];
  summary: { errors: number; warnings: number; frames: number; interactions: number };
  truncated: boolean;
}

interface RawFlow {
  page?: { id: string; name: string };
  frames?: Array<{ id: string; name: string; isStartFrame?: boolean }>;
  interactions?: Array<{
    frameId: string | null;
    sourceNodeId: string;
    sourceNodeName: string;
    trigger: unknown;
    actions: unknown[];
  }>;
  truncated?: boolean;
}

/** Frame-navigation actions whose `to.id` is a destination frame on this page. */
function navTargets(actions: Action[]): Array<string | null> {
  const out: Array<string | null> = [];
  for (const a of actions) {
    if (a.type === "navigate" || a.type === "openOverlay" || a.type === "swapOverlay") {
      out.push(a.to.id);
    } else if (a.type === "conditional") {
      out.push(...navTargets(a.then));
      if (a.else) out.push(...navTargets(a.else));
    }
  }
  return out;
}

/** True if any action lets the user leave / change the current screen. */
function hasExit(actions: Action[]): boolean {
  for (const a of actions) {
    if (
      a.type === "navigate" ||
      a.type === "openOverlay" ||
      a.type === "swapOverlay" ||
      a.type === "back" ||
      a.type === "closeOverlay" ||
      a.type === "changeVariant"
    ) {
      return true;
    }
    if (a.type === "conditional") {
      if (hasExit(a.then)) return true;
      if (a.else && hasExit(a.else)) return true;
    }
  }
  return false;
}

export function analyzeFlow(flow: RawFlow): ValidationResult {
  const frames = flow.frames ?? [];
  const page = flow.page ?? { id: "", name: "" };
  const frameIds = new Set(frames.map((f) => f.id));
  const spec = buildInteractionSpec(flow as Parameters<typeof buildInteractionSpec>[0], frames.map((f) => f.id));

  const issues: ValidationIssue[] = [];

  // broken-reference: nav target null or off-page
  for (const screen of spec.screens) {
    for (const it of screen.interactions) {
      for (const target of navTargets(it.actions)) {
        if (target === null || !frameIds.has(target)) {
          issues.push({
            severity: "error",
            rule: "broken-reference",
            frameId: screen.id,
            frameName: screen.name,
            sourceNodeId: it.source.id ?? undefined,
            sourceNodeName: it.source.name ?? undefined,
            message: `Interaction on '${it.source.name ?? it.source.id ?? "?"}' (frame '${screen.name ?? screen.id}') navigates to a destination that is not a frame on this page${target ? ` (${target})` : " (missing destination)"}.`,
          });
        }
      }
    }
  }

  // start-frame: 0 or >=2
  const starts = frames.filter((f) => f.isStartFrame);
  if (starts.length === 0) {
    issues.push({
      severity: "warning",
      rule: "start-frame",
      frameId: null,
      frameName: null,
      message: "No start frame is set for this page — the prototype has no defined entry point.",
    });
  } else if (starts.length >= 2) {
    issues.push({
      severity: "warning",
      rule: "start-frame",
      frameId: null,
      frameName: null,
      message: `This page has ${starts.length} start frames (may be intentional multiple flows).`,
    });
  }

  // unreachable: BFS from all start frames over on-page nav edges
  if (starts.length > 0) {
    const adj = new Map<string, string[]>();
    for (const screen of spec.screens) {
      const outs: string[] = [];
      for (const it of screen.interactions) {
        for (const t of navTargets(it.actions)) {
          if (t !== null && frameIds.has(t)) outs.push(t);
        }
      }
      adj.set(screen.id, outs);
    }
    const reached = new Set<string>();
    const queue = starts.map((f) => f.id);
    for (const id of queue) reached.add(id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const next of adj.get(id) ?? []) {
        if (!reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
    for (const f of frames) {
      if (!reached.has(f.id)) {
        issues.push({
          severity: "error",
          rule: "unreachable",
          frameId: f.id,
          frameName: f.name,
          message: `Frame '${f.name}' is not reachable from any start frame.`,
        });
      }
    }
  }

  // dead-end: frame with no screen-changing action
  for (const screen of spec.screens) {
    const exits = screen.interactions.some((it) => hasExit(it.actions));
    if (!exits) {
      issues.push({
        severity: "warning",
        rule: "dead-end",
        frameId: screen.id,
        frameName: screen.name,
        message: `Frame '${screen.name ?? screen.id}' has no outgoing navigation — may be a final screen.`,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  return {
    ok: errors === 0,
    page,
    issues,
    // counts all wired interactions on the page (incl. any with a null frameId that are not analyzed) — matches get_prototype_flow's total-wired semantics
    summary: { errors, warnings, frames: frames.length, interactions: (flow.interactions ?? []).length },
    truncated: Boolean(flow.truncated),
  };
}
