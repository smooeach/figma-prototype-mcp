// Pure assembler for get_prototype_flow output. No figma.* — the handler does the
// figma-bound scan + decode, then calls this to shape the result. Unit-testable.

export interface FlowFrame {
  id: string;
  name: string;
  isStartFrame: boolean;
}

/** An interaction record as produced by the handler (action already echo-decoded). */
export interface RawInteraction {
  frameId: string | null;
  sourceNodeId: string;
  sourceNodeName: string;
  trigger: unknown;
  action: unknown;
}

export interface FlowInteraction extends RawInteraction {
  frameName: string | null;
}

export interface FlowGraph {
  page: { id: string; name: string };
  frames: FlowFrame[];
  interactions: FlowInteraction[];
  truncated: boolean;
}

/**
 * Shape the final flow graph: resolve each interaction's frameName from the frame
 * list, cap to `limit`, and flag truncation. Pure.
 */
export function assembleFlowGraph(input: {
  page: { id: string; name: string };
  frames: FlowFrame[];
  interactions: RawInteraction[];
  limit: number;
}): FlowGraph {
  const nameById = new Map(input.frames.map((f) => [f.id, f.name]));
  const limited = input.interactions.slice(0, input.limit);
  const interactions: FlowInteraction[] = limited.map((i) => ({
    ...i,
    frameName: i.frameId !== null ? (nameById.get(i.frameId) ?? null) : null,
  }));
  return {
    page: input.page,
    frames: input.frames,
    interactions,
    truncated: input.interactions.length > input.limit,
  };
}
