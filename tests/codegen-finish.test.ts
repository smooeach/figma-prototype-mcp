import { describe, it, expect } from "vitest";
import { emitSwiftUI } from "../src/codegen/emitters/swiftui.js";
import { emitCompose } from "../src/codegen/emitters/compose.js";
import { emitFlutter } from "../src/codegen/emitters/flutter.js";
import { emitReact } from "../src/codegen/emitters/react.js";
import { emitReactNative } from "../src/codegen/emitters/react-native.js";

const scrollSpec = {
  schemaVersion: "1.0" as const,
  page: { id: "p", name: "P" },
  screens: [
    { id: "1:1", name: "Home", interactions: [
      { source: { id: "n1", name: "Jump" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "scrollTo", to: { id: "5:5", name: "Section" } }] },
    ] },
  ],
  requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
};
const actionsFile = (files: { path: string; content: string }[], suffix: string) =>
  files.find((f) => f.path.includes("Actions") || f.path.includes("actions") || f.path.endsWith(suffix))!.content;

describe("scrollTo guide stub", () => {
  it("SwiftUI names the target node + ScrollViewReader", () => {
    const a = emitSwiftUI(scrollSpec as any).find((f) => f.path === "HomeActions.swift")!.content;
    expect(a).toContain('scroll to "Section"');
    expect(a).toContain("ScrollViewReader");
    expect(a).toContain('proxy.scrollTo("5:5")');
  });
  it("Compose names the target node + LazyListState", () => {
    const a = emitCompose(scrollSpec as any).find((f) => f.path === "HomeActions.kt")!.content;
    expect(a).toContain('scroll to "Section"');
    expect(a).toContain("animateScrollToItem");
  });
  it("Flutter names the target node + ScrollController", () => {
    const a = emitFlutter(scrollSpec as any).find((f) => f.path === "home_actions.dart")!.content;
    expect(a).toContain('scroll to "Section"');
    expect(a).toContain("ensureVisible");
  });
  it("React separates scrollTo from navigate and uses scrollIntoView (no navigate())", () => {
    const a = emitReact(scrollSpec as any).find((f) => f.path === "interactions/Home.ts")!.content;
    expect(a).toContain('scroll to "Section"');
    expect(a).toContain("scrollIntoView");
    expect(a).not.toContain("navigate("); // scrollTo must NOT emit a route navigation
  });
  it("React Native names the target node + ScrollView ref", () => {
    const a = emitReactNative(scrollSpec as any).find((f) => f.path === "interactions/Home.ts")!.content;
    expect(a).toContain('scroll to "Section"');
    expect(a).toContain("ref.scrollTo");
  });
});

const urlSpec = {
  schemaVersion: "1.0" as const,
  page: { id: "p", name: "P" },
  screens: [
    { id: "1:1", name: "Home", interactions: [
      { source: { id: "n1", name: "Site" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "openUrl", url: "https://x.com" }] },
    ] },
    { id: "1:2", name: "Plain", interactions: [
      { source: { id: "n2", name: "Go" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "back" }] },
    ] },
  ],
  requestedScreens: ["1:1", "1:2"], missingScreens: [], unsupported: [], truncated: false,
};

describe("openUrl Compose", () => {
  it("Router exposes onOpenUri and the action calls it", () => {
    const files = emitCompose(urlSpec as any);
    const router = files.find((f) => f.path === "Router.kt")!.content;
    const actions = files.find((f) => f.path === "HomeActions.kt")!.content;
    expect(router).toContain("var onOpenUri: (String) -> Unit = {}");
    expect(actions).toContain('router.onOpenUri("https://x.com")');
  });
});

describe("openUrl Flutter", () => {
  it("emits launchUrl and imports url_launcher only in files that use it", () => {
    const files = emitFlutter(urlSpec as any);
    const withUrl = files.find((f) => f.path === "home_actions.dart")!.content;
    const without = files.find((f) => f.path === "plain_actions.dart")!.content;
    expect(withUrl).toContain('launchUrl(Uri.parse("https://x.com"))');
    expect(withUrl).toContain("import 'package:url_launcher/url_launcher.dart';");
    expect(without).not.toContain("url_launcher"); // no unused import
  });
});

const keywordSpec = (target: "swift" | "kotlin" | "dart") => ({
  schemaVersion: "1.0" as const,
  page: { id: "p", name: "P" },
  // frame named to collide with a language keyword once lower-cased
  screens: [
    { id: "1:1", name: "Switch", interactions: [
      { source: { id: "n1", name: "Class" }, trigger: { type: "ON_CLICK" }, actions: [{ type: "back" }] },
    ] },
  ],
  requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
});

describe("reserved-word guard", () => {
  it("SwiftUI: keyword enum case and func name get a trailing underscore", () => {
    const files = emitSwiftUI(keywordSpec("swift") as any);
    const router = files.find((f) => f.path === "Router.swift")!.content;
    const actions = files.find((f) => f.path === "SwitchActions.swift")!.content;
    expect(router).toContain("case switch_"); // not `case switch`
    expect(actions).toContain("func class_(");
  });
  it("Compose: keyword route + fun name get a trailing underscore", () => {
    const files = emitCompose(keywordSpec("kotlin") as any);
    const router = files.find((f) => f.path === "Router.kt")!.content;
    const actions = files.find((f) => f.path === "SwitchActions.kt")!.content;
    expect(router).toContain('Screen("switch_")'); // route string guarded
    expect(actions).toContain("fun class_(");
  });
  it("Flutter: keyword enum value + fn name get a trailing underscore (+ values/index)", () => {
    const files = emitFlutter(keywordSpec("dart") as any);
    const router = files.find((f) => f.path === "router.dart")!.content;
    const actions = files.find((f) => f.path === "switch_actions.dart")!.content;
    expect(router).toContain("switch_"); // enum value guarded (not bare `switch`)
    expect(actions).toContain("void class_(");
  });
});
