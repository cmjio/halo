# Quickstart

## 1. Install

One command. On macOS and Linux:

```bash
curl -fsSL https://halolang.com/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://halolang.com/install.ps1 | iex
```

This installs `halo`, a single standalone binary with Bun built in, so nothing else needs to be installed. The script picks the build for your OS and CPU (Intel or ARM; glibc or musl on Linux), checks it against the release's `SHA256SUMS`, puts it in `~/.halo/bin`, and adds that folder to your shell's `PATH`. Check it with `halo --version`; update with `halo upgrade`.

| Variable | Effect |
|---|---|
| `HALO_VERSION=0.1.0` | Install that version instead of the latest |
| `HALO_INSTALL=/opt/halo` | Install into `/opt/halo/bin` |
| `HALO_NO_MODIFY_PATH=1` | Leave your shell's rc file alone |

On Alpine, install the C++ runtime first: `apk add libstdc++ libgcc`. To uninstall, delete `~/.halo/bin` and the `PATH` line the installer added.

Already using npm, Docker or GitHub Actions? `npx @halolang/halo`, `docker run ghcr.io/cmjio/halo` and `uses: cmjio/halo` work too (from 0.5.0). See [Use what you already have](./production/deploying.md#use-what-you-already-have).

To work on Halo itself, run it from source: `git clone https://github.com/cmjio/halo && cd halo && bun install && bun link`, and `halo` runs your checkout.

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

To start from a complete app instead (a webhook, approvals, deployment files and offline tests), use a [blueprint](./production/blueprints.md): `halo init my-inbox --template support-inbox`.

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

If a provider has no key of its own, Halo uses the `--api-key` flag, then `HALO_API_KEY`. Bun loads `.env` automatically.

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
