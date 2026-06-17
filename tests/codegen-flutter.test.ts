import { describe, it, expect } from "vitest";
import { emitFlutter, dartCase, snakeCase, dartIdent } from "../src/codegen/emitters/flutter.js";

const SPEC = {
  schemaVersion: "1.0" as const,
  page: { id: "p", name: "P" },
  screens: [
    { id: "1:1", name: "Home", interactions: [
      { source: { id: "n1", name: "GoDetail" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "navigate", to: { id: "1:2", name: "Detail" } }] },
      { source: { id: "n2", name: "Open" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "openUrl", url: "https://x.com" }] },
      { source: { id: "n3", name: "Guard" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "conditional", if: { variable: "isOpen", operator: "==", value: true },
                    then: [{ type: "back" }] }] },
    ] },
    { id: "1:2", name: "Detail", interactions: [] },
  ],
  requestedScreens: ["1:1", "1:2"], missingScreens: [], unsupported: [], truncated: false,
};

describe("dartCase / snakeCase", () => {
  it("dartCase lowercases first char; snakeCase splits camelCase", () => {
    expect(dartCase("Home")).toBe("home");
    expect(snakeCase("HomeScreen")).toBe("home_screen");
  });
});

describe("dartIdent", () => {
  it("prefixes digit/empty starts so the function name is a valid Dart identifier", () => {
    expect(dartIdent("1:2")).toBe("n1_2");
    expect(dartIdent("2ndButton")).toBe("n2ndButton");
    expect(dartIdent("GoDetail")).toBe("GoDetail");
    expect(/^[A-Za-z]/.test(dartIdent(""))).toBe(true);
  });
});

describe("emitFlutter", () => {
  const files = emitFlutter(SPEC as any);
  const f = (p: string) => files.find((x) => x.path === p)!.content;

  it("returns the Dart file set (snake_case actions; empty screens skipped)", () => {
    expect(files.map((x) => x.path).sort()).toEqual(
      ["home_actions.dart", "prototype_store.dart", "README.md", "router.dart"].sort(),
    );
  });
  it("router.dart has a Screen enum value per frame + ProtoRouter class", () => {
    const r = f("router.dart");
    expect(r).toContain("enum Screen { home, detail }");
    expect(r).toContain("class ProtoRouter"); // not "Router" — avoids colliding with Flutter's Router widget
    expect(r).toContain("void goBack()");
  });
  it("Actions file maps navigate/openUrl/conditional/back", () => {
    const a = f("home_actions.dart");
    expect(a).toContain("void goDetail(ProtoRouter router, PrototypeStore store)");
    expect(a).toContain("router.navigate(Screen.detail)");
    expect(a).toContain('launchUrl(Uri.parse("https://x.com"));');
    expect(a).toContain('if ((store.vars["isOpen"] is bool ? store.vars["isOpen"] as bool : false) == true)');
    expect(a).toContain("router.goBack();");
  });
  it("PrototypeStore lists collected variables; README has Flutter wiring", () => {
    expect(f("prototype_store.dart")).toContain('"isOpen"');
    expect(f("README.md")).toContain("MaterialApp.router");
  });
});

describe("emitFlutter unknown navigate target", () => {
  const SPEC2 = {
    schemaVersion: "1.0" as const,
    page: { id: "p", name: "P" },
    screens: [
      { id: "1:1", name: "Home", interactions: [
        { source: { id: "n1", name: "Go" }, trigger: { type: "ON_CLICK" },
          actions: [{ type: "navigate", to: { id: "9:9", name: "Elsewhere" } }] },
      ] },
    ],
    requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
  };
  it("comments out navigate to a screen not in the enum (so Dart still compiles)", () => {
    const a = emitFlutter(SPEC2 as any).find((x) => x.path === "home_actions.dart")!.content;
    expect(a).toContain('// TODO: target "Elsewhere" is not in the Screen enum');
    expect(a).toContain("// router.navigate(Screen.elsewhere)");
    expect(a).not.toMatch(/^\s*router\.navigate\(Screen\.elsewhere\)/m);
  });
});

describe("emitFlutter source without a name", () => {
  const SPEC3 = {
    schemaVersion: "1.0" as const,
    page: { id: "p", name: "P" },
    screens: [
      { id: "1:1", name: "Home", interactions: [
        { source: { id: "1:2" }, trigger: { type: "ON_CLICK" }, actions: [{ type: "back" }] },
      ] },
    ],
    requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
  };
  it("derives a valid Dart function name from a digit-leading node id (no name)", () => {
    const a = emitFlutter(SPEC3 as any).find((x) => x.path === "home_actions.dart")!.content;
    expect(a).toContain("void n1_2(ProtoRouter router, PrototypeStore store)");
    expect(a).not.toMatch(/void 1_2\(/);
  });
});

describe("emitFlutter conditional with else", () => {
  const SPEC4 = {
    schemaVersion: "1.0" as const,
    page: { id: "p", name: "P" },
    screens: [
      { id: "1:1", name: "Home", interactions: [
        { source: { id: "n1", name: "Toggle" }, trigger: { type: "ON_CLICK" },
          actions: [{ type: "conditional", if: { variable: "isOpen", operator: "==", value: true },
                      then: [{ type: "back" }], else: [{ type: "setVariable", variable: "isOpen", value: true }] }] },
      ] },
    ],
    requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
  };
  it("emits `} else {` on one line (no fragile newline before else)", () => {
    const a = emitFlutter(SPEC4 as any).find((x) => x.path === "home_actions.dart")!.content;
    expect(a).toContain("} else {");
    expect(a).not.toMatch(/^\s*else \{/m); // never a bare `else {` on its own line
    expect(a).toContain('store.set("isOpen", true);');
  });
});
