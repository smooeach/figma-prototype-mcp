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
  it("escapes `$` in a URL so Kotlin does not string-interpolate it", () => {
    const spec = {
      schemaVersion: "1.0" as const, page: { id: "p", name: "P" },
      screens: [{ id: "1:1", name: "Home", interactions: [
        { source: { id: "n1", name: "Site" }, trigger: { type: "ON_CLICK" },
          actions: [{ type: "openUrl", url: "https://x.com/?u=$id" }] },
      ] }],
      requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
    };
    const actions = emitCompose(spec as any).find((f) => f.path === "HomeActions.kt")!.content;
    expect(actions).toContain('router.onOpenUri("https://x.com/?u=\\$id")'); // \$ — not interpolated
    expect(actions).not.toContain('?u=$id"'); // never the bare, interpolating form
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

// Frame named to collide with a real keyword in THAT language once lower-cased.
// `switch` is reserved in Swift & Dart but NOT in Kotlin (which uses `when`), so Kotlin
// uses `When` instead. `Class` is a keyword in all three → guards the func name everywhere.
const keywordSpec = (frame: string) => ({
  schemaVersion: "1.0" as const,
  page: { id: "p", name: "P" },
  screens: [
    { id: "1:1", name: frame, interactions: [
      { source: { id: "n1", name: "Class" }, trigger: { type: "ON_CLICK" }, actions: [{ type: "back" }] },
    ] },
  ],
  requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
});

describe("reserved-word guard", () => {
  it("SwiftUI: keyword enum case and func name get a trailing underscore", () => {
    const files = emitSwiftUI(keywordSpec("Switch") as any);
    const router = files.find((f) => f.path === "Router.swift")!.content;
    const actions = files.find((f) => f.path === "SwitchActions.swift")!.content;
    expect(router).toContain("case switch_"); // not `case switch`
    expect(actions).toContain("func class_(");
  });
  it("Compose: keyword route + fun name get a trailing underscore", () => {
    const files = emitCompose(keywordSpec("When") as any); // `when` is the Kotlin keyword, not `switch`
    const router = files.find((f) => f.path === "Router.kt")!.content;
    const actions = files.find((f) => f.path === "WhenActions.kt")!.content;
    expect(router).toContain('Screen("when_")'); // route string guarded
    expect(actions).toContain("fun class_(");
  });
  it("Compose: `switch` is a valid Kotlin identifier (NOT guarded)", () => {
    const router = emitCompose(keywordSpec("Switch") as any).find((f) => f.path === "Router.kt")!.content;
    expect(router).toContain('Screen("switch")'); // no trailing underscore — switch is fine in Kotlin
  });
  it("Flutter: keyword enum value + fn name get a trailing underscore (+ values/index)", () => {
    const files = emitFlutter(keywordSpec("Switch") as any);
    const router = files.find((f) => f.path === "router.dart")!.content;
    const actions = files.find((f) => f.path === "switch_actions.dart")!.content;
    expect(router).toContain("switch_"); // enum value guarded (not bare `switch`)
    expect(actions).toContain("void class_(");
  });
});

const variantSpec = {
  schemaVersion: "1.0" as const,
  page: { id: "p", name: "P" },
  screens: [
    { id: "1:1", name: "Home", interactions: [
      { source: { id: "n1", name: "Toggle" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "changeVariant", to: { id: "9:9", name: "State=On" } }] },
    ] },
  ],
  requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
};
const variantActions = (files: { path: string; content: string }[]) =>
  files.find((f) => f.path === "HomeActions.swift" || f.path === "HomeActions.kt" ||
    f.path === "home_actions.dart" || f.path === "interactions/Home.ts")!.content;

describe("changeVariant guide stub (names the target variant)", () => {
  it("SwiftUI", () => {
    expect(variantActions(emitSwiftUI(variantSpec as any))).toContain('change to variant "State=On"');
  });
  it("Compose", () => {
    expect(variantActions(emitCompose(variantSpec as any))).toContain('change to variant "State=On"');
  });
  it("Flutter", () => {
    expect(variantActions(emitFlutter(variantSpec as any))).toContain('change to variant "State=On"');
  });
  it("React", () => {
    expect(variantActions(emitReact(variantSpec as any))).toContain('change to variant "State=On"');
  });
  it("React Native", () => {
    expect(variantActions(emitReactNative(variantSpec as any))).toContain('change to variant "State=On"');
  });
});
