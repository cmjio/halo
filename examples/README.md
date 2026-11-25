# Examples

160 examples, every one real Halo: it validates, and `test/examples.test.ts` runs every pipeline in it with mocks.

Start with **`learn/`**, which teaches one idea per file and is numbered so you can read it in order. **`patterns/`** shows features in context. Every other folder is a domain, so jump to whichever looks like your problem.

| Folder | What's in it |
|---|---|
| [`learn/`](learn/) | Start here. One idea per file, in order: agents, pipes, policies, tools, gates, stores, directives, sandboxes. |
| [`patterns/`](patterns/) | Features in context: people in the loop, schemas, memory, model routing, thread state, built-in tools, remote sandboxes. |
| [`engineering/`](engineering/) | Code review, CI, incidents, migrations, and agents that write code until the tests pass. |
| [`product/`](product/) | A day's work for a founder, a PM, a designer, and a researcher. |
| [`security/`](security/) | Alert triage, phishing, access requests, leaked secrets, and dependency watch. |
| [`data-research/`](data-research/) | Text to SQL, anomaly explainers, research assistants, and an analyst swarm. |
| [`support/`](support/) | Refunds, rebooking, billing disputes, ticket routing, and moderation. |
| [`sales-marketing/`](sales-marketing/) | Outbound email, CRM hygiene, lead scoring, ads budgets, and content briefs. |
| [`finance/`](finance/) | Invoices, reconciliation, KYC, claims, fraud review, and a SQLite ledger. |
| [`legal-hr/`](legal-hr/) | Contract review, screening, onboarding, privacy requests, and regulatory change. |
| [`healthcare/`](healthcare/) | Intake, scribing, prior authorization, coding, and an FDA recall monitor. |
| [`operations/`](operations/) | Freight, warehouses, field service, maintenance, energy, and travel. |
| [`personal/`](personal/) | Email, calendars, tutoring, shopping, sport, and dinner. |
| [`projects/`](projects/) | Fixtures the code-writing examples build against (the spreadsheet engine for `engineering/software-team.halo`). |

File names are unique across folders, so `software-team.halo` names one example, and its page on the site is `/examples/software-team`.

## Reading an agent design

Most domain examples are agent designs from real work. Each file opens with a design box:

- **Users, surface, autonomy, and risk.** Who it serves, where its answers appear, and how much it does on its own.
- **Three tiers of action.** What it does freely, what waits for a person (`|! yield` before the call), and what it can never do (no method for it, a `Validate` on its answer, a gate, or a tool policy).
- **The trust boundary.** Which inputs are data, never instructions.
- **What's enforced in code.** The rules that have to hold are written as policies, gates and approvals rather than left to the prompt.
- **Test cases and a sample request** to try it with.

Below the box come the system prompt, the tools (MCP servers named for the job, or Halo's built-in GitHub, Slack, SQL, Browser and Workspace tools), and the pipelines. Where the servers are fictional, `halo plan` shows every call, its effect, where a person is asked, and the worst-case cost, all offline.

## Try one

No API key needed for any of these:

```bash
halo test examples/learn/01-hello.halo --arg name=Ada        # run offline with mocked models
halo plan examples/support/ecommerce-refund.halo             # what a run could do, before it runs
halo validate examples/                                      # check every file
```

Or open any of them in the [playground](https://halolang.com/playground), change it, and watch the plan update as you type.

## Adding one

1. Pick the folder it belongs in. Name the file for what it does (`invoice-matcher.halo`); only `learn/` uses numbers.
2. Start the file with a header box: a title line, then a few lines on what it does and how to run it. The docs site builds the example's page from it.
3. `bun test test/examples.test.ts` checks that it parses, validates, runs, and has a unique name.

A new folder needs an entry in [`catalog.ts`](catalog.ts), which the tests, the docs site, and the playground all read.

If you rename or move an example, add its old name to `site/data/renamed-examples.json`, so its old URL redirects to the new one.
