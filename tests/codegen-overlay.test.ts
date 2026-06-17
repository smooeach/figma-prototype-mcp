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
