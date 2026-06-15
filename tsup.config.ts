import { defineConfig } from "tsup";
import { copyFileSync, readFileSync } from "node:fs";
const PKG_VERSION = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;

export default defineConfig([
  {
    // Figma plugin — sandboxed JS, bundle everything, no Node/externals.
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
    noExternal: [/.*/],
    onSuccess: async () => {
      copyFileSync("src/figma-plugin/manifest.json", "dist/figma-plugin/manifest.json");
      copyFileSync("src/figma-plugin/ui.html", "dist/figma-plugin/ui.html");
    },
  },
  {
    // MCP/SSE server — Node ESM bundle with a bin shebang; runtime deps stay
    // external (installed from package "dependencies"), so only our src is bundled.
    entry: ["src/server/index.ts"],
    outDir: "dist/server",
    format: ["esm"],
    platform: "node",
    target: "node18",
    bundle: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    minify: false,
    banner: { js: "#!/usr/bin/env node" },
    define: { __PKG_VERSION__: JSON.stringify(PKG_VERSION) },
  },
]);
