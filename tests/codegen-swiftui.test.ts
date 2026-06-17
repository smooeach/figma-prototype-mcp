import { describe, it, expect } from "vitest";
import { emitSwiftUI, screenCase, swiftIdent } from "../src/codegen/emitters/swiftui.js";

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

describe("swiftIdent", () => {
  it("prefixes digit/empty starts so the func name is a valid Swift identifier", () => {
    expect(swiftIdent("1:2")).toBe("n1_2"); // node id, no source name
    expect(swiftIdent("2ndButton")).toBe("n2ndButton"); // name starting with a digit
    expect(swiftIdent("GoDetail")).toBe("GoDetail"); // already valid — untouched
    expect(/^[A-Za-z]/.test(swiftIdent(""))).toBe(true);
  });
});

describe("screenCase", () => {
  it("lowercases the first char", () => {
    expect(screenCase("Screen02")).toBe("screen02");
    expect(screenCase("Home")).toBe("home");
  });
});

describe("emitSwiftUI", () => {
  const files = emitSwiftUI(SPEC as any);
  const f = (p: string) => files.find((x) => x.path === p)!.content;

  it("returns the Swift file set (no actions file for empty screens)", () => {
    expect(files.map((x) => x.path).sort()).toEqual(
      ["HomeActions.swift", "PrototypeStore.swift", "README.md", "Router.swift"].sort(),
    );
  });
  it("Router.swift has a Screen enum case per frame + Router class", () => {
    const r = f("Router.swift");
    expect(r).toContain("enum Screen: Hashable");
    expect(r).toContain("case home");
    expect(r).toContain("case detail");
    expect(r).toContain("final class Router: ObservableObject");
    expect(r).toContain("func goBack()");
  });
  it("Actions file maps navigate/openUrl/conditional/back", () => {
    const a = f("HomeActions.swift");
    expect(a).toContain("enum HomeActions");
    expect(a).toContain("static func goDetail(router: Router, store: PrototypeStore)");
    expect(a).toContain("router.navigate(.detail)");
    expect(a).toContain("UIApplication.shared.open(url)");
    expect(a).toContain("if ((store.vars[\"isOpen\"] as? Bool) ?? false) == true");
    expect(a).toContain("router.goBack()");
  });
  it("PrototypeStore lists collected variables; README has iOS wiring", () => {
    expect(f("PrototypeStore.swift")).toContain('"isOpen"');
    expect(f("README.md")).toContain("NavigationStack");
  });
});

describe("emitSwiftUI unknown navigate target", () => {
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
  it("comments out navigate to a screen not in the enum (so Swift still compiles)", () => {
    const files = emitSwiftUI(SPEC2 as any);
    const a = files.find((x) => x.path === "HomeActions.swift")!.content;
    expect(a).toContain("// TODO: target \"Elsewhere\" is not in the Screen enum");
    expect(a).toContain("// router.navigate(.elsewhere)");
    expect(a).not.toMatch(/^\s*router\.navigate\(\.elsewhere\)/m); // not an active (uncommented) call
  });
});

describe("emitSwiftUI source without a name", () => {
  const SPEC3 = {
    schemaVersion: "1.0" as const,
    page: { id: "p", name: "P" },
    screens: [
      { id: "1:1", name: "Home", interactions: [
        { source: { id: "1:2" }, trigger: { type: "ON_CLICK" },
          actions: [{ type: "back" }] },
      ] },
    ],
    requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
  };
  it("derives a valid Swift func name from a digit-leading node id (no name)", () => {
    const a = emitSwiftUI(SPEC3 as any).find((x) => x.path === "HomeActions.swift")!.content;
    expect(a).toContain("static func n1_2(router: Router, store: PrototypeStore)");
    expect(a).not.toMatch(/static func 1_2\(/); // would not compile in Swift
  });
});
