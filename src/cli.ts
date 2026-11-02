#!/usr/bin/env bun

/**
 * Halo CLI - Working Command Line Interface
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { parse } from "./parser/index.js";
import { LanglyRuntime } from "./runtime/runtime.js";

export async function runCli(args: string[], logger: { log: typeof console.log, error: typeof console.error } = console): Promise<number> {
  const command = args[0];

  // --- Help ---
  if (!command || command === "--help" || command === "-h") {
    logger.log(`
Halo CLI - AI Workflow Language

Commands:
  init [name]          Create a new Halo project
  run <file.halo>      Run a .halo file
  test <file.halo>     Run a .halo file in mock mode
  validate <file.halo> Validate syntax

Options:
  --api-key <key>      Override API key
  --args '<json>'      Pass input arguments
  --pipeline <name>    Specify pipeline to run
  --mock               Force mock mode (no API calls)
  --local              Use local Ollama models

Examples:
  halo init my-bot --template hello
  halo run examples/01-hello.halo --args '{"name": "Alice"}'
    `);
    return 0;
  }

  // --- INIT command ---
  if (command === "init") {
    const projectName = args[1] || "my-halo-project";
    const useLocal = args.includes("--local");
    
    logger.log(`Creating Halo project: ${projectName}...`);
    
    const projectDir = resolve(projectName);
    if (existsSync(projectDir)) {
      logger.error(`Error: Directory "${projectName}" already exists`);
      return 1;
    }
    
    // Create structure
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(`${projectDir}/src`, { recursive: true });
    mkdirSync(`${projectDir}/examples`, { recursive: true });
    mkdirSync(`${projectDir}/tests`, { recursive: true });
    
    // Create halo.json
    const config = {
      name: projectName,
      version: "0.1.0",
      description: "My Halo AI workflow",
      runtime: {
        apiKey: useLocal ? undefined : "Env.HALO_API_KEY",
        router: {
          strategy: useLocal ? "local-first" : "balanced",
          maxCostPer1kTokens: 0.05
        }
      }
    };
    writeFileSync(`${projectDir}/halo.json`, JSON.stringify(config, null, 2));
    
    // Create .env.example
    const envExample = useLocal 
      ? `# Halo Local Development (no API key needed with Ollama)\n# Make sure you have Ollama running: ollama serve`
      : `# Halo Environment Variables\nHALO_API_KEY="your-api-key-here"\nOPENAI_API_KEY="sk-..."\nANTHROPIC_API_KEY="sk-ant-..."`;
    writeFileSync(`${projectDir}/.env.example`, envExample);
    
    // Create main.halo
    const mainHalo = useLocal
      ? `// ${projectName} - Local LLM (Ollama)\nagent Bot [ollama/llama3.1, temp: 0.7]\n\npipeline Chat(message: String) -> Result:\n  message\n    |> Bot.prompt("You are a helpful assistant. Reply: {{message}}")\n    |> System.Print()\n`
      : `// ${projectName} - Cloud LLM\nagent Smart [openai/gpt-4o-mini, temp: 0.5]\n\npipeline Chat(message: String) -> Result:\n  message\n    |> Smart.prompt("You are a helpful assistant. Reply: {{message}}")\n    |> System.Print()\n`;
    writeFileSync(`${projectDir}/src/main.halo`, mainHalo);
    
    // Create README
    const readme = `# ${projectName}\n\nA Halo AI workflow project.\n\n## Quick Start\n\n\`\`\`bash\n# 1. Copy environment variables\ncp .env.example .env\n# Edit .env with your API keys\n\n# 2. Install dependencies\nbun install\n\n# 3. Run (mocked)\nbun run src/main.halo --mock\n\n# 4. Run with real LLM\nexport HALO_API_KEY="your-key"\nbun run src/main.halo --args '{"message": "Hello!"}'\n\`\`\`\n`;
    writeFileSync(`${projectDir}/README.md`, readme);
    
    logger.log(`✅ Project "${projectName}" created successfully!`);
    return 0;
  }

  // --- VALIDATE command ---
  if (command === "validate") {
    const file = args[1];
    if (!file) {
      logger.error("Error: Missing file argument for 'validate'.");
      return 1;
    }
    const source = readFileSync(file, "utf-8");
    const result = parse(source);
    if (result.errors.length > 0) {
      logger.error(`Syntax error(s) in ${file}:`);
      for (const err of result.errors) {
        logger.error(`  ${err}`);
      }
      return 1;
    }
    logger.log(`✅ Valid syntax: ${file}`);
    return 0;
  }

  // --- RUN / TEST command ---
  if (command === "run" || command === "test") {
    const file = args[1];
    if (!file) {
      logger.error(`Error: Missing file argument for '${command}'.`);
      return 1;
    }
    
    let pipelineArgs: Record<string, any> = {};
    const argsIndex = args.indexOf("--args");
    if (argsIndex !== -1 && args[argsIndex + 1]) {
      try {
        pipelineArgs = JSON.parse(args[argsIndex + 1]);
      } catch (e: any) {
        logger.error(`Error: --args must be valid JSON: ${e.message}`);
        return 1;
      }
    }

    const pipelineIndex = args.indexOf("--pipeline");
    let pipelineName = pipelineIndex !== -1 ? args[pipelineIndex + 1] : undefined;
    
    const apiKeyIndex = args.indexOf("--api-key");
    const apiKey = apiKeyIndex !== -1 ? args[apiKeyIndex + 1] : undefined;

    const isMock = command === "test" || args.includes("--mock");

    const source = readFileSync(file, "utf-8");
    const ast = parse(source);
    if (ast.errors.length > 0) {
      logger.error(`Syntax error(s) in ${file}:`);
      ast.errors.forEach(err => logger.error(`  ${err}`));
      return 1;
    }

    // Load into Runtime
    const runtime = new LanglyRuntime({ apiKey });
    runtime.load(ast);

    if (!pipelineName) {
      if (ast.pipelines.length === 0) {
        logger.error(`Error: No pipelines found in ${file}.`);
        return 1;
      }
      pipelineName = ast.pipelines[0].name;
    }

    try {
      const result = await runtime.execute(pipelineName, pipelineArgs, isMock);
      logger.log(`\n✅ Execution finished.`);
      logger.log(`Result: ${JSON.stringify(result, null, 2)}`);
      
      const metrics = runtime.telemetry.getRunMetrics(runtime.telemetry.lastRunId || "");
      if (metrics) {
        logger.log(`\n📊 Telemetry:`);
        logger.log(`  Total Duration: ${metrics.totalDuration}ms`);
        logger.log(`  Total Cost: $${metrics.totalCost.toFixed(4)}`);
      }
      return 0;
    } catch (e: any) {
      logger.error(`\n❌ Execution failed: ${e.message}`);
      return 1;
    }
  }

  logger.error(`Unknown command: ${command}`);
  logger.error(`Run "halo --help" for usage`);
  return 1;
}

// Execute if run directly
if (import.meta.main || process.argv[1] === __filename) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
