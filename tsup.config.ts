import { defineConfig } from "tsup";
import { copyFileSync } from "node:fs";

export default defineConfig({
  entry: ["src/figma-plugin/code.ts"],
  outDir: "dist/figma-plugin",
  format: ["iife"],
  target: "es2017",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: false,
  outExtension: () => ({ js: ".js" }),
  // Figma plugins run in a sandboxed JS environment — no Node, no externals.
  noExternal: [/.*/],
  onSuccess: async () => {
    copyFileSync("src/figma-plugin/manifest.json", "dist/figma-plugin/manifest.json");
    copyFileSync("src/figma-plugin/ui.html", "dist/figma-plugin/ui.html");
  },
});
