#!/usr/bin/env bun

/**
 * langly init - Create a new Langly project
 * 
 * Usage:
 *   langly init [project-name] [--template <name>] [--local]
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";

const args = process.argv.slice(2);
const projectName = args.find(a => !a.startsWith("--")) || "my-langly-bot";
const template = args.find(a => a === "--template") ? args[args.indexOf("--template") + 1] : "hello";
const useLocal = args.includes("--local");

const projectDir = resolve(projectName);

// --- Create project structure ---
if (existsSync(projectDir)) {
  console.error(`Error: Directory "${projectName}" already exists`);
  process.exit(1);
}

console.log(`Creating Langly project: ${projectName}...`);

// Create directories
mkdirSync(projectDir, { recursive: true });
mkdirSync(`${projectDir}/src`, { recursive: true });
mkdirSync(`${projectDir}/examples`, { recursive: true });
mkdirSync(`${projectDir}/tests`, { recursive: true });

// --- Create langly.json ---
const config = {
  "name": projectName,
  "version": "0.1.0",
  "description": "My Langly AI workflow",
  "runtime": {
    "apiKey": useLocal ? undefined : "Env.LANGLY_API_KEY",
    "router": {
      "strategy": useLocal ? "local-first" : "balanced",
      "maxCostPer1kTokens": 0.05
    }
  },
  "logLevel": "info"
};

writeFileSync(
  `${projectDir}/langly.json`,
  JSON.stringify(config, null, 2)
);

// --- Create .env.example ---
writeFileSync(
  `${projectDir}/.env.example`,
  useLocal
    ? `# Langly Local Development
# Using Ollama - no API key needed!
# Make sure you have Ollama running: ollama serve
`
    : `# Langly Environment Variables
LANGLY_API_KEY="your-api-key-here"
STRIPE_KEY="sk_live_..."
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
PINECONE_KEY="pc-..."`
);

// --- Create main.ly ---
const mainLy = `${projectDir}/src/main.ly`;
if (useLocal) {
  writeFileSync(mainLy, `// ${projectName} - Local LLM (Ollama)
// Uses local models - no API costs!

agent LocalBot [ollama/llama3.1, temp: 0.7]

pipeline Chat(message: String) -> Response:
  message
    |> LocalBot.prompt("You are a helpful assistant. Reply: {{message}}")
    |> System.Print()
`);
} else {
  writeFileSync(mainLy, `// ${projectName} - Cloud LLM
// Uses cost-optimized routing across providers

agent Smart [openai/gpt-4o-mini, temp: 0.5]
agent Powerful [anthropic/claude-3-5-sonnet, temp: 0.7]

pipeline Chat(message: String) -> Response:
  message
    |> Smart.prompt("You are a helpful assistant. Reply: {{message}}")
    |> System.Print()
`);
}

// --- Create README.md ---
writeFileSync(
  `${projectDir}/README.md`,
  `# ${projectName}

A Langly AI workflow project.

## Quick Start

\`\`bash
# 1. Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# 2. Install dependencies
bun install

# 3. Run locally (with mocks)
bun run src/main.ly --mock

# 4. Run with real LLM
export LANGLY_API_KEY="your-key"
bun run src/main.ly --args '{"message": "Hello!"}'
\`\`

## Project Structure

\`\`
${projectName}/
├── langly.json          # Runtime config
├── .env.example        # Env template
├── src/
│   └── main.ly           # Your Langly workflow
├── examples/             # Example workflows
└── tests/              # Test suites
\`\`

## Learn Langly

Check out the [examples/](../examples/) folder for a complete learning path (01-32).
`);

// --- Create package.json ---
writeFileSync(
  `${projectDir}/package.json`,
  JSON.stringify({
    "name": projectName,
    "version": "0.1.0",
    "scripts": {
      "dev": "bun --hot src/main.ly",
      "test": "bun test",
      "lint": "langly validate src/"
    },
    "dependencies": {
      "langly": "^0.1.0"
    }
  }, null, 2)
);

// --- Create .gitignore ---
writeFileSync(
  `${projectDir}/.gitignore`,
  `.env
node_modules/
dist/
*.log
.langly/
`
);

console.log(`
✅ Project "${projectName}" created successfully!

Next steps:
  1. cd ${projectName}
  2. cp .env.example .env
  3. Edit .env with your API keys
  4. bun install
  5. bun run src/main.ly --mock

${useLocal ? "\n💡 Using local LLMs (Ollama) - no API costs!" : ""}
`);
