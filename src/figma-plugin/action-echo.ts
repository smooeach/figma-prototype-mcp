import { detectTogglePattern, decodeConditionExpression, type DecodedComparison } from "./condition-codec.js";
import { rgbToHex } from "./variable-literal.js";

/**
 * The two impure id->name lookups the echo encoder needs. The caller supplies
 * figma-backed implementations (swallowing deleted-id errors); tests supply
 * deterministic fakes. No figma.* / zod here — safe inside the plugin bundle.
 */
export interface EchoResolvers {
  /** Variable id -> name; resolves undefined for a missing/deleted variable. */
  variableName(id: string): Promise<string | undefined>;
  /** Node id -> name; undefined for a missing node. */
  nodeName(id: string): Promise<string | undefined>;
}

/** Re-encode a built reaction action into the list_reactions wire/echo shape. */
export async function encodeActionForListEcho(action: any, resolvers: EchoResolvers): Promise<unknown> {
  if (!action || typeof action !== "object") return { type: "UNKNOWN" };

  if (action.type === "CONDITIONAL") {
    const blocks = Array.isArray(action.conditionalBlocks) ? action.conditionalBlocks : [];

    // 1) Toggle_variable desugar pattern first.
    const toggleVarId = detectTogglePattern(blocks);
    if (toggleVarId) {
      const varName = await resolvers.variableName(toggleVarId);
      return { type: "toggle_variable", variable: varName ?? `<id:${toggleVarId}>` };
    }

    // 2) Standard 1–2 block conditional (block[0] has a condition; optional else has none).
    const standardPattern = blocks.length >= 1 && blocks.length <= 2 &&
      blocks[0].condition !== undefined &&
      (blocks.length === 1 || blocks[1].condition === undefined);
    if (!standardPattern) {
      return { type: "CONDITIONAL", raw: blocks };
    }

    const decodedCondition = await decodeConditionForEcho(blocks[0].condition, resolvers);
    const thenActions = await Promise.all(
      (blocks[0].actions ?? []).map((a: any) => encodeActionForListEcho(a, resolvers)),
    );
    const elseActions = blocks.length === 2
      ? await Promise.all((blocks[1].actions ?? []).map((a: any) => encodeActionForListEcho(a, resolvers)))
      : undefined;

    return { type: "CONDITIONAL", condition: decodedCondition, then: thenActions, else: elseActions };
  }

  if (action.type === "SET_VARIABLE") {
    let varName: string | undefined;
    if (action.variableId) varName = await resolvers.variableName(action.variableId);
    const vd = action.variableValue;
    let value: unknown;
    if (
      vd?.type === "COLOR" && vd?.value && typeof vd.value === "object" &&
      "r" in vd.value && "g" in vd.value && "b" in vd.value
    ) {
      value = rgbToHex(vd.value as { r: number; g: number; b: number; a?: number });
    } else {
      value = vd?.value;
    }
    return { type: "set_variable", variable: varName ?? `<id:${action.variableId}>`, value };
  }

  // NODE / CLOSE / BACK / URL / unknown passthrough — identical shape as before.
  const destId = action.destinationId;
  const destName = destId ? await resolvers.nodeName(destId) : undefined;
  return {
    type: action.type ?? "UNKNOWN",
    navigation: action.navigation,
    url: action.url,
    openInNewTab: action.openInNewTab,
    destinationId: destId,
    destinationName: destName,
    transition: action.transition,
    resetScrollPosition: action.resetScrollPosition,
  };
}

/**
 * Decode an EXPRESSION condition back to { variable, operator, value }, or
 * { all/any: [...] } for a compound AND/OR. Returns { raw } if the shape
 * isn't recognized; keeps the raw condition when the variable name can't be
 * resolved.
 */
export async function decodeConditionForEcho(condition: any, resolvers: EchoResolvers): Promise<unknown> {
  const decoded = decodeConditionExpression(condition);
  if ("raw" in decoded) return { raw: decoded.raw };

  const echoLeaf = async (c: DecodedComparison) => {
    const name = c.variableId ? await resolvers.variableName(c.variableId) : undefined;
    return { variable: name ?? `<id:${c.variableId}>`, operator: c.operator, value: c.value };
  };

  if ("join" in decoded) {
    const conditions = [];
    for (const c of decoded.conditions) conditions.push(await echoLeaf(c));
    return decoded.join === "all" ? { all: conditions } : { any: conditions };
  }

  const leaf = await echoLeaf(decoded);
  return {
    ...leaf,
    raw: leaf.variable.startsWith("<id:") ? condition : undefined, // keep raw if we lost the name
  };
}
