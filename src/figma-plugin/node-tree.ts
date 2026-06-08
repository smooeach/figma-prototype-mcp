// Pure node-tree traversals over a minimal structural node shape.
// NodeLike is a structural supertype of Figma's BaseNode/SceneNode for the
// fields these helpers read, so real Figma nodes are assignable without casts.
// No figma.* / zod references — safe inside the plugin bundle.

export interface NodeLike {
  id: string;
  name: string;
  type: string;
  parent: NodeLike | null;
  reactions?: readonly unknown[];
  overflowDirection?: string;
}

/** Nearest FRAME ancestor's id, or null. (Starts at node.parent — excludes the node itself.) */
export function findEnclosingFrameId(node: NodeLike): string | null {
  let cur: NodeLike | null = node.parent;
  while (cur) {
    if (cur.type === "FRAME") return cur.id;
    cur = cur.parent;
  }
  return null;
}

/** Whether the node carries at least one reaction. */
export function hasReactions(node: NodeLike): boolean {
  return Array.isArray(node.reactions) && node.reactions.length > 0;
}

/** Nearest ancestor with a scrollable overflowDirection (not "NONE"), or null. */
export function findScrollableAncestor(node: NodeLike): NodeLike | null {
  let cur: NodeLike | null = node.parent;
  while (cur) {
    if (cur.overflowDirection !== undefined && cur.overflowDirection !== "NONE") {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

/** Breadcrumb of names from the node up to (excluding) the DOCUMENT, joined by " > ". */
export function pathOf(node: NodeLike): string {
  const parts: string[] = [];
  let cur: NodeLike | null = node;
  while (cur && cur.type !== "DOCUMENT") {
    parts.unshift(cur.name);
    cur = cur.parent;
  }
  return parts.join(" > ");
}
