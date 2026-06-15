import { parseArgs, createDeps, runSse, runStdio } from "./run.js";

process.on("unhandledRejection", (err) => {
  console.error("[server] unhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
});

const { mode } = parseArgs(process.argv.slice(2));
const deps = createDeps();
if (mode === "stdio") {
  void runStdio(deps);
} else {
  void runSse(deps);
}
