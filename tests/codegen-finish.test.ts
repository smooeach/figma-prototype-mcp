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
