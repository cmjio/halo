# Examples

Every file here is real Halo: it validates, and `test/examples.test.ts` runs every pipeline in it with mocks. Read them in order, or jump to whatever looks like your problem.

| Folder | | What's in it |
|---|---|---|
| [`learn/`](learn/) | 01–19 | 🌱 One idea per file: agents, pipes, policies, tools, gates, stores, directives. Start here. |
| [`roles/`](roles/) | 20–25 | 🧑‍💼 A day's work for a founder, an engineer, a designer, a researcher, QA, and a PM. |
| [`systems/`](systems/) | 30–38 | ⚙️ Bigger shapes: moderation routing, agent swarms, model routers, people in the loop, memory. |
| [`industries/`](industries/) | 40–46 | 🏥 Healthcare, legal, e-commerce, fintech, real estate, insurance, recruiting. |
| [`everyday/`](everyday/) | 60–66 | 🍳 Hiring, homework, shopping, team reports, sport, and dinner. |
| [`real-world/`](real-world/) | 50, 70–80 | 🚀 Run these for real: GitHub triage, a security watch, a team of agents that writes code. |
| [`casebook/`](casebook/) | 001–100 | 📚 100 agent designs from real work, each with what it may do freely, must confirm, or must never do. |
| [`projects/`](projects/) | | Fixtures the code-writing examples build against (the spreadsheet engine for 74). |

Numbers are unique across the folders, so `74-software-team.halo` names one example wherever it lives.

## Try one

No API key needed for any of these:

```bash
halo test examples/learn/01-hello.halo --arg name=Ada        # run offline with mocked models
halo plan examples/real-world/75-research-assistant.halo     # what a run could do, before it runs
halo validate examples/                                      # check every file
```

Or open any of them in the [playground](https://halolang.com/playground), change it, and watch the plan update as you type.

## Adding one

1. Pick the folder it belongs in and the next free number in that folder's range.
2. Start the file with a header box: a title line, then a few lines on what it teaches and how to run it (see `learn/01-hello.halo`). The docs site builds the example's page from it.
3. `bun test test/examples.test.ts` checks that it parses, validates, and runs.

A new section is a new folder plus an entry in [`catalog.ts`](catalog.ts), which the tests, the docs site, and the playground all read.
