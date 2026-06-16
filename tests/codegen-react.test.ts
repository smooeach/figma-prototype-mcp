import { describe, it, expect } from "vitest";
import { pascalCase, slugify } from "../src/codegen/types.js";
import { mapTransition } from "../src/codegen/emitters/react.js";
import { emitRoutes } from "../src/codegen/emitters/react.js";

describe("name helpers", () => {
  it("pascalCase converts arbitrary names", () => {
    expect(pascalCase("Home Screen")).toBe("HomeScreen");
    expect(pascalCase("log-in_view 2")).toBe("LogInView2");
    expect(pascalCase("")).toBe("Screen");
  });
  it("slugify makes url-safe lowercase paths", () => {
    expect(slugify("Home Screen")).toBe("home-screen");
    expect(slugify("Détail!")).toBe("detail");
    expect(slugify("")).toBe("screen");
  });
});

describe("mapTransition", () => {
  it("defaults when transition missing", () => {
    expect(mapTransition(undefined)).toEqual({ duration: 0.3, ease: "easeInOut" });
  });
  it("passes through duration (seconds) and maps easing", () => {
    expect(mapTransition({ duration: 0.5, easing: { type: "EASE_OUT" } })).toEqual({ duration: 0.5, ease: "easeOut" });
    expect(mapTransition({ duration: 1, easing: "LINEAR" })).toEqual({ duration: 1, ease: "linear" });
  });
});

const SPEC_TWO = {
  schemaVersion: "1.0" as const,
  page: { id: "p1", name: "Page 1" },
  screens: [
    { id: "1:1", name: "Home", interactions: [] },
    { id: "1:2", name: "Detail", interactions: [] },
  ],
  requestedScreens: ["1:1", "1:2"],
  missingScreens: [],
  unsupported: [],
  truncated: false,
};

describe("emitRoutes", () => {
  it("creates one route per screen, first screen at '/'", () => {
    const out = emitRoutes(SPEC_TWO);
    expect(out).toContain("createBrowserRouter");
    expect(out).toContain('path: "/"');           // first screen
    expect(out).toContain('path: "/detail"');     // second screen slug
    expect(out).toContain("import Home from \"./screens/Home\"");
    expect(out).toContain("import Detail from \"./screens/Detail\"");
  });
});
