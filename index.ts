#!/usr/bin/env bun
// Package entry: the Halo library. Run directly (`halo ...`), it is the CLI.
export * from "./src/index.ts";

if (import.meta.main) {
  const { main } = await import("./src/cli.ts");
  process.exit(await main(process.argv.slice(2)));
}
