#!/usr/bin/env bun
/**
 * langly — CLI for the Langly DSL
 *
 * Usage:
 *   bun run langly.ts run <file.ly> --stream <name> --args name:Alice
 *   bun run langly.ts parse <file.ly>
 */

import { parse } from "./src/parser/index.js";
import { LanglyRuntime, type RuntimeConfig } from "./src/runtime/runtime.js";

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd == null) {
  console.error("Usage: langly <run|parse> <file.ly> [options]");
  process.exit(1);
}

const file = args[1];
if (file == null) {
  console.error("Error: specify a .ly file");
  process.exit(1);
}

const flags: Record<string, string> = {};
for (let i = 2; i < args.length; i++) {
  const arg = args[i];
  if (arg == null) break;
  if (arg.startsWith("--") || arg.startsWith("-")) {
    const key = arg.replace(/^--?/, "");
    const next = args[i + 1];
    if (next != null && !next.startsWith("-")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = "true";
    }
  }
}

const source = await Bun.file(file).text();
const ast = parse(source);

if (ast.errors.length > 0) {
  console.error("Parse errors:");
  for (const e of ast.errors) console.error("  " + e);
  process.exit(1);
}

if (cmd === "parse") {
  console.log(JSON.stringify(ast, null, 2));
  process.exit(0);
}

if (cmd === "run") {
  const streamName = flags.stream ?? flags.s;
  if (streamName == null) {
    console.error("Error: --stream <name> is required for run");
    process.exit(1);
  }

  const argStr = flags.args ?? "";
  const argPairs = argStr.split(",").filter(Boolean);
  const execArgs: Record<string, string | number | boolean> = {};
  for (const pair of argPairs) {
    const parts = pair.split(":");
    const key = parts[0];
    const rest = parts.slice(1);
    if (key != null) {
      execArgs[key.trim()] = rest.join(":").trim();
    }
  }

  const apiKey = flags.key ?? Bun.env.LANGLY_API_KEY;
  const config: RuntimeConfig = apiKey != null ? { apiKey } : {};

  let output: string;
  let printedBySystem = false;

  try {
    const rt = new LanglyRuntime(config);
    rt.load(ast);

    if (flags.mock != null && flags.mock === "true") {
      const stream = ast.streams.find((s) => s.name === streamName);
      if (stream) {
        const mocks: Record<string, string> = {};
        for (const stage of stream.pipeline) {
          if (stage.kind === "call" && stage.callee !== "System") {
            const key = `${stage.callee}.${stage.method}`;
            const argsStr = stage.args.join(", ");
            mocks[key] = `__mock__: [${stage.callee}.${stage.method}("${argsStr}")]`;
          }
        }
        rt.mockAll(mocks);
      }
    }

    output = await rt.execute(streamName, execArgs);
  } catch (err: any) {
    console.error("Runtime error:", err.message);
    process.exit(1);
  }

  const lastStage = ast.streams.find(
    (s) => s.name === streamName,
  )?.pipeline.at(-1);
  printedBySystem =
    lastStage != null &&
    lastStage.kind === "call" &&
    lastStage.callee === "System" &&
    lastStage.method === "Print";

  if (!printedBySystem) {
    console.log(output);
  }
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
process.exit(1);
