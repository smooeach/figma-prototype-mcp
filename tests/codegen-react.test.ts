import { describe, it, expect } from "vitest";
import { pascalCase, slugify } from "../src/codegen/types.js";
import { mapTransition } from "../src/codegen/emitters/react.js";

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
