# Langly - AI Workflow Language

A **declarative domain-specific language (DSL)** for orchestrating AI/LLM workflows with built-in safety guardrails, tool integrations, and cost-optimized model routing.

## 🚀 Quick Start

### 1. Installation
```bash
bun install
# or
npm install langly
```

### 2. Create Your First Project
```bash
langly init my-chat-bot
cd my-chat-bot
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run It
```bash
# With mock (for testing)
langly run src/main.ly --mock

# With real LLM
export LANGLY_API_KEY="your-api-key"
langly run src/main.ly --args '{"message": "World"}'
```

## 📚 Learn Langly (Build-Up Examples)

The `examples/` folder is a **complete learning path** — each example builds on the previous:

| # | Example | Concepts Learned |
|---|---------|--------------------|
| 01 | `01-hello.ly` | Mind, Stream, basic pipeline |
| 02 | `02-guardrails.ly` | Guardrails + requires |
| 03 | `03-tools.ly` | Tools + equips |
| 04 | `04-params-and-context.ly` | Multiple params + context |
| 05 | `05-fanout.ly` | Parallel execution |
| 06 | `06-gates.ly` | Conditional execution |
| 07 | `07-interrupts-and-listeners.ly` | Human-in-the-loop |
| 08 | `08-memory.ly` | Persistence |
| 09 | `09-directives.ly` | Build/runtime modifiers |
| 10-18 | Intermediate patterns | Named args, multiple minds, etc. |
| 20-25 | Role examples | Advanced patterns |
| 30-32 | Expert examples | Production systems |

## 🔧 CLI Commands

```bash
# Initialize a new project
langly init [project-name] [--template <name>] [--local]

# Validate syntax
langly validate examples/20-role-founder.ly

# Run with arguments
langly run examples/20-role-founder.ly --args '{"date": "2024-01-15"}'

# Debug mode
langly run examples/01-hello.ly --verbose

# Development mode (hot-reload)
langly dev examples/01-hello.ly

# Build to executable
langly build examples/20-role-founder.ly -o founder-bot
```

## 🏗 Deployment

### Local Development (Ollama - Zero Cost)
```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model
ollama pull llama3.1

# 3. Run with local models
langly init my-bot --local
cd my-bot
langly run src/main.ly
```

### Cloud Deployment (Docker)
```dockerfile
FROM oven/bun:latest

WORKDIR /app
COPY . .

RUN bun install
EXPOSE 3000
CMD ["bun", "run", "src/main.ly"]
```

## 📖 Supported Providers (Adapters)

| Provider | Prefix | Status |
|-----------|--------|--------|
| OpenAI | `openai/*`, `oai/*` | ✅ |
| Anthropic | `anthropic/*`, `claude/*` | ✅ |
| Google Gemini | `google/*`, `gemini/*` | ✅ |
| OpenRouter | `openrouter/*`, `or/*` | ✅ |
| Together AI | `together/*`, `tog/*` | ✅ |
| Replicate | `replicate/*`, `rep/*` | ✅ |
| Ollama (Local) | `ollama/*`, `local/*` | ✅ |

## 🧪 Test Status

```bash
bun test  # Run all 121+ tests
```

**Current:** 121 pass, 0 fail ✅

## 📄 Examples for Startups

| Use Case | Example | Cost |
|-----------|---------|------|
| Customer Support Bot | `examples/20-role-founder.ly` | ~$0.02/interaction |
| Content Moderation | `examples/30-control-moderation.ly` | Budget-capped at $2.00 |
| QA Automation | `examples/24-role-qa-engineer.ly` | ~$0.01/test |
| Design Review | `examples/22-role-ux-designer.ly` | ~$0.015/review |

## 📄 License

MIT
