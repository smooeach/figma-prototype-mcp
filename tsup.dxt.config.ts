import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const PKG_VERSION = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;

// Self-contained bundle for the Claude Desktop extension: deps bundled IN so the
// installed .mcpb needs no npm install. Same entry as the server, stdio-driven.
export default defineConfig({
  entry: ["src/server/index.ts"],
  outDir: "dist/dxt",
  format: ["esm"],
  platform: "node",
  target: "node18",
  bundle: true,
  noExternal: [/.*/],
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: false,
  define: { __PKG_VERSION__: JSON.stringify(PKG_VERSION) },
  // CJS deps (express, ws) bundled into ESM need a `require` shim.
  // The esbuild __require stub checks `typeof require`, which is undefined in
  // Node ESM; inject createRequire so the shim resolves Node built-ins correctly.
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire } from "node:module";',
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
});
