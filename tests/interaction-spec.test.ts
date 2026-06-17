import { describe, it, expect } from "vitest";
import { buildInteractionSpec } from "../src/server/interaction-spec.js";

const flow = {
  page: { id: "0:1", name: "Flow" },
  frames: [
    { id: "F1", name: "screenS3_01", isStartFrame: true },
    { id: "F2", name: "screenS3_detail", isStartFrame: false },
  ],
  interactions: [
    { frameId: "F1", sourceNodeId: "b1", sourceNodeName: "button01", trigger: { type: "ON_CLICK" },
      actions: [{ type: "set_variable", variable: "screenS3_01-bg", value: "#000000" }] },
    { frameId: "F1", sourceNodeId: "c1", sourceNodeName: "card", trigger: { type: "ON_CLICK" },
      actions: [{ type: "NODE", navigation: "NAVIGATE", destinationId: "F2", destinationName: "screenS3_detail",
                transition: { type: "SMART_ANIMATE", easing: "EASE_OUT", duration: 300 } }] },
    { frameId: "F1", sourceNodeId: "u1", sourceNodeName: "weird", trigger: {}, actions: [{ type: "MYSTERY" }] },
    { frameId: "F2", sourceNodeId: "x", sourceNodeName: "x", trigger: { type: "ON_CLICK" }, actions: [{ type: "BACK" }] },
  ],
  truncated: false,
};

describe("buildInteractionSpec", () => {
  it("maps actions, filters to designated screens, flags missing + unsupported", () => {
    const spec = buildInteractionSpec(flow, ["F1", "F404"]);

    expect(spec.schemaVersion).toBe("1.0");
    expect(spec.page).toEqual({ id: "0:1", name: "Flow" });
    expect(spec.requestedScreens).toEqual(["F1", "F404"]);
    expect(spec.missingScreens).toEqual(["F404"]);
    expect(spec.truncated).toBe(false);

    expect(spec.screens.map((s) => s.id)).toEqual(["F1"]);
    const f1 = spec.screens[0]!;
    expect(f1.name).toBe("screenS3_01");

    const byName = Object.fromEntries(f1.interactions.map((i) => [i.source.name, i]));
    expect(byName["button01"]!.actions).toEqual([
      { type: "setVariable", variable: "screenS3_01-bg", value: "#000000" },
    ]);
    expect(byName["card"]!.actions).toEqual([
      { type: "navigate", to: { id: "F2", name: "screenS3_detail" },
        transition: { type: "SMART_ANIMATE", easing: "EASE_OUT", duration: 300 } },
    ]);
    expect(byName["weird"]!.actions).toEqual([]);
    expect(spec.unsupported).toEqual([
      { source: { id: "u1", name: "weird" }, reason: "unknown action type: MYSTERY", raw: { type: "MYSTERY" } },
    ]);
  });

  it("maps the remaining action types (back/url/scroll/overlay/swap/close/changeVariant/toggle)", () => {
    const f = (action: unknown) => ({
      page: { id: "0:1", name: "P" },
      frames: [{ id: "S", name: "S", isStartFrame: false }],
      interactions: [{ frameId: "S", sourceNodeId: "n", sourceNodeName: "n", trigger: {}, actions: [action] }],
      truncated: false,
    });
    const only = (action: unknown) => buildInteractionSpec(f(action), ["S"]).screens[0]!.interactions[0]!.actions[0];

    expect(only({ type: "BACK" })).toEqual({ type: "back" });
    expect(only({ type: "CLOSE" })).toEqual({ type: "closeOverlay" });
    expect(only({ type: "URL", url: "https://x.com", openInNewTab: true }))
      .toEqual({ type: "openUrl", url: "https://x.com", openInNewTab: true });
    expect(only({ type: "toggle_variable", variable: "dark" })).toEqual({ type: "toggleVariable", variable: "dark" });
    expect(only({ type: "NODE", navigation: "SCROLL_TO", destinationId: "d", destinationName: "sec" }))
      .toEqual({ type: "scrollTo", to: { id: "d", name: "sec" }, transition: undefined });
    expect(only({ type: "NODE", navigation: "OVERLAY", destinationId: "o", destinationName: "menu", transition: { type: "DISSOLVE" } }))
      .toEqual({ type: "openOverlay", to: { id: "o", name: "menu" }, transition: { type: "DISSOLVE" } });
    expect(only({ type: "NODE", navigation: "SWAP", destinationId: "o2", destinationName: "m2" }))
      .toEqual({ type: "swapOverlay", to: { id: "o2", name: "m2" }, transition: undefined });
    expect(only({ type: "NODE", navigation: "CHANGE_TO", destinationId: "v", destinationName: "variantB" }))
      .toEqual({ type: "changeVariant", to: { id: "v", name: "variantB" } });
  });

  it("maps conditional with then/else and a compound condition", () => {
    const flow2 = {
      page: { id: "0:1", name: "P" },
      frames: [{ id: "S", name: "S", isStartFrame: false }],
      interactions: [{ frameId: "S", sourceNodeId: "n", sourceNodeName: "n", trigger: {},
        actions: [{ type: "CONDITIONAL",
          condition: { all: [{ variable: "a", operator: "==", value: 1 }, { variable: "b", operator: ">", value: 2 }] },
          then: [{ type: "NODE", navigation: "OVERLAY", destinationId: "o", destinationName: "menu", transition: { type: "DISSOLVE" } }],
          else: [{ type: "CLOSE" }] }] }],
      truncated: false,
    };
    const action = buildInteractionSpec(flow2, ["S"]).screens[0]!.interactions[0]!.actions[0];
    expect(action).toEqual({
      type: "conditional",
      if: { all: [{ variable: "a", operator: "==", value: 1 }, { variable: "b", operator: ">", value: 2 }] },
      then: [{ type: "openOverlay", to: { id: "o", name: "menu" }, transition: { type: "DISSOLVE" } }],
      else: [{ type: "closeOverlay" }],
    });
  });

  it("flags a non-standard conditional (raw, no condition) as unsupported", () => {
    const flow3 = {
      page: { id: "0:1", name: "P" },
      frames: [{ id: "S", name: "S", isStartFrame: false }],
      interactions: [{ frameId: "S", sourceNodeId: "n", sourceNodeName: "node", trigger: {},
        actions: [{ type: "CONDITIONAL", raw: [{ foo: 1 }] }] }],
      truncated: false,
    };
    const spec = buildInteractionSpec(flow3, ["S"]);
    expect(spec.screens[0]!.interactions[0]!.actions).toEqual([]);
    expect(spec.unsupported).toEqual([
      { source: { id: "n", name: "node" }, reason: "non-standard conditional",
        raw: { type: "CONDITIONAL", raw: [{ foo: 1 }] } },
    ]);
  });

  it("maps multiple actions of a single reaction", () => {
    const flowMulti = {
      page: { id: "0:1", name: "P" },
      frames: [{ id: "S", name: "S", isStartFrame: false }],
      interactions: [{ frameId: "S", sourceNodeId: "n", sourceNodeName: "node", trigger: { type: "ON_CLICK" },
        actions: [
          { type: "set_variable", variable: "bg", value: "#000000" },
          { type: "NODE", navigation: "NAVIGATE", destinationId: "F2", destinationName: "next" },
        ] }],
      truncated: false,
    };
    const entry = buildInteractionSpec(flowMulti, ["S"]).screens[0]!.interactions[0]!;
    expect(entry.actions).toEqual([
      { type: "setVariable", variable: "bg", value: "#000000" },
      { type: "navigate", to: { id: "F2", name: "next" }, transition: undefined },
    ]);
  });
});

describe("interaction-spec overlay normalization", () => {
  // RawFlow shape: interactions keyed by frameId + sourceNodeId/sourceNodeName
  // (matches buildInteractionSpec(flow, screenIds), confirmed against the builder).
  const flow = {
    page: { id: "p", name: "P" },
    frames: [{ id: "1:1", name: "Home" }, { id: "1:2", name: "Sheet" }],
    interactions: [
      { frameId: "1:1", sourceNodeId: "n1", sourceNodeName: "Open", trigger: { type: "ON_CLICK" }, actions: [
        { type: "NODE", navigation: "OVERLAY", destinationId: "1:2", destinationName: "Sheet",
          overlayPositionType: "BOTTOM_CENTER", overlayBackground: "SOLID_COLOR",
          overlayBackgroundInteraction: "CLOSE_ON_CLICK_OUTSIDE" },
      ] },
    ],
    truncated: false,
  };
  it("maps overlayPositionType/background/interaction to canonical OverlayMeta", () => {
    const spec = buildInteractionSpec(flow as any, ["1:1", "1:2"]);
    const act: any = spec.screens.find((s) => s.id === "1:1")!.interactions[0]!.actions[0];
    expect(act.type).toBe("openOverlay");
    expect(act.overlay).toEqual({ style: "sheet", scrim: true, dismissable: true });
  });
  it("CENTER → dialog; missing position → overlay undefined", () => {
    const f2 = JSON.parse(JSON.stringify(flow));
    f2.interactions[0].actions[0].overlayPositionType = "CENTER";
    const a1: any = buildInteractionSpec(f2 as any, ["1:1","1:2"]).screens[0]!.interactions[0]!.actions[0];
    expect(a1.overlay.style).toBe("dialog");
    const f3 = JSON.parse(JSON.stringify(flow));
    delete f3.interactions[0].actions[0].overlayPositionType;
    const a2: any = buildInteractionSpec(f3 as any, ["1:1","1:2"]).screens[0]!.interactions[0]!.actions[0];
    expect(a2.overlay).toBeUndefined();
  });
});
