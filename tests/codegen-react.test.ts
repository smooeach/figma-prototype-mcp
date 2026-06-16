import { describe, it, expect } from "vitest";
import { pascalCase, slugify } from "../src/codegen/types.js";
import { mapTransition, buildScreenIdentities } from "../src/codegen/emitters/react.js";
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
          actions: [{ type: "conditional", if: { variable: "isOpen", operator: "==", value: true },
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
    expect(f.content).toContain('vars["isOpen"] === true'); // operator maps == -> ===
  });
});

describe("conditional operator mapping", () => {
  const specWithOp = (operator: string, value: unknown) => ({
    schemaVersion: "1.0" as const,
    page: { id: "p1", name: "Page 1" },
    screens: [{
      id: "1:1", name: "Home",
      interactions: [{
        source: { id: "n1", name: "Guard" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "conditional", if: { variable: "count", operator, value },
                    then: [{ type: "back" }] }],
      }],
    }],
    requestedScreens: ["1:1"], missingScreens: [], unsupported: [], truncated: false,
  });
  it("maps != to !== and >= to >= (not collapsed to ===)", () => {
    const neq = emitScreenInteractions(specWithOp("!=", 0) as any)[0]!.content;
    expect(neq).toContain('vars["count"] !== 0');
    const gte = emitScreenInteractions(specWithOp(">=", 3) as any)[0]!.content;
    expect(gte).toContain('vars["count"] >= 3');
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

// ---------------------------------------------------------------------------
// Duplicate screen names — the core bug being fixed
// ---------------------------------------------------------------------------

const SPEC_DUP = {
  schemaVersion: "1.0" as const,
  page: { id: "p1", name: "P" },
  screens: [
    { id: "9:1", name: "screen01", interactions: [
      { source: { id: "n1", name: "Go" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "navigate", to: { id: "9:2", name: "screen01" } }] } ] },
    { id: "9:2", name: "screen01", interactions: [] },
    { id: "9:3", name: "Detail", interactions: [
      { source: { id: "n2", name: "Ext" }, trigger: { type: "ON_CLICK" },
        actions: [{ type: "navigate", to: { id: "99:99", name: "External" } }] } ] },
  ],
  requestedScreens: ["9:1", "9:2", "9:3"], missingScreens: [], unsupported: [], truncated: false,
};

describe("buildScreenIdentities (duplicate names)", () => {
  it("assigns unique components and paths to same-named screens", () => {
    const m = buildScreenIdentities(SPEC_DUP as any);
    const a = m.get("9:1"), b = m.get("9:2");
    expect(a!.component).not.toBe(b!.component);
    expect(a!.path).not.toBe(b!.path);
    expect(a!.path).toBe("/"); // first screen
  });
});

describe("emitReact with duplicate screen names", () => {
  it("produces unique imports, routes, and interaction file paths", () => {
    const files = emitReact(SPEC_DUP as any);
    const routes = files.find((f) => f.path === "routes.tsx")!.content;
    // no duplicate import identifier and no duplicate path literal
    const importLines = routes.split("\n").filter((l) => l.startsWith("import ") && l.includes("./screens/"));
    const importedNames = importLines.map((l) => l.split(" ")[1]);
    expect(new Set(importedNames).size).toBe(importedNames.length); // all unique
    const interactionPaths = files.filter((f) => f.path.startsWith("interactions/")).map((f) => f.path);
    expect(new Set(interactionPaths).size).toBe(interactionPaths.length); // no overwrite
  });
  it("navigates to the target's path by id, and flags external targets", () => {
    const files = emitReact(SPEC_DUP as any);
    const go = files.find((f) => f.path.startsWith("interactions/") && f.content.includes('"Go"'))!.content;
    expect(go).toContain(`navigate("${buildScreenIdentities(SPEC_DUP as any).get("9:2")!.path}"`);
    const ext = files.map((f) => f.content).join("\n");
    expect(ext).toContain("not in the generated routes");
  });
});
