import { describe, it, expect } from "vitest";
import { emitSwiftUI } from "../src/codegen/emitters/swiftui.js";

const overlaySpec = (overlay: any) => ({
  schemaVersion: "1.0" as const,
  page: { id: "p", name: "P" },
  screens: [
    { id: "1:1", name: "Home", interactions: [
      { source: { id: "n1", name: "Open" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "openOverlay", to: { id: "1:2", name: "Sheet" }, overlay }] },
      { source: { id: "n2", name: "Close" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "closeOverlay" }] },
    ] },
    { id: "1:2", name: "Sheet", interactions: [] },
  ],
  requestedScreens: ["1:1","1:2"], missingScreens: [], unsupported: [], truncated: false,
});

describe("emitSwiftUI overlay", () => {
  it("presents a sheet overlay and dismisses it (1급 presentation, not navigate)", () => {
    const files = emitSwiftUI(overlaySpec({ style: "sheet", scrim: true, dismissable: true }) as any);
    const router = files.find((f) => f.path === "Router.swift")!.content;
    const actions = files.find((f) => f.path === "HomeActions.swift")!.content;
    expect(router).toContain("var overlay: OverlayPresentation?");
    expect(router).toContain("func presentOverlay(");
    expect(router).toContain("func dismissOverlay()");
    expect(actions).toContain("router.presentOverlay(.sheet, screen: .sheet, dismissable: true)");
    expect(actions).toContain("router.dismissOverlay()");
    expect(actions).not.toContain("router.navigate(.sheet)"); // overlay is NOT a navigate anymore
  });
  it("maps a CENTER overlay to dialog style", () => {
    const files = emitSwiftUI(overlaySpec({ style: "dialog", scrim: true, dismissable: false }) as any);
    const actions = files.find((f) => f.path === "HomeActions.swift")!.content;
    expect(actions).toContain("router.presentOverlay(.dialog, screen: .sheet, dismissable: false)");
  });
  it("falls back to sheet when overlay meta is absent", () => {
    const files = emitSwiftUI(overlaySpec(undefined) as any);
    const actions = files.find((f) => f.path === "HomeActions.swift")!.content;
    expect(actions).toContain("router.presentOverlay(.sheet, screen: .sheet, dismissable: true)");
  });
});

import { emitCompose } from "../src/codegen/emitters/compose.js";

describe("emitCompose overlay", () => {
  it("presents/dismisses an overlay via Router state (not navigate)", () => {
    const files = emitCompose(overlaySpec({ style: "sheet", scrim: true, dismissable: true }) as any);
    const router = files.find((f) => f.path === "Router.kt")!.content;
    const actions = files.find((f) => f.path === "HomeActions.kt")!.content;
    expect(router).toContain("var overlay by mutableStateOf<OverlayPresentation?>(null)");
    expect(router).toContain("fun presentOverlay(");
    expect(router).toContain("fun dismissOverlay()");
    expect(actions).toContain("router.presentOverlay(OverlayStyle.Sheet, Screen.Sheet, true)");
    expect(actions).toContain("router.dismissOverlay()");
  });
  it("maps CENTER → Dialog and respects dismissable=false", () => {
    const files = emitCompose(overlaySpec({ style: "dialog", scrim: true, dismissable: false }) as any);
    const actions = files.find((f) => f.path === "HomeActions.kt")!.content;
    expect(actions).toContain("router.presentOverlay(OverlayStyle.Dialog, Screen.Sheet, false)");
  });
});

import { emitFlutter } from "../src/codegen/emitters/flutter.js";

describe("emitFlutter overlay", () => {
  it("presents/dismisses an overlay imperatively via navigatorKey", () => {
    const files = emitFlutter(overlaySpec({ style: "sheet", scrim: true, dismissable: true }) as any);
    const router = files.find((f) => f.path === "router.dart")!.content;
    const actions = files.find((f) => f.path === "home_actions.dart")!.content;
    expect(router).toContain("void presentOverlay(");
    expect(router).toContain("void dismissOverlay()");
    expect(router).toContain("showModalBottomSheet");
    expect(router).toContain("showDialog");
    expect(actions).toContain("router.presentOverlay(Screen.sheet, OverlayStyle.sheet, true)");
    expect(actions).toContain("router.dismissOverlay()");
  });
  it("maps CENTER → dialog style and dismissable=false", () => {
    const files = emitFlutter(overlaySpec({ style: "dialog", scrim: true, dismissable: false }) as any);
    const actions = files.find((f) => f.path === "home_actions.dart")!.content;
    expect(actions).toContain("router.presentOverlay(Screen.sheet, OverlayStyle.dialog, false)");
  });
});

import { emitReact } from "../src/codegen/emitters/react.js";

describe("emitReact overlay", () => {
  it("presents/dismisses overlay via the store (not navigate(-1))", () => {
    const files = emitReact(overlaySpec({ style: "sheet", scrim: true, dismissable: true }) as any);
    const store = files.find((f) => f.path === "prototype-store.tsx")!.content;
    const hook = files.find((f) => f.path === "interactions/Home.ts")!.content;
    expect(store).toContain("overlay");
    expect(store).toContain("presentOverlay");
    expect(store).toContain("dismissOverlay");
    expect(hook).toContain('presentOverlay({ screen: "Sheet", style: "sheet", dismissable: true });');
    expect(hook).toContain("dismissOverlay();");
  });
  it("maps CENTER → dialog and dismissable=false", () => {
    const files = emitReact(overlaySpec({ style: "dialog", scrim: true, dismissable: false }) as any);
    const hook = files.find((f) => f.path === "interactions/Home.ts")!.content;
    expect(hook).toContain('presentOverlay({ screen: "Sheet", style: "dialog", dismissable: false });');
  });
});

import { emitReactNative } from "../src/codegen/emitters/react-native.js";

describe("emitReactNative overlay", () => {
  it("presents/dismisses overlay via the shared store (not navigate)", () => {
    const files = emitReactNative(overlaySpec({ style: "sheet", scrim: true, dismissable: true }) as any);
    const hook = files.find((f) => f.path === "interactions/Home.ts")!.content;
    expect(hook).toContain('presentOverlay({ screen: "Sheet", style: "sheet", dismissable: true });');
    expect(hook).toContain("dismissOverlay();");
  });
  it("maps CENTER → dialog and dismissable=false", () => {
    const files = emitReactNative(overlaySpec({ style: "dialog", scrim: true, dismissable: false }) as any);
    const hook = files.find((f) => f.path === "interactions/Home.ts")!.content;
    expect(hook).toContain('presentOverlay({ screen: "Sheet", style: "dialog", dismissable: false });');
  });
});

// --- review fixes: shared store ReactNode import + overlay unknown-target TODO ---

const unknownOverlaySpec = {
  schemaVersion: "1.0" as const,
  page: { id: "p", name: "P" },
  screens: [
    { id: "1:1", name: "Home", interactions: [
      { source: { id: "n1", name: "Open" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "openOverlay", to: { id: "9:9", name: "Ghost" }, overlay: { style: "sheet", scrim: true, dismissable: true } }] },
    ] },
  ],
  requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
};

describe("overlay review fixes", () => {
  it("React shared store imports ReactNode (not the React.* namespace)", () => {
    const store = emitReact(overlaySpec({ style: "sheet", scrim: true, dismissable: true }) as any)
      .find((f) => f.path === "prototype-store.tsx")!.content;
    expect(store).toContain("type ReactNode");
    expect(store).not.toContain("React.ReactNode");
  });
  it("React comments out an overlay to a target not in the routes", () => {
    const hook = emitReact(unknownOverlaySpec as any).find((f) => f.path === "interactions/Home.ts")!.content;
    expect(hook).toContain('// TODO: overlay target "Ghost" is not in the generated routes');
  });
  it("React Native comments out an overlay to a target not in the navigator", () => {
    const hook = emitReactNative(unknownOverlaySpec as any).find((f) => f.path === "interactions/Home.ts")!.content;
    expect(hook).toContain('// TODO: overlay target "Ghost" is not in the generated navigator');
  });
});
