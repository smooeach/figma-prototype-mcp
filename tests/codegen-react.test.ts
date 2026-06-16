import { describe, it, expect } from "vitest";
import { pascalCase, slugify } from "../src/codegen/types.js";
import { mapTransition } from "../src/codegen/emitters/react.js";
import { emitRoutes } from "../src/codegen/emitters/react.js";
import { emitStore, collectVariables } from "../src/codegen/emitters/react.js";
import { emitScreenInteractions } from "../src/codegen/emitters/react.js";
import { emitReact } from "../src/codegen/emitters/react.js";
import type { InteractionSpec } from "../src/server/interaction-spec.js";

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

const SPEC_VARS = {
  schemaVersion: "1.0" as const,
  page: { id: "p1", name: "Page 1" },
  screens: [
    {
      id: "1:1",
      name: "Home",
      interactions: [
        { source: { id: "n1", name: "Toggle" }, trigger: { type: "ON_CLICK" }, actions: [{ type: "toggleVariable", variable: "isOpen" }] },
        { source: { id: "n2", name: "Login" }, trigger: { type: "ON_CLICK" }, actions: [{ type: "setVariable", variable: "user", value: "guest" }] },
      ],
    },
  ],
  requestedScreens: ["1:1"],
  missingScreens: [],
  unsupported: [],
  truncated: false,
} as unknown as InteractionSpec;

describe("collectVariables", () => {
  it("gathers unique variable names from set/toggle/conditional actions", () => {
    expect(collectVariables(SPEC_VARS).sort()).toEqual(["isOpen", "user"]);
  });
});

describe("emitStore", () => {
  it("emits a context with set/toggle and initial state for each variable", () => {
    const out = emitStore(SPEC_VARS);
    expect(out).toContain("createContext");
    expect(out).toContain("useProtoVar");
    expect(out).toContain('"isOpen"');
    expect(out).toContain('"user"');
    expect(out).toContain("function set(");
    expect(out).toContain("function toggle(");
  });
});

const SPEC_ACTIONS = {
  schemaVersion: "1.0" as const,
  page: { id: "p1", name: "Page 1" },
  screens: [
    {
      id: "1:1",
      name: "Home",
      interactions: [
        { source: { id: "n1", name: "GoDetail" }, trigger: { type: "ON_CLICK" },
          actions: [{ type: "navigate", to: { id: "1:2", name: "Detail" }, transition: { duration: 0.4, easing: "EASE_OUT" } }] },
        { source: { id: "n2", name: "Flip" }, trigger: { type: "ON_CLICK" },
          actions: [{ type: "toggleVariable", variable: "isOpen" }] },
        { source: { id: "n3", name: "Guard" }, trigger: { type: "ON_CLICK" },
          actions: [{ type: "conditional", if: { variable: "isOpen", operator: "EQ", value: true },
                      then: [{ type: "navigate", to: { id: "1:3", name: "Next" } }],
                      else: [{ type: "back" }] }] },
      ],
    },
  ],
  requestedScreens: ["1:1"],
  missingScreens: [],
  unsupported: [],
  truncated: false,
} as unknown as InteractionSpec;

describe("emitScreenInteractions", () => {
  it("emits one file per screen with a hook and handlers", () => {
    const files = emitScreenInteractions(SPEC_ACTIONS);
    expect(files).toHaveLength(1);
    const f = files[0]!;
    expect(f.path).toBe("interactions/Home.ts");
    expect(f.content).toContain("export function useHomeInteractions()");
    expect(f.content).toContain("useNavigate");
    expect(f.content).toContain('navigate("/detail"');     // navigate target slug
    expect(f.content).toContain("toggle(\"isOpen\")");       // toggle var
    expect(f.content).toContain("if (");                     // conditional
    expect(f.content).toContain("navigate(-1)");             // back in else
  });
});

const SPEC_FULL = {
  schemaVersion: "1.0" as const,
  page: { id: "p1", name: "Page 1" },
  screens: [{ id: "1:1", name: "Home", interactions: [] }],
  requestedScreens: ["1:1"],
  missingScreens: [],
  unsupported: [{ source: { id: "n9", name: "Weird" }, reason: "unknown action type: FOO", raw: {} }],
  truncated: false,
};

describe("emitReact", () => {
  it("returns the full structured file set", () => {
    const files = emitReact(SPEC_FULL);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "interactions/Home.ts", "prototype-store.tsx", "routes.tsx"].sort());
  });
  it("README lists unsupported interactions", () => {
    const readme = emitReact(SPEC_FULL).find((f) => f.path === "README.md")!;
    expect(readme.content).toContain("unknown action type: FOO");
    expect(readme.content).toContain("react-router");
    expect(readme.content).toContain("framer-motion");
  });
});
