import { describe, it, expect } from "vitest";
import { z } from "zod";
import { COMPARISON_OPERATOR_MAP } from "../src/figma-plugin/condition-codec.js";
import {
  TRIGGER_SHORTCUTS,
  TRIGGER_NOPARAM_TYPES,
  MOUSE_CLICK_TYPES,
  MOUSE_HOVER_TYPES,
  KEYBOARD_DEVICES,
  TRANSITION_SHORTCUTS,
  SIMPLE_TRANSITION_TYPES,
  DIRECTIONAL_TRANSITION_TYPES,
  NAMED_EASINGS,
  DIRECTIONS,
  COMPARISON_OPERATORS,
  OVERFLOW_DIRECTIONS,
} from "../src/shared/wire-vocabulary.js";

describe("wire-vocabulary member snapshots", () => {
  it("triggers", () => {
    expect([...TRIGGER_SHORTCUTS]).toEqual(["ON_CLICK", "ON_HOVER", "ON_PRESS", "AFTER_TIMEOUT"]);
    expect([...TRIGGER_NOPARAM_TYPES]).toEqual(["ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG", "ON_MEDIA_END"]);
    expect([...MOUSE_CLICK_TYPES]).toEqual(["MOUSE_UP", "MOUSE_DOWN"]);
    expect([...MOUSE_HOVER_TYPES]).toEqual(["MOUSE_ENTER", "MOUSE_LEAVE"]);
    expect([...KEYBOARD_DEVICES]).toEqual(["KEYBOARD", "XBOX_ONE", "PS4", "SWITCH_PRO", "UNKNOWN_CONTROLLER"]);
  });

  it("transitions", () => {
    expect([...TRANSITION_SHORTCUTS]).toEqual(["INSTANT", "DISSOLVE", "SMART_ANIMATE"]);
    expect([...SIMPLE_TRANSITION_TYPES]).toEqual(["DISSOLVE", "SMART_ANIMATE", "SCROLL_ANIMATE"]);
    expect([...DIRECTIONAL_TRANSITION_TYPES]).toEqual(["MOVE_IN", "MOVE_OUT", "PUSH", "SLIDE_IN", "SLIDE_OUT"]);
    expect([...NAMED_EASINGS]).toEqual([
      "LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT",
      "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK",
      "GENTLE", "QUICK", "BOUNCY", "SLOW",
    ]);
    expect([...DIRECTIONS]).toEqual(["LEFT", "RIGHT", "TOP", "BOTTOM"]);
  });

  it("other vocabularies", () => {
    expect([...COMPARISON_OPERATORS]).toEqual(["==", "!=", "<", "<=", ">", ">="]);
    expect([...OVERFLOW_DIRECTIONS]).toEqual(["NONE", "HORIZONTAL", "VERTICAL", "BOTH"]);
  });
});

describe("wire-vocabulary feeds z.enum", () => {
  it("accepts every member and rejects a bad value", () => {
    const e = z.enum(TRIGGER_SHORTCUTS);
    for (const v of TRIGGER_SHORTCUTS) expect(e.parse(v)).toBe(v);
    expect(() => e.parse("NOT_A_TRIGGER")).toThrow();
  });
});

describe("cross-side conformance: shared source reaches both sides", () => {
  it("the plugin operator-translation map covers exactly the shared operators", () => {
    expect(Object.keys(COMPARISON_OPERATOR_MAP).sort()).toEqual([...COMPARISON_OPERATORS].sort());
  });

  it("every shared comparison operator translates to a non-empty Figma function", () => {
    for (const op of COMPARISON_OPERATORS) {
      expect(typeof COMPARISON_OPERATOR_MAP[op]).toBe("string");
      expect(COMPARISON_OPERATOR_MAP[op].length).toBeGreaterThan(0);
    }
  });
});
