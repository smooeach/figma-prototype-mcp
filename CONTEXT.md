# Domain language — figma-prototype-mcp

A shared glossary so code, specs, and reviews use the same words. Add a term when a module is named after a concept that isn't here yet.

## Core concepts

- **Reaction** — a Figma prototype interaction on a node: a **trigger** (e.g. On Click) plus one or more **actions**. Persisted via `node.setReactionsAsync(...)`.
- **Action** — what a reaction does: Navigate / Scroll / Open Overlay / Close / Back / Open URL / Swap Overlay / Set Variable / Toggle Variable / Conditional. Modeled as zod input on the server (`src/mcp-server/`) and built into Figma's `Action` shape in the plugin (`reaction-builder.ts` / `code.ts`).
- **Conditional** — a single-level if/else action: one **comparison** condition, a `then` action list, an optional `else` list. Figma's prototype has no else-if and no AND/OR condition combinator (platform limit — see memory `v0.24.0-blocked-by-figma`).
- **Condition expression** — Figma's EXPRESSION VariableData wrapping one `variable <op> literal` comparison (`expressionFunction` + `[VARIABLE_ALIAS, literal]`). Built/decoded by the pure `condition-codec` module (`src/figma-plugin/condition-codec.ts`), which also detects the `toggle_variable` desugar shape. The variable-name lookup is the caller's (impure) step; the codec works on ids.
- **Motion preset** — a named transition tone (M3 / HIG family) resolved to a Figma `Transition` (`src/shared/motionPresets.ts`).

## Variables

- **Variable literal** — a JS literal (`boolean | number | string`, or a hex string for COLOR) checked against a Figma variable's `resolvedType` and coerced into Figma **VariableData** (`{ type, resolvedType, value }`). The check is the same in two **contexts**: *assignment* (Set Variable — COLOR parses a hex string to RGBA) and *comparison* (Conditional — COLOR is rejected). Lives in the `variable-literal` module (`src/figma-plugin/variable-literal.ts`), a pure seam tested without the Figma API.
- **VariableData** — Figma's tagged value shape for a variable's value or an expression argument.

## Transport / sessions

- **PluginSession** — the single-active WebSocket link to the one connected Figma plugin (newest-wins).
- **SseSession** — the single-active MCP-client (SSE) connection, symmetric with PluginSession (newest-wins).
- **proto_\* tools** — the high-level, designer-intent MCP tools (wire/overlay/scroll/back/url/set-variable/toggle-variable/conditional) that compile down to the low-level `create_reactions` surface.
