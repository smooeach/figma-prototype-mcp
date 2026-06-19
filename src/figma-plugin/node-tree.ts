// Pure node-tree traversals over a minimal structural node shape.
// NodeLike is a structural supertype of Figma's BaseNode/SceneNode for the
// fields these helpers read, so real Figma nodes are assignable without casts.
// No figma.* / zod references — safe inside the plugin bundle.

export interface NodeLike {
  id: string;
  name: string;
  type: string;
  parent: NodeLike | null;
  children?: readonly NodeLike[];
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

export interface ElementInfo {
  id: string;
  name: string;
  type: string;
  hasReactions: boolean;
}

export interface WireableElementsResult {
  elements: ElementInfo[];
  elementCount: number;
  truncated: boolean;
}

// Figma auto-generated layer names (e.g. "Frame", "Rectangle 12"). A container
// with one of these names is decoration/layout, not an intentional UI element.
const DEFAULT_NAME_RE =
  /^(Frame|Group|Rectangle|Ellipse|Vector|Line|Image|Component|Star|Polygon|Slice)\s*\d*$/;

export function isDefaultName(name: string): boolean {
  return DEFAULT_NAME_RE.test(name);
}

const CONTAINER_TYPES = new Set(["FRAME", "GROUP", "COMPONENT"]);

/** "Interactive-looking" (name-agnostic): already-wired, an instance, or a named container. */
export function isWireableElement(node: NodeLike): boolean {
  if (hasReactions(node)) return true;
  if (node.type === "INSTANCE") return true;
  if (CONTAINER_TYPES.has(node.type)) return !isDefaultName(node.name);
  return false;
}

/**
 * Depth-first, document-order collection of wireable elements under `screen`
 * (the screen itself is excluded). Stops descending into a matched node so a
 * button is one entry, not the button plus its internals. `elementCount` is the
 * true total (pre-cap); `elements` holds at most `cap`.
 */
export function collectWireableElements(screen: NodeLike, cap: number): WireableElementsResult {
  const elements: ElementInfo[] = [];
  let elementCount = 0;
  const visit = (nodes: readonly NodeLike[] | undefined): void => {
    if (!nodes) return;
    for (const n of nodes) {
      if (isWireableElement(n)) {
        elementCount++;
        if (elements.length < cap) {
          elements.push({ id: n.id, name: n.name, type: n.type, hasReactions: hasReactions(n) });
        }
        // stop-at-match: do not descend into a matched node
      } else {
        visit(n.children);
      }
    }
  };
  visit(screen.children);
  return { elements, elementCount, truncated: elementCount > cap };
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

/**
 * The top-level frame containing `node`: the FRAME ancestor (or `node` itself)
 * whose parent is a PAGE or SECTION (or null). This is the screen Figma uses as
 * the SMART_ANIMATE source. Null when no such frame exists in the chain.
 */
export function findTopLevelFrameNode(node: NodeLike): NodeLike | null {
  let cur: NodeLike | null = node;
  let top: NodeLike | null = null;
  while (cur) {
    if (cur.type === "FRAME") {
      const p = cur.parent;
      if (!p || p.type === "PAGE" || p.type === "SECTION") top = cur;
    }
    cur = cur.parent;
  }
  return top;
}

/**
 * Whether `node` is a screen-level frame: a FRAME whose parent is the PAGE or a
 * SECTION (or has no parent) — i.e. one of the screens you wire prototypes
 * between, NOT a frame nested inside another frame (a button/card/etc.). Used to
 * enumerate screens including those grouped inside Sections, which a top-level
 * `page.children` filter would miss.
 */
export function isScreenFrame(node: NodeLike): boolean {
  if (node.type !== "FRAME") return false;
  const p = node.parent;
  return !p || p.type === "PAGE" || p.type === "SECTION";
}

/**
 * Paths of every descendant of `node`, relative to `node` (the frame's own name
 * excluded). Each path is the "/"-joined chain of names from a direct child down
 * to that descendant — e.g. a "Title" inside a "Card" yields "Card" and
 * "Card/Title". A shared path means a same-named layer sits at the same place in
 * both trees, which is what Smart Animate can meaningfully morph; a same name
 * under a differently-named parent produces different paths and does not match.
 */
export function collectDescendantLayerPaths(node: NodeLike): Set<string> {
  const paths = new Set<string>();
  const visit = (n: NodeLike, prefix: string): void => {
    for (const child of n.children ?? []) {
      const path = prefix ? `${prefix}/${child.name}` : child.name;
      paths.add(path);
      visit(child, path);
    }
  };
  visit(node, "");
  return paths;
}

/**
 * True if `a` and `b` share at least one descendant layer at the same relative
 * path (hierarchy-aware). A bare name match under differing ancestors does not
 * count — Smart Animate would have nothing to morph there.
 */
export function framesShareLayer(a: NodeLike, b: NodeLike): boolean {
  const pathsA = collectDescendantLayerPaths(a);
  for (const path of collectDescendantLayerPaths(b)) {
    if (pathsA.has(path)) return true;
  }
  return false;
}
