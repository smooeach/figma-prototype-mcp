import { describe, it, expect } from "vitest";
import { emitCompose, camelCase, kotlinIdent } from "../src/codegen/emitters/compose.js";

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

describe("camelCase", () => {
  it("lowercases the first char", () => {
    expect(camelCase("Home")).toBe("home");
    expect(camelCase("Screen02")).toBe("screen02");
  });
});

describe("kotlinIdent", () => {
  it("prefixes digit/empty starts so the fun name is a valid Kotlin identifier", () => {
    expect(kotlinIdent("1:2")).toBe("n1_2");
    expect(kotlinIdent("2ndButton")).toBe("n2ndButton");
    expect(kotlinIdent("GoDetail")).toBe("GoDetail");
    expect(/^[A-Za-z]/.test(kotlinIdent(""))).toBe(true);
  });
});

describe("emitCompose", () => {
  const files = emitCompose(SPEC as any);
  const f = (p: string) => files.find((x) => x.path === p)!.content;

  it("returns the Kotlin file set (no actions file for empty screens)", () => {
    expect(files.map((x) => x.path).sort()).toEqual(
      ["HomeActions.kt", "PrototypeStore.kt", "README.md", "Router.kt"].sort(),
    );
  });
  it("Router.kt has a sealed Screen object per frame + Router class", () => {
    const r = f("Router.kt");
    expect(r).toContain("sealed class Screen(val route: String)");
    expect(r).toContain('object Home : Screen("home")');
    expect(r).toContain('object Detail : Screen("detail")');
    expect(r).toContain("class Router(");
    expect(r).toContain("fun goBack()");
  });
  it("Actions file maps navigate/openUrl/conditional/back", () => {
    const a = f("HomeActions.kt");
    expect(a).toContain("object HomeActions");
    expect(a).toContain("fun goDetail(router: Router, store: PrototypeStore)");
    expect(a).toContain("router.navigate(Screen.Detail)");
    expect(a).toContain("// TODO: open URL");
    expect(a).toContain('if (((store.vars["isOpen"] as? Boolean) ?: false) == true)');
    expect(a).toContain("router.goBack()");
  });
  it("PrototypeStore lists collected variables; README has Compose wiring", () => {
    expect(f("PrototypeStore.kt")).toContain('"isOpen"');
    expect(f("README.md")).toContain("NavHost");
  });
});

describe("emitCompose unknown navigate target", () => {
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
  it("comments out navigate to a screen not in the graph (so Kotlin still compiles)", () => {
    const a = emitCompose(SPEC2 as any).find((x) => x.path === "HomeActions.kt")!.content;
    expect(a).toContain('// TODO: target "Elsewhere" is not in the Screen graph');
    expect(a).toContain("// router.navigate(Screen.Elsewhere)");
    expect(a).not.toMatch(/^\s*router\.navigate\(Screen\.Elsewhere\)/m);
  });
});

describe("emitCompose source without a name", () => {
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
  it("derives a valid Kotlin fun name from a digit-leading node id (no name)", () => {
    const a = emitCompose(SPEC3 as any).find((x) => x.path === "HomeActions.kt")!.content;
    expect(a).toContain("fun n1_2(router: Router, store: PrototypeStore)");
    expect(a).not.toMatch(/fun 1_2\(/);
  });
});

describe("emitCompose conditional with else / numeric compare", () => {
  const SPEC4 = {
    schemaVersion: "1.0" as const,
    page: { id: "p", name: "P" },
    screens: [
      { id: "1:1", name: "Home", interactions: [
        { source: { id: "n1", name: "Toggle" }, trigger: { type: "ON_CLICK" },
          actions: [{ type: "conditional", if: { variable: "count", operator: "==", value: 3 },
                      then: [{ type: "back" }], else: [{ type: "setVariable", variable: "isOpen", value: true }] }] },
      ] },
    ],
    requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
  };
  it("emits `} else {` on one line and a Double literal for numeric equality", () => {
    const a = emitCompose(SPEC4 as any).find((x) => x.path === "HomeActions.kt")!.content;
    expect(a).toContain("} else {");
    expect(a).not.toMatch(/^\s*else \{/m); // never a bare `else {` on its own line
    // numeric literal must be Double (3.0) so it compiles against the `as? Double` cast
    expect(a).toContain('((store.vars["count"] as? Double) ?: 0.0) == 3.0');
    expect(a).toContain('store.set("isOpen", true)');
  });
});
