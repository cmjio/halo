#!/usr/bin/env node
"use strict";
// Runs the halo binary from the @halolang/halo-<platform> package npm installed for this machine.

const { spawn } = require("node:child_process");
const { binaryPath } = require("../lib/platform.js");

let bin;
try {
  bin = binaryPath();
} catch (err) {
  console.error(`halo: ${err.message}`);
  process.exit(1);
}

const child = spawn(bin, process.argv.slice(2), {
  stdio: "inherit",
  // So `halo upgrade` says to update through npm instead of replacing the binary.
  env: { ...process.env, HALO_INSTALLED_BY: "npm" },
});

// Ctrl-C reaches halo directly (same process group), so only stay alive for it to finish.
process.on("SIGINT", () => {});
// Signals sent to this process alone (a supervisor stopping it) are passed on.
for (const signal of ["SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (err) => {
  console.error(`halo: couldn't start ${bin}: ${err.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code === null ? 1 : code);
});
