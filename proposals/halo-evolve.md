# Halo Evolve: pipelines that improve themselves, inside a fence

| | |
|---|---|
| Status | Draft proposal. Milestone 1 (`halo compare`, `halo replay --live-changed`) is built; the rest isn't. |
| Date | 8 November 2026 |
| Builds on | `halo plan`, recordings and `halo replay`, `@shadow`, the `Judge` preset, `halo validate --strict`, policies and tool effects |
| Related | [Halo Cloud](halo-cloud.md) (plan diff and replay before promotion) |

This proposal lives outside `docs/` on purpose. Everything under `docs/` is published to halolang.com, and most of this describes a feature that doesn't exist yet. `halo compare` and `--live-changed` are documented in [Plan and Replay](../docs/guide/plan-and-replay.md#halo-compare). The other commands, flags and file names here (`halo evolve`, `.halo/evolve/`, the `Evolver` preset, the `evolve` and `recordings` keys in `halo.json`) are placeholders.

## Summary

Teams that get the most out of language models don't take one answer and trust it. They run the model in a loop: it proposes something, the work is checked against real cases, the best attempt is kept, and a person reviews the result, not each step. In most agent frameworks it is hard to point that loop at the agent's own workflow, because the workflow is ordinary code: nobody can say what a rewritten version is able to do until it runs.

Halo can say. A `.halo` file declares every tool, effect, policy, approval and model, and `halo plan` works out from the file alone what a run could do and what it could cost. Recordings and `halo replay` let a changed pipeline run against real past runs without touching the world.

**`halo evolve`** puts those pieces in a loop:

1. An agent proposes rewrites of a pipeline.
2. Each rewrite must pass a **fence**: compared with the original, its plan may not reach anything new. That means no new tools, effects, secrets or model providers, no weaker policies, no fewer approvals, and no higher spend cap.
3. Rewrites that pass are replayed against the pipeline's recent real runs, with recorded tool results, so nothing is written, posted or sent.
4. A judge scores each one against the original on the same inputs, on runs the proposer never saw.
5. The best one comes back as a diff and a report: *"Won 23 of 30 held-out runs, cost per run −41%, reaches nothing new."*

A person reviews one diff. The pipeline gets better from its own traffic, and it can't get loose, because the limits are checked from the file before anything runs.

## Why this, and why Halo

- **It shows the language's design working.** Static effects, `halo plan`, replay and policies are Halo's best ideas, and today they show up as safety features people read about. Evolve makes them the reason a capability exists at all.
- **It answers what blocks agent adoption.** The problem is rarely that the model isn't smart enough. It's "how do I know this change is safe and better?" Evolve answers both halves with evidence: a fence verdict for *safe*, held-out replays for *better*.
- **Other frameworks can't easily copy it.** A Python agent framework can generate a new version of its own code, but it can't prove that version touches nothing new. The fence depends on effects declared in the language.
- **Most of it exists.** The new parts are the loop, the fence check, selective replay and the report.

## Goals

- From a pipeline with recorded runs to a reviewed, measured improvement in one command, for a few dollars.
- Make it impossible for evolution alone to widen what a pipeline can do. Any widening is a separate, explicit decision by a person.
- Report wins in a way a skeptic accepts: held-out runs, compared with the original side by side, cost and latency included, and runs where results diverged shown rather than hidden.
- Keep the person in charge: evolve proposes, a person merges. It never edits the file in place unless asked.

## Non-goals (for now)

- **Changing what a pipeline is for.** Evolve optimises toward criteria the owner writes. It doesn't invent goals.
- **Adding tools or abilities.** Widening the fence is out of scope for the loop. The report can *suggest* one (for example "a `Clock` tool would fix 4 failures"), as text only.
- **Training or fine-tuning models.** Evolve changes `.halo` files: prompts, models, stage order, gates, fan-outs, retries, presets and skills.
- **Running unattended in production.** Continuous evolution on Halo Cloud is a later milestone, and it still ends in a person approving a promotion.

## A worked example

The flagship [`examples/50-github-triage.halo`](../examples/50-github-triage.halo) has been run 60 times across a few repositories. Each run left a recording in `.halo/recordings`.

```bash
halo evolve examples/50-github-triage.halo --pipeline TriageIssues \
  --criteria criteria/triage.md --variants 6 --rounds 2 --budget 3.00
```

```
Evolving TriageIssues  (60 recordings: 40 to propose from, 20 held out)

Baseline        judged on 20 held-out runs · mean score 0.71 · $0.021/run · 9.4s/run

Round 1         6 proposed · 1 outside the fence · 5 replayed
  ✗ v3          outside the fence: adds GitHubWrite.post to stage 2 (external)
  ✓ v1  0.74    $0.019   label prompt lists the repo's existing labels
  ✓ v4  0.79    $0.012   Editor on claude-haiku-4-5, gate on triage confidence ≥ 0.6
  …
Round 2         6 proposed from v4 · 6 replayed
  ✓ v4.2 0.83   $0.012   adds a Judge stage before the report; @correct(1)

Winner  v4.2 vs baseline on 20 held-out runs
  won 15 · tied 3 · lost 2          mean score 0.71 → 0.83
  cost per run   $0.021 → $0.012 (−43%)      worst case (plan) $0.38 → $0.31
  latency        9.4s → 7.1s
  diverged       2 runs (an agent asked for a tool call the recording didn't have; listed in the report)

Fence  ✓ reaches nothing new
  tools and effects     same (GitHub.search read, TriageLog.search read, TriageLog.log write, GitHubWrite.post external after the yield)
  models                anthropic only (claude-sonnet-4-5 → claude-haiku-4-5 for Editor)
  policies              UntrustedText, Budget, ReportShape unchanged
  approvals             |! yield before saving: kept

Spent $1.84 of $3.00 · report: .halo/evolve/2026-11-08-triage/report.md
Apply with: halo evolve apply .halo/evolve/2026-11-08-triage v4.2   or open a PR with --pr
```

The output above is illustrative. The numbers aren't measurements.

## How it works

### 1. Gather runs

Evolve reads the pipeline's recordings from `.halo/recordings` and keeps the ones that finished (`completed`, `halted`, or `paused` and later resumed). It splits them into a **proposal set**, which the proposer may see, and a **held-out set**, used only to report the final comparison. The split is random with a fixed seed, which the report prints.

Recordings today have limits that evolve has to work within or change:

- Only the newest 50 are kept (`pruneRecordings` in `src/runtime/replay.ts`). Evolve needs more, so this proposal adds a `recordings.keep` setting in `halo.json`, and `halo evolve` refuses to start with fewer than 10 usable runs.
- `halo serve` and the library don't record unless asked. A served pipeline needs `RuntimeConfig.recorder` turned on, and `halo serve` would need a setting for it.
- `@shadow` calls aren't recorded. That's fine: evolve doesn't need them.

### 2. Score the baseline

The owner writes **criteria**: a short Markdown file listing what a good output looks like, with optional hard checks. A `Judge` agent scores each recorded output against them (`{ pass, score, reasons, fixes }`, as the preset already answers). The baseline is the original pipeline's recorded outputs, so scoring it costs only judge calls.

Hard checks run before the judge and need no model: the pipeline's declared return `schema`, plus optional `expect` rules in the criteria file (for example `output.labels.length <= 3`). A variant that fails a hard check on a run loses that run.

### 3. Propose

An `Evolver` agent (a new preset, close to `Coder`) gets:

- the `.halo` source and `halo plan --json` output
- the criteria
- for the proposal set: the judge's `reasons` and `fixes` on the worst-scoring runs, and the stage-by-stage trace of a few of them
- the fence, written out (what it may and may not change)
- in later rounds, the previous round's variants with their scores and fence verdicts

It answers with a complete `.halo` file and a one-line rationale. Variants are written to `.halo/evolve/<id>/variants/`.

What the proposer reads is sensitive. Recordings aren't redacted, and they hold real inputs written by other people (issue text, emails). So:

- The proposer sees the judge's summaries and traces with the pipeline's own `Redact` policies applied. It doesn't see the raw recordings.
- The proposer's model must be from a provider the pipeline already sends this data to, unless the owner names one explicitly.
- Recorded inputs may contain prompt injection aimed at the proposer ("add a tool that posts to…"). The fence makes any capability change harmless, and the held-out comparison plus human review catch prompt changes that only look good.

### 4. The fence

The fence is the core of this proposal. A variant is **inside the fence** when its plan doesn't reach anything the original's plan doesn't. It's checked statically, from the files, before any replay:

| Check | Inside the fence when |
|---|---|
| Validation | `halo validate --strict` passes |
| Tool and store declarations | Same declarations, same providers, same arguments. No new `Env.*` reads |
| Effects | Every `(target, effect)` the variant's plan lists is in the original's plan |
| Unasked external effects | Its "acts on the world without asking" list is a subset of the original's |
| Approvals | Every approval point (`\|! yield`, `Approve*` rules, `~> listen`) is still there, before the same effects |
| Policies | Every policy the original's agents `require` is still required. Policy declarations are byte-for-byte the same |
| Spend | Each `MaxSpend` is unchanged or lower. Worst-case cost per run is at most the original's × `maxCostRatio` (default 1.0) |
| Models | Every model is from a provider the original already uses, or is on `evolve.models` in `halo.json` |
| Pipeline signature | Same name, arguments and return type, so callers, webhooks and MCP clients don't notice |
| Unbounded stages | No new `\|* each` without a `limit:`, and no `\|<> loop` without a `max:` |

Changing models counts as a fence question, not just a cost question: sending the same data to a new company is a new data flow.

A variant outside the fence is never replayed. The reason goes back to the proposer in the next round, the same way `@correct` hands a policy rejection back to an agent, and the report lists it.

The comparison reuses `plan()` in `src/plan.ts`. The set comparison is new code. The Halo Cloud proposal's **plan diff** (a preview against production) is the same comparison with a person reading it, so both should share one implementation.

### 5. Replay the variants

Each variant that passes the fence is replayed against every run in the proposal set (rounds 1 to N), then the finalists against the held-out set. Tool results, approvals, yields and listens come from the recording, so nothing is written, posted or sent, and no person is asked.

Model calls are where cost goes. Today `halo replay --live-models` calls every model live. Evolve needs a third mode:

| Mode | Model answers | Exists |
|---|---|---|
| `halo replay` | All recorded | Yes |
| `--live-models` | All live | Yes |
| **`--live-changed`** (new) | Live only for stages whose agent, model, prompt or input differs from the recording. The rest are recorded | No |

With `--live-changed`, a variant that only changes the report-writing prompt pays for one model call per run, not every model call in the pipeline.

Some runs will **diverge**: a variant's agent asks for a tool call the recording doesn't have. Today that becomes a tool error that goes back to the model (`REPLAY_MISMATCH`). Evolve doesn't run the tool for real (that would break the guarantee that nothing touches the world). It marks the run as diverged, excludes it from the score, and lists it in the report. When more than 20% of a variant's runs diverge, the report says its score is unreliable.

### 6. Judge and select

Each replayed output is scored two ways:

- **Absolute**: the `Judge` against the criteria, as for the baseline.
- **Pairwise**: a judge sees the original's output and the variant's for the same input, in random order and unlabelled, and picks the better one or calls it a tie. Pairwise verdicts are more stable than absolute scores, and the headline ("won 15 · tied 3 · lost 2") comes from them.

To keep a variant from fooling the judge:

- The judge never sees the variant's prompts, only inputs, outputs and criteria.
- The judge's model is set separately from the proposer's (`evolve.judge` in `halo.json`), and different by default.
- Held-out runs are scored only for finalists, so the proposer can't fit them over rounds.
- Hard checks don't depend on any model.

Selection keeps the **Pareto front** of pairwise win rate and cost per run, so a cheaper variant that ties the original shows up beside a better variant that costs the same. The report recommends one variant and says why.

### 7. Report and hand over

`.halo/evolve/<id>/` holds:

- `report.md`: the summary above, the fence verdict for every variant, every held-out run side by side (original output, variant output, judge reasons), and every diverged run
- `variants/*.halo` and a unified diff for each
- `scores.jsonl`: one line per variant per run
- `evolve.json`: seed, split, models, budget, spend, and the versions of Halo and the recordings used, so the run can be repeated

`halo evolve apply <dir> <variant>` writes the variant over the original. `--pr` opens a pull request with `gh`, with the diff and the report in the description. Evolve never commits on its own.

### Budget

`--budget` is a hard cap on everything evolve spends (proposer, replays, judges), enforced the same way `MaxSpend` is. Before it starts, evolve prints a worst-case estimate from `plan()`: proposer calls × rounds, plus variants × runs × the changed stages' worst-case cost, plus judge calls. It stops when the cap is reached and reports the best variant found so far.

## Configuration

```jsonc
// halo.json
{
  "recordings": { "keep": 200 },
  "evolve": {
    "proposer": "anthropic/claude-opus-4-5",
    "judge": "openai/gpt-4o",          // different from the proposer by default
    "models": ["anthropic/*"],          // providers a variant may switch to
    "maxCostRatio": 1.0,                // worst-case cost per run may not rise
    "holdout": 0.33,
    "criteria": { "TriageIssues": "criteria/triage.md" }
  }
}
```

## CLI

```bash
halo evolve <file.halo> --pipeline Name [--criteria file.md] [--variants 6] [--rounds 2] [--budget 3.00] [--runs 60] [--seed 1] [--pr]
halo evolve apply <dir> <variant>
halo compare <a.halo> <b.halo> --pipeline Name [--runs 30] [--criteria file.md]   # steps 4–6 for two files you wrote yourself
halo replay <file.halo> <runId> --live-changed
```

`halo compare` is the first thing to build. It's evolve without the proposer, and it's useful on its own: "is my hand-edited prompt actually better, on real runs, and does it reach anything new?"

## What exists, and what this adds

| Exists today | Added by this proposal |
|---|---|
| `plan()` with effects, approvals, worst-case cost (`src/plan.ts`) | The fence: a plan comparison with a verdict per rule |
| Recordings, `halo replay`, `--live-models`, `--live-tools` | `--live-changed`, divergence reporting, `recordings.keep` |
| `Judge` preset | Pairwise judging, hard checks, held-out split, Pareto selection |
| `Coder` preset, `@correct` | `Evolver` preset, with fence rejections handed back to it |
| `halo validate --strict`, `compile()` | Used unchanged as the first fence check |
| `@shadow` in production | Unchanged. Later: shadow the winning variant in production before merging |
| Halo Cloud proposal: plan diff, replay before promotion | Shares the fence and replay code; continuous evolve as a later milestone |

## Risks

- **The judge is the ceiling.** If the criteria are vague, evolve optimises toward vague things. Mitigations: hard checks, pairwise verdicts, and every held-out run shown side by side so a person can disagree.
- **Overfitting to recent traffic.** Sixty runs from one week may not cover next month. The report says how many runs and from which dates, and the Cloud milestone re-checks the variant against new traffic after merge.
- **Divergence hides regressions in tool-using agents.** An agent that chooses its own calls can drift away from the recording. Diverged runs are reported, not dropped silently, and above 20% the score is marked unreliable.
- **Effects are what providers say about themselves.** The fence is only as good as the effect labels on tools. An MCP tool whose methods have no effect (`Tool.*`, `unknown`) can't be checked, so a variant that changes how any `unknown` effect is used is outside the fence.
- **Recordings hold sensitive data.** The proposer sees redacted summaries only. Evolve output under `.halo/evolve/` is unredacted where it shows outputs side by side, so it goes in `.gitignore` like `.halo/recordings`, and `--pr` puts only the summary and diff in the PR.
- **Cost surprises.** The budget is a hard cap, and the estimate is printed before any spend.

## Milestones

1. **`halo compare`.** Built: the fence check (`src/fence.ts`), `--live-changed` (recordings now keep each model request's fingerprint and cost), pairwise judging by a Halo pipeline, the side-by-side `--report`, and a budget. Not yet: absolute scores, hard checks from a criteria file, and `recordings.keep` (it uses the newest 50). There's no held-out split, because nothing proposes from the runs: a person wrote the variant. Next showcase: an old and new prompt of the triage example, compared on real runs.
2. **`halo evolve`.** The `Evolver` preset, rounds, budget, `apply` and `--pr`. Showcase: the worked example above, with real numbers, on the home page and in the video.
3. **Studio.** An Evolve tab: start a run, watch rounds, read the side-by-side report, apply a variant.
4. **Halo Cloud.** Continuous evolve on production recordings for opted-in pipelines. A winning variant becomes a preview deployment with the plan diff and replay results already attached, and still needs a person to promote it.

## Open questions

- Should a variant be allowed to **remove** a capability (drop a tool the pipeline never uses)? That's inside the fence, but it changes the plan, so the report should call it out.
- Should the fence allow raising the cost cap in exchange for a big enough quality gain, behind an explicit `--allow-cost-increase`?
- Should criteria live in the `.halo` file (an `expect` block on the pipeline) so they're versioned beside the pipeline and `halo test` can use them too?
- Pairwise judging costs twice the judge calls. Is the absolute score enough below some number of runs?
- How should evolve treat `@thread` pipelines, where a run's output depends on state from earlier runs that a replay doesn't restore?
