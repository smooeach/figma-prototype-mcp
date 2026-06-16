import { describe, it, expect } from "vitest";
import { emitReactNative, mapTransitionRN } from "../src/codegen/emitters/react-native.js";

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

describe("mapTransitionRN", () => {
  it("maps types to native-stack animations", () => {
    expect(mapTransitionRN({ type: "DISSOLVE" })).toBe("fade");
    expect(mapTransitionRN({ type: "INSTANT" })).toBe("none");
    expect(mapTransitionRN(undefined)).toBe("default");
  });
});

describe("emitReactNative", () => {
  const files = emitReactNative(SPEC as any);
  const f = (p: string) => files.find((x) => x.path === p)!.content;

  it("returns the RN file set", () => {
    expect(files.map((x) => x.path).sort()).toEqual(
      ["README.md", "interactions/Home.ts", "navigation.tsx", "prototype-store.tsx"].sort(),
    );
  });
  it("navigation.tsx uses native-stack with a screen per frame + initialRouteName", () => {
    const nav = f("navigation.tsx");
    expect(nav).toContain("createNativeStackNavigator");
    expect(nav).toContain('initialRouteName="Home"');
    expect(nav).toContain('name="Home"');
    expect(nav).toContain('name="Detail"');
  });
  it("interaction hook uses useNavigation + onPress + navigate by component", () => {
    const h = f("interactions/Home.ts");
    expect(h).toContain("useNavigation");
    expect(h).toContain("onPress");
    expect(h).toContain('navigation.navigate("Detail")');
    expect(h).toContain("Linking.openURL(\"https://x.com\")");
    expect(h).toContain('vars["isOpen"] === true');
    expect(h).toContain("navigation.goBack()");
  });
  it("README lists react-navigation deps", () => {
    expect(f("README.md")).toContain("@react-navigation/native");
  });
});
