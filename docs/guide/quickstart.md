# Quickstart

## 1. Install

Halo runs on [Bun](https://bun.sh). Clone the repository and install its dependencies:

```bash
git clone <halo repo> halo && cd halo
bun install
bun run index.ts --help
```

`bun run index.ts` is the CLI. The docs call it `halo`; to use that name, link the package once:

```bash
bun link
```

## 2. Create a project

```bash
halo init my-bot
cd my-bot
```

This creates:

- `main.halo`: a starter pipeline (an agent with a system prompt and two policies)
- `.env.example`: the API key variables Halo reads
- `.gitignore`: ignores `.env` and `.halo/` (paused runs, telemetry, the local vector store)
- `README.md`

## 3. Set an API key

Each provider reads its own variable. Set the ones for the models you use:

| Model prefix | Variable |
|---|---|
| `anthropic/`, `claude/`, `claude-*` | `ANTHROPIC_API_KEY` |
| `openai/`, `oai/`, `gpt-*`, `o1`… | `OPENAI_API_KEY` |
| `google/`, `gemini/`, `gemini-*` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| `openrouter/`, `or/` | `OPENROUTER_API_KEY` |
| `together/`, `tog/` | `TOGETHER_API_KEY` |
| `replicate/`, `rep/` | `REPLICATE_API_TOKEN` or `REPLICATE_API_KEY` |
| `ollama/`, `local/` | none (uses `OLLAMA_HOST`, default `http://localhost:11434`) |

If a provider has no key of its own, Halo uses the `--api-key` flag, then `HALO_API_KEY`, then the legacy `LANGLY_API_KEY`. Bun loads `.env` automatically.

```bash
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
```

## 4. Read the pipeline

`main.halo` looks like this:

```halo
policy Safe   : Block(PromptInjection) & Redact(APIKey)
policy Budget : MaxSpend(0.25)

agent Writer [anthropic/claude-haiku-4-5, temp: 0.4]
  system """
    You write short, friendly explanations for curious people.
  """
  requires Safe, Budget

pipeline Explain(topic: String) -> Result:
  topic
    |> Writer.explain("Explain {{topic}} in three sentences.") as explanation
    |? (context.data.explanation != null)
    |> System.Print()
```

## 5. Run it

```bash
halo validate .                                   # check syntax and names
halo test main.halo --arg topic="tide pools"      # offline: every call mocked
halo run main.halo --arg topic="tide pools"       # for real
halo debug main.halo --arg topic="tide pools"     # print each stage, prompt, and model call
```

Pass arguments with `--arg key=value` (repeatable; values that parse as JSON are parsed) or `--args '{"topic": "tide pools"}'`. If a file has several pipelines, choose one with `--pipeline Name`. Run `halo --help` for every flag.

The repository's `examples/` directory has 40+ programs. `examples/50-github-triage.halo` triages a real GitHub repo and needs only `ANTHROPIC_API_KEY`:

```bash
halo run examples/50-github-triage.halo --arg repo=oven-sh/bun --arg limit=8
```

## Next steps

- [Core Concepts](./concepts.md)
- [Language Reference](./reference.md)
- [Using Halo as a library](./sdk.md)
