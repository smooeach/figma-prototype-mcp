# Prototype flow read — `get_prototype_flow` — design

**Date:** 2026-06-12
**Status:** approved (brainstorming) → ready for implementation plan
**Builds on:** the existing read tools (`get_canvas_overview`, `find_nodes`, `list_reactions`) and the `action-echo` decoder used by `list_reactions`.

## Goal

Give an agent the whole prototype interaction graph of a page in **one call**, so it can see "what is already wired and where it goes" without calling `list_reactions` node-by-node (and without first guessing which nodes carry reactions). This is the read/understand complement to the write surface (the "#2" next-axis after compound conditions).

## Problem

Today, to understand a page's wiring an agent must: enumerate frames (`get_canvas_overview` — gives screens but **no edges**), guess which nodes might be reactive, then call `list_reactions` once per node. There is no way to enumerate reactive nodes or see the graph at once.

## Scope

**In:** a page-level read returning the page's frames (screens) + every wired interaction on that page, each decoded with its trigger and action (reusing the `list_reactions` echo). All reaction kinds are included — frame navigation (NAVIGATE/OVERLAY/SWAP/BACK/CLOSE/SCROLL_TO/CHANGE_TO), variable mutations (SET_VARIABLE/TOGGLE_VARIABLE), URL, and CONDITIONAL (its then/else branches — including compound `all`/`any` conditions — are visible inside the echoed action).

**Out (YAGNI):** derived analytics (reachability from start points, orphan/dead-end detection, duplicate/conflict detection) — the raw graph is returned and the agent reasons over it; analytics can layer on later. Document-wide scan (Figma flows are page-scoped; default to the current page with an optional `pageId`). No new write behavior.

## Tool

A low-level **read** tool `get_prototype_flow`, in the same family as `get_canvas_overview` / `list_reactions` (NOT a `proto_*` high-level tool). Registered in `src/server/tools.ts`; dispatched to the plugin as a `GET_PROTOTYPE_FLOW` command.

**Input:**
```ts
{ pageId?: string,            // default: current page (same pattern as get_canvas_overview)
  limit?: number }            // max interactions returned (default 500); sets `truncated`
```

## Output shape

```jsonc
{
  "page": { "id": "1:2", "name": "Flow" },
  "frames": [
    { "id": "1:10", "name": "login", "isStartFrame": true },
    { "id": "1:20", "name": "home", "isStartFrame": false }
  ],
  "interactions": [
    {
      "frameId": "1:10",            // enclosing frame of the source node (the screen it lives on); null if none
      "frameName": "login",
      "sourceNodeId": "1:11",
      "sourceNodeName": "loginButton",
      "trigger": { "type": "ON_CLICK" },
      "action": { /* same echo shape list_reactions returns: navigate→destinationId, conditional→{condition, then, else}, set_variable→{variable,value}, url→..., etc. */ }
    }
  ],
  "truncated": false
}
```

- `frames` reuses `get_canvas_overview`'s frame info (id, name, `isStartFrame` from `page.flowStartingPoints`).
- One `interactions` entry per reaction per reactive node (a node with N reactions yields N entries). `action` is exactly the `list_reactions` per-reaction echo (so conditionals/compounds/variables round-trip identically). Frame-navigation "spine" is obtained by the agent filtering `action.type`/`navigation`.
- `frameId` groups an interaction under its screen via `findEnclosingFrameId`; a reactive top-level frame's own interactions report that frame (or null if outside any frame).

## Internals / reuse

- New plugin handler `handleGetPrototypeFlow(params)` in `src/figma-plugin/code.ts`:
  1. `loadPage(params.pageId)` (existing helper, as `get_canvas_overview` uses).
  2. `frames` = page children of type FRAME → `{ id, name, isStartFrame: page.flowStartingPoints?.some(p => p.nodeId === f.id) }`.
  3. Reactive nodes = `page.findAll(n => "reactions" in n && (n as any).reactions?.length > 0)`.
  4. For each reactive node, for each reaction → build a record `{ frameId: findEnclosingFrameId(node), frameName, sourceNodeId: node.id, sourceNodeName: node.name, trigger, action: await encodeActionForListEcho(firstAction, echoResolvers) }` — reusing the SAME `encodeActionForListEcho` + `echoResolvers` that `handleListReactions` uses.
  5. Apply `limit` → set `truncated`.
- A **pure assembler** is extracted so it can be unit-tested without `figma.*`: it takes already-decoded interaction records (+ the frame list + limit) and produces the final `{ page, frames, interactions, truncated }` (handles limit/truncation and frameName lookup). The figma-bound scan (findAll + reaction enumeration + echo) stays in the handler and is covered by the live probe.
- New `GetPrototypeFlowInput` zod schema in `src/mcp-server/tools.ts`; `GET_PROTOTYPE_FLOW` added to the plugin `Command` union in `code.ts`; tool registered in `src/server/tools.ts` with a describe() explaining it returns the page's whole interaction graph (and pointing to `list_reactions` for a single node).

## Error handling

- Unknown `pageId` → the existing `loadPage` error path (consistent with `get_canvas_overview`).
- A reaction whose action the echo can't fully decode still appears (the echo already returns a `{ raw }` fallback) — never throws, so one odd reaction can't blank the whole graph.
- Empty page (no frames / no interactions) → `{ page, frames: [], interactions: [], truncated: false }`.

## Testing & ship gate

- **TDD unit:** the pure assembler — grouping records, `limit`/`truncated` behavior, frameName resolution, empty-input case. (The `action` echo + decoder are already unit-tested via `list_reactions`/`action-echo`.)
- **Live probe (ship gate):** on a real page with several wired interactions (navigate + a conditional + a variable set), call `get_prototype_flow` and confirm: frames listed with correct `isStartFrame`, every wired interaction present with correct enclosing `frameId`, and the echoed `action` matches what `list_reactions` returns for the same nodes. Keep Claude Desktop the sole SSE client during the run.

## Risks / open questions

- **`reactions` field availability:** not all node types have `reactions`; the `"reactions" in n` guard handles it. Verify `findAll` performance is acceptable on a large page (the `limit` caps output size, not the scan; if scans are slow on huge pages, note it — not expected to block).
- **`flowStartingPoints` typing:** already read successfully by `get_canvas_overview`, so no new runtime-vs-typings risk expected; the live probe confirms.
