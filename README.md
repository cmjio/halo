# Langly - AI Workflow Language

A **declarative domain-specific language (DSL)** for orchestrating AI/LLM workflows with built-in safety guardrails, tool integrations, and cost-optimized model routing.

## 🚀 Quick Start

### 1. Install
```bash
bun install
# or
npm install langly
```

### 2. Create Your First Workflow
```langly
// hello.ly
mind Greeter [gemini-3-1-pro, temp: 0.7]

stream HelloWorld(name: String) -> Result:
  name
    |> Greeter.prompt("Write a warm greeting for {{name}}.")
    |> System.Print()
```

### 3. Run It
```bash
# With mock (for testing)
bun run examples/01-hello.ly

# With real LLM API
export LANGLY_API_KEY="your-api-key"
langly run examples/01-hello.ly --args '{"name": "World"}'
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
| 10 | `10-named-args.ly` | Named arguments |
| 11 | `11-context-flow.ly` | Context data flow |
| 12 | `12-multiple-minds.ly` | Multiple minds in one stream |
| 13 | `13-deep-context.ly` | Deep context paths |
| 14 | `14-env-vars.ly` | Environment variables |
| 15 | `15-shadow-minds.ly` | Shadow directive (A/B testing) |
| 16 | `16-retry-checkpoint.ly` | Retry/checkpoint directives |
| 17 | `17-rest-tool.ly` | REST tool usage |
| 18 | `18-vectorstore.ly` | VectorStore operations |
| 20-25 | Role examples | Advanced patterns |
| 30-32 | Expert examples | Production systems |

## 🔧 CLI Commands

```bash
# Validate syntax
langly validate examples/20-role-founder.ly

# Run with arguments
langly run examples/20-role-founder.ly --args '{"date": "2024-01-15"}'

# Debug mode
langly debug examples/01-hello.ly

# Run all examples
bun test
```

## 📖 Documentation

- **Language Spec**: `docs/spec.md`
- **Grammar Review**: `docs/grammar_review.md`
- **Dictionary**: `docs/dictionary.md`

## 🏗 Architecture

```
langly/
├── src/
│   ├── parser/          # ANTLR4-based parser
│   └── runtime/         # Execution engine
│       ├── adapter.ts    # LLM provider adapters
│       └── router.ts     # Cost-optimized routing
├── examples/            # Build-up learning path (01-32)
├── editors/            # VS Code, Sublime, Zed support
└── docs/               # Specifications & guides
```

## ✅ Supported Providers (Adapters)

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
bun test  # Run all 95+ tests
```

**Current:** 91 pass, 4 fail (grammar/parser edge cases)

## 📄 License

MIT
