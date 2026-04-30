#!/usr/bin/env bun

/**
 * Langly CLI - Command Line Interface
 * 
 * Usage:
 *   langly run <file.ly> [--api-key <key>] [--args '<json>']
 *   langly validate <file.ly>
 *   langly debug <file.ly> [--api-key <key>]
 *   langly --help
 */

import { parse } from "./src/parser/index.js";
import { LanglyRuntime } from "./src/runtime/runtime.js";
import { OpenAIAdapter, AnthropicAdapter, GoogleAdapter } from "./src/runtime/adapter.js";
import { readFileSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);

// --- Help ---
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`
Langly CLI - AI Workflow Language

USAGE:
  langly run <file.ly>              Run a Langly program
  langly validate <file.ly>          Check for parse errors
  langly debug <file.ly>             Run with detailed tracing

OPTIONS:
  --api-key <key>              Override API key
  --args '<json>'                 Pass input arguments as JSON
  --router '<json>'               Router configuration
  --no-mocks                       Disable mocks (use real APIs)

EXAMPLES:
  langly run examples/01-hello.ly
  langly run examples/20-role-founder.ly --args '{"date": "2024-01-15"}'
  langly validate examples/**/*.ly
  `);
  process.exit(0);
}

// --- Parse commands ---
const command = args[0];
const fileArg = args.find(a => a.endsWith(".ly"));
const apiKeyArg = args.find(a => a === "--api-key") ? args[args.indexOf("--api-key") + 1] : undefined;
const argsArg = args.find(a => a === "--args") ? args[args.indexOf("--args") + 1] : undefined;

if (!fileArg) {
  console.error("Error: No .ly file specified");
  process.exit(1);
}

const filePath = resolve(fileArg);
const source = readFileSync(filePath, "utf8");

// --- VALIDATE command ---
if (command === "validate") {
  console.log(`Validating ${filePath}...`);
  const result = parse(source);
  
  if (result.errors.length > 0) {
    console.error(`❌ Parse errors found:`);
    result.errors.forEach((e: string) => console.error(`  ${e}`));
    process.exit(1);
  }
  
  console.log(`✅ ${filePath} is valid Langly syntax`);
  
  // Print summary
  console.log(`\nSummary:`);
  console.log(`  Minds: ${result.minds.length}`);
  console.log(`  Streams: ${result.streams.length}`);
  console.log(`  Guardrails: ${result.guardrails.length}`);
  console.log(`  Tools: ${result.tools.length}`);
  console.log(`  Memory: ${result.memories.length}`);
  process.exit(0);
}

// --- RUN command ---
if (command === "run" || command === undefined) {
  console.log(`Running ${filePath}...`);
  
  // Parse
  const result = parse(source);
  if (result.errors.length > 0) {
    console.error(`❌ Parse errors:`);
    result.errors.forEach((e: string) => console.error(`  ${e}`));
    process.exit(1);
  }
  
  // Configure runtime
  const apiKey = apiKeyArg ?? Bun.env.LANGLY_API_KEY;
  const runtime = new LanglyRuntime({ apiKey });
  
  // Register adapters
  runtime.registerAdapter(new OpenAIAdapter());
  runtime.registerAdapter(new AnthropicAdapter());
  runtime.registerAdapter(new GoogleAdapter());
  
  // Load program
  runtime.load(result);
  
  // Parse input args
  let inputArgs: Record<string, unknown> = {};
  if (argsArg) {
    try {
      inputArgs = JSON.parse(argsArg);
    } catch {
      console.error("Error: Invalid JSON in --args");
      process.exit(1);
    }
  } else {
    // Try to infer from stream params
    const stream = result.streams[0];
    if (stream && stream.params.length > 0) {
      console.log(`Expected arguments: ${stream.params.map(p => p.name).join(", ")}`);
      console.log(`Provide them via --args '<json>'`);
    }
  }
  
  // Execute first stream
  const streamName = result.streams[0]?.name;
  if (!streamName) {
    console.error("Error: No streams found in file");
    process.exit(1);
  }
  
  try {
    const output = await runtime.execute(streamName, inputArgs);
    console.log(`\n✅ Output:`);
    console.log(output);
    
    // Show cost if available
    const costTracker = runtime.getCostTracker();
    const totalCost = costTracker.getTotalCost();
    if (totalCost > 0) {
      console.log(`\n💰 Total cost: $${totalCost.toFixed(4)}`);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Execution error:`, error.message);
    process.exit(1);
  }
}

console.error(`Unknown command: ${command}`);
process.exit(1);
