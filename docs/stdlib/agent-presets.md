# Agent Presets

A preset is a ready-made agent: a system prompt, sensible settings, and the skills it needs. Pick one with `preset:` and you only choose the model.

```halo
agent Sorter   [openai/gpt-4o-mini, preset: Classifier]
  system "Labels: billing, bug, feature_request, other."

agent Reviewer [anthropic/claude-sonnet-4-5, preset: CodeReviewer]
agent Gate     [anthropic/claude-haiku-4-5, preset: Judge]

pipeline Route(email: String) -> Result:
  email
    |> Sorter.classify() as kind
    |? (context.data.kind.confidence >= 0.7)
```

| Preset | Does | Settings | Skills | Answers |
|---|---|---|---|---|
| `Summarizer` | Short, faithful summaries that keep names, numbers and decisions | `temp: 0.2` | | text |
| `Classifier` | Picks exactly one label from the ones you give | `temp: 0` | | `{ label, confidence, reason }` |
| `Extractor` | Pulls the fields you ask for out of text, `null` when absent | `temp: 0` | `data-extraction` | the requested fields |
| `Judge` | Grades work against your criteria | `temp: 0` | | `{ pass, score, reasons, fixes }` |
| `Researcher` | Searches and reads with its tools, answers with cited sources | `temp: 0.3, max_steps: 20, tools: auto` | `web-research` | text with sources |
| `Writer` | Clear prose for the audience you name | `temp: 0.6` | | text |
| `Editor` | Tightens and corrects text, keeping meaning and voice | `temp: 0.2` | | text |
| `Planner` | Breaks a goal into ordered, checkable steps | `temp: 0.2` | | `{ goal, assumptions, steps: [{ id, task, depends_on, done_when }], risks }` |
| `Coder` | Changes code with its tools in small, tested steps | `temp: 0, max_steps: 40, tools: auto` | `write-tests` | a summary of what it changed |
| `CodeReviewer` | Reviews a diff for bugs and security problems | `temp: 0` | `code-review` | `{ verdict, summary, findings }` |
| `Translator` | Translates into `to:`, keeping formatting and placeholders | `temp: 0.2` | | text |
| `Triager` | Triages bug reports: kind, severity, duplicate, what's missing | `temp: 0` | `bug-triage` | `{ kind, severity, reproducible, duplicate_of, area, labels, missing, summary, reply }` |

`halo agents` prints this list. Preset names are case-insensitive, and `halo validate` reports one that doesn't exist.

## Changing a preset

Anything you write on the agent wins:

- **Settings** in the brackets replace the preset's: `[openai/gpt-4o, preset: Writer, temp: 0.9]`.
- **`system`** is added after the preset's prompt, so use it for what's specific to you: the labels to choose from, the criteria to judge by, your audience, your codebase's conventions.
- **`skills:`** adds to the preset's skills: `[..., preset: CodeReviewer, skills: "house-style"]` (see [Skills](./skills.md)).
- **`equips`** and **`requires`** work as on any agent. `Researcher` and `Coder` use `tools: auto`, so they can call every tool they equip; give them tools and a [tool policy](./policies.md#tool-rules) to fence them in:

```halo
policy ReadOnly : AllowEffects(read)

tool Web    : WebSearch()
tool Reader : Browser(maxChars: 8000)
tool Repo   : Git(".")

agent Scout [anthropic/claude-sonnet-4-5, preset: Researcher]
  equips Web, Reader
  requires ReadOnly

agent Reviewer [anthropic/claude-sonnet-4-5, preset: CodeReviewer, tools: auto]
  equips Repo
```

`Coder` is best given a computer to work on: `[..., preset: Coder, sandbox: "e2b"]` gives it a fresh cloud sandbox for each run (see [Remote Computers](./remote.md#sandbox-agents)).

Presets that answer JSON tell the model the exact fields, and Halo parses JSON answers, so gates can read them directly: `|? (context.data.verdict.pass == true)`. To make a pipeline fail when the shape is wrong, give it a `schema` return type.
