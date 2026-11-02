# Langly Deployment Guide

## 🏗 Deployment Options

### 1. Local Development (Ollama - Zero Cost)

**Prerequisites:**
- Bun installed
- Ollama installed and running

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Start Ollama server
ollama serve

# 3. Pull a model
ollama pull llama3.1

# 4. Create a Langly project with local models
langly init my-bot --local
cd my-bot

# 5. Edit .env (no API key needed!)
cp .env.example .env

# 6. Run
bun run src/main.ly --mock  # Test first
bun run src/main.ly             # Uses local Ollama
```

**Cost:** $0 (uses local models!)

---

### 2. Vercel Deployment

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/main.ly",
      "use": "@vercel/bun",
      "config": { "includeFiles": ["langly.json", ".env"] }
    }
  ],
  "env": {
    "LANGLY_API_KEY": "@langly-api-key"
  }
}
```

**Deploy:**
```bash
vercel --prod
```

---

### 3. Railway Deployment

**Dockerfile:**
```dockerfile
FROM oven/bun:latest

WORKDIR /app
COPY . .

RUN bun install

EXPOSE 3000
CMD ["bun", "run", "src/main.ly"]
```

**railway.toml:**
```toml
[build]
builder = "dockerfile"

[deploy]
startCommand = "bun run src/main.ly"

[env]
LANGLY_API_KEY = "your-key-here"
```

**Deploy:**
```bash
railway login
railway link
railway up
```

---

### 4. Render Deployment

**Dockerfile:**
```dockerfile
FROM oven/bun:latest

WORKDIR /app
COPY . .

RUN bun install

EXPOSE 3000
CMD ["bun", "run", "src/main.ly"]
```

**render.yaml:**
```yaml
services:
  - type: web
    name: langly-bot
    envVars:
      - key: LANGLY_API_KEY
        value: your-key-here
```

**Deploy:**
```bash
git push render main
```

---

### 5. AWS Lambda (Serverless)

**handler.ts:**
```typescript
import { APIGatewayProxyResult } from "aws-lambda";
import { parse } from "langly/parser";
import { LanglyRuntime } from "langly/runtime";

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
  const body = JSON.parse(event.body || "{}");
  
  const source = `
mind Bot [openai/gpt-4o-mini, temp: 0.5]
stream Chat(message: String) -> Result:
  message
    |> Bot.prompt("You are a helpful assistant. Reply: {{message}}")
    |> System.Print()
`;
  
  const ast = parse(source);
  const runtime = new LanglyRuntime({ apiKey: process.env.LANGLY_API_KEY });
  runtime.load(ast);
  
  const result = await runtime.execute("Chat", { message: body.message });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ response: result }),
    headers: { "Content-Type": "application/json" }
  };
};
```

**serverless.yml:**
```yaml
service: langly-bot

provider:
  name: aws
  runtime: nodejs20.x
  environment:
    LANGLY_API_KEY: ${self:custom.langlyKey}

functions:
  chat:
    handler: handler.handler
    events:
      - http:
          path: chat
          method: post
```

**Deploy:**
```bash
npm install -g serverless
serverless deploy --key your-key
```

---

## 📊 Environment Variables for Production

| Variable | Description | Required |
|-----------|-------------|----------|
| `LANGLY_API_KEY` | Fallback API key | No (use per-mind keys) |
| `OPENAI_API_KEY` | OpenAI API key | For `openai/*` minds |
| `ANTHROPIC_API_KEY` | Anthropic API key | For `anthropic/*` minds |
| `GOOGLE_API_KEY` | Google API key | For `google/*` minds |
| `PINECONE_KEY` | Pinecone (VectorStore) | For memory tools |

**Tip:** Use `langly.json` for per-project configuration:
```json
{
  "runtime": {
    "apiKey": "Env.OPENAI_API_KEY",
    "router": {
      "strategy": "cost-optimized",
      "maxCostPer1kTokens": 0.01
    }
  }
}
```

---

## 💰 Cost Management in Production

### 1. Set Budget Caps
```langly
guardrail Budget: MaxSpend(50.00)  // $50/month max

mind Analyst [openai/gpt-4o, temp: 0.5]
  requires Budget
```

### 2. Use Cost-Optimized Routing
```json
// langly.json
{
  "runtime": {
    "router": {
      "strategy": "cost-optimized",
      "maxCostPer1kTokens": 0.01,
      "preferredProviders": ["ollama", "together", "openai"]
    }
  }
}
```

### 3. Monitor Costs
```bash
# Runtime tracks costs automatically
langly run examples/20-role-founder.ly
# Output: 💰 Total cost: $0.0042
```

---

## 🔐 Security & Compliance

- **Guardrails block harmful content** (no manual filtering)
- **Audit trails** via `context.trace`
- **PII redaction** via `Redact(PII)`
- **Prompt injection protection** via `Block(PromptInjection)`
- **Model-agnostic** (switch providers without code changes)

---

## 📄 Quick Startup Use Cases

| Use Case | Langly Example | Deployment | Cost/Month |
|-----------|----------------|------------|-------------|
| Customer Support Bot | `20-role-founder.ly` | Vercel | ~$50 (1k conversations) |
| Content Moderation | `30-control-moderation.ly` | AWS Lambda | ~$100 (budget-capped) |
| QA Test Generator | `24-role-qa-engineer.ly` | Railway | ~$30 (1k tests) |
| UX Design Reviewer | `22-role-ux-designer.ly` | Render | ~$75 (500 reviews) |

**Total cost to launch:** <$300/month for a fully-functional AI bot!
