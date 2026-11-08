# Plan and Replay

`halo plan` shows what a run could do before it runs. `halo replay` runs a recorded run again with the answers it got, without calling any model. `halo compare` puts the two together: it checks that a changed pipeline can't do anything the original couldn't, then replays the original's recorded runs against it and has a judge say which outputs are better. For a `@checkpoint` run, `halo history` lists every step and `halo rewind` continues from any of them.

## `halo plan`

```bash
halo plan tidy.halo                    # every pipeline in the file
halo plan tidy.halo --pipeline Tidy    # one
halo plan tidy.halo --json             # the same, as JSON
```

It reads the file and runs nothing: no model calls, no tool calls, no API keys needed. For this file:

```halo
policy Careful : AllowTools("Files.*") & DenyTools("Files.delete") & ApproveEffects(write) & MaxSpend(0.50)

tool Files : Workspace("./notes", write: true)
tool Chat  : Slack(Env.SLACK_BOT_TOKEN, channel: "#notes")

agent Clerk [openai/gpt-4o, max_steps: 8]
  equips Files
  requires Careful

pipeline Tidy(task: String) -> Result:
  task
    |> Clerk.work(tools: [Files]) as report
    |> Chat.post(text: "{{report}}")
```

it prints:

```
Plan for Tidy

  1      Clerk.work [openai/gpt-4o] ≤ $1.3802
         may call Files.read: read
         may call Files.write: write · needs approval (Careful)
         may call Files.edit: write · needs approval (Careful)
         may call Files.list: read
         may call Files.glob: read
         may call Files.search: read
         may call Files.mkdir: write · needs approval (Careful)
         chooses its own calls, up to 8 steps
  2      Chat.post
         calls Chat.post: external
         Slack

Acts on the world without asking: Chat.post
Needs a person's approval: Files.write, Files.edit, Files.mkdir
Worst-case model cost: $1.3802, but MaxSpend stops the run at $0.50
Spend limit: Clerk stops once the run has spent $0.50 (policy Careful)
```

For each stage (numbered as in the pipeline; `3.1` is a stage inside a pipeline that stage 3 calls), it lists:

- **Model calls**, with the model and a worst-case cost.
- **Tool calls** the pipeline makes (`calls`) and the ones an agent may choose (`may call`), each with its effect: `read`, `write`, or `external` (see [tool rules](../stdlib/policies.md#tool-rules)). Methods the agent's policies hide aren't listed, and calls a policy sends to a person are marked.
- **How often** a stage can run: `×3` inside a `|<> loop` with `max: 3` (3 when no `max` is given), `× each item` inside `|* each`, `if …` for a branch arm.

The summary names every `external` call that runs without asking, every call that needs approval, and every `MaxSpend` limit.

### What the cost means

The cost is an upper bound from the model's price list, not a forecast:

- Each model call counts its written instructions and system prompt, plus 2,000 tokens for inputs it can't know, and a full reply of `max_tokens` (4,096 when not set).
- An agent with tools counts `max_steps + 1` requests, each resending the conversation so far, grown by a full reply per request.
- Loops multiply by their `max`. Every branch arm is counted, though only one runs.
- `|* each` makes the total `unbounded`, because it depends on the list's length.
- A model with no price list is left out, and the summary says so.

When every agent that calls a model has a `MaxSpend`, the run can't spend more than the highest of those limits, and the summary says where it stops.

### What it doesn't know

- An MCP tool's methods come from its server, which `halo plan` doesn't start. They show as `Tool.*`, with the effect not described.
- A provider registered in TypeScript without `info` (see [Custom Tools](./integrations/custom-tools.md)) has no effects to show.
- `DenyArgs` rules aren't shown: a method they restrict is still listed.
- An effect is what the provider says about itself. For MCP servers and [tool packages](./tool-packages.md), that is the server's or publisher's claim.

`halo plan` exits with status 1 when the file has validation errors, after printing them and the plan.

## Recordings

Every `halo run` and `halo debug` keeps a recording of what the run got from outside, in order:

- each model answer, including the tool calls an agent asked for, with what the call cost and a fingerprint of the request (a hash of the model, prompt or conversation, and settings)
- each tool result, whether the pipeline or an agent made the call
- each answer to a tool-call approval
- each answer to `|! yield` and each `~> listen` event, whether it came from the terminal, a handler, or `halo resume`
- how the run ended: its status and output, or the error

Recordings are kept in `.halo/recordings/<runId>.jsonl`. When a run was recorded, `halo run` ends its summary line with the run id and the command that replays it:

```
1834ms · 3 LLM call(s) · 2 tool call(s) · $0.0121 · run 6f9696ef-… (halo replay tidy.halo 6f9696ef-…)
```

 When a new run starts, all but the newest 50 are deleted. `halo resume` adds to the paused run's recording. There is no recording with `--mock` (or in `halo test`), with `--checkpoint`, with `--no-record`, or for a replay.

**Recordings are not redacted.** They hold model answers and tool results as they arrived, before `Redact` policies ran: prompts' answers, file contents, API responses. Keep `.halo/recordings` out of version control and shared storage, and pass `--no-record` for runs that handle data you shouldn't keep.

`halo serve`, `halo mcp`, and the library don't record unless you ask (see [From TypeScript](#from-typescript)).

## `halo replay`

```bash
halo replay tidy.halo 6f9696ef-1c2b-4c47-9a1e-3f0c2d1b9a77
```

The run id is in `halo run`'s summary line, in the name of the recording's file, in Studio, and in `halo run --json` output. Replay runs the recorded pipeline with the recorded arguments, against the current file. Each model call, tool call, approval, `|! yield` and `~> listen` gets the next answer the recording has for it, so nothing is sent to a model, no tool runs, and nobody is asked. Afterwards it says whether the output matches:

```
✓ Same output as the recorded run 6f9696ef-…
```

or `≠ Different from the recorded run …`, with what the recorded run ended with.

Use it to check that a change to the pipeline doesn't change the result, to look at a failure again without paying for the models, or (with `--live-models` or `--live-changed`) to try new prompts against the same tool results. `--live-changed` pays only for the stages a change touched: edit the last prompt of a five-stage pipeline, and the first four answers come from the recording. It prints how many answers it reused and how many it called live. A recording made before fingerprints were kept can't be checked, so its model calls all go live, and the replay says so.

| Flag | Replays | Calls for real |
|---|---|---|
| (none) | Model answers and tool results | Nothing |
| `--live-models` | Tool results | The models: new prompts against the same tool results |
| `--live-changed` | Tool results, and the model answers whose requests didn't change | Only the models whose request changed (a new prompt, model or setting, or an earlier answer that changed), and calls the recording has none for |
| `--live-tools` | Model answers | The tools: **writes, posts and shell commands run again** |

When the pipeline asks for something the recording doesn't have (a new agent stage, a tool the recorded run never called, one more call than was recorded, or a different model answer leading to a different tool call), the run fails with `REPLAY_MISMATCH`: "the pipeline or its input changed". A tool call an agent chose is the exception: the mismatch goes back to the model as a tool error, like any other failed tool call.

Limits:

- A call to any tool declared in the file that the recording has no result for fails with `REPLAY_MISMATCH`, unless you pass `--live-tools`. Nothing runs for real by accident.
- Recordings made before `|! yield` answers were recorded have none: a replay of one approves every yield, as `halo test` does.
- `@shadow` calls aren't recorded.
- Replay follows the recorded order per target. If parallel stages (`|*`, `each`) call the same target, they can get each other's answers.

## `halo compare`

```bash
halo compare triage.halo --from main          # the file as it is now, against the file on main
halo compare triage.halo --from HEAD~1 --runs 30 --criteria criteria.md --budget 2.00 --report compare.md
halo compare triage.halo triage-v2.halo       # or two files
```

It answers two questions about a changed pipeline (`b`), using the runs the original (`a`) really had.

With `--from <rev>`, `a` is the file as it was at a git revision (a branch, a tag, `HEAD~1`, a commit) and `b` is the file as it is in your working copy. That's the usual way to use it: change the pipeline in place, keep its name, and compare before you commit or in the pull request. Recordings are found by pipeline name, so a pipeline that keeps its name keeps its recorded runs. A copy under a new name (`TriageV2`) has none of them, and it reuses no recorded model answers where it calls agents under new names.

**1. Does b reach anything a couldn't?** From the two files, before anything runs, b must be inside the *fence*:

| Check | b passes when |
|---|---|
| signature | The pipeline's arguments and return type (and its schema) are the same |
| tools | The same tool and store declarations, with the same arguments (so the same secrets) |
| effects | Every tool call in b's plan, with its effect, is in a's plan |
| unasked effects | Nothing new writes or calls out without asking |
| approvals | No `\|! yield` or `~> listen` removed, and no call that needed approval now goes without |
| policies | Policy declarations unchanged, every agent still requires what it did, and a new agent requires every policy all of a's agents required |
| equips | No agent equips a tool or store it couldn't see before |
| models | Every model (including `@shadow` models) is from a provider a already sends prompts to, or matches `--allow-model` |
| cost | b's worst-case cost per run (its `MaxSpend` cap, or its plan's total) is no higher than a's, times `--max-cost-ratio` (1.0) |
| spend limits | No `MaxSpend` raised or removed |
| bounds | No new `\|* each` without a `limit:` |

When b is outside the fence, `halo compare` prints what it found and stops with status 1. It doesn't replay b. Widening what a pipeline can do is a decision for a person to make on purpose, after reading the diff and the new `halo plan`.

**2. Is b better on real runs?** It takes a's newest recorded runs that completed or halted (`--runs`, 20), and replays each against b with `--live-changed`: tool results, approvals, yields and events come from the recording, so nothing is written, posted or sent, and only the model calls b changed go to the model. Then, for each run:

| Outcome | Meaning |
|---|---|
| `same` | b gave exactly a's output. No judge is asked |
| `better` / `worse` / `tie` | Both completed with different outputs, and the judge picked |
| `now halts` / `no longer halts` / `both halt` | A gate stopped one, or both |
| `now pauses` | b waits for something a didn't |
| `now fails` | b failed where a didn't |
| `diverged` | b asked for something the recording has no answer for, such as a tool call its agent chose differently or a new tool stage, or a tool asked something new fed b's last model answer (see below). It isn't scored, because finding out would mean running the tool for real |

A tool that b calls with different arguments still gets the result a's call got, because running it could write or send something. That result is **stale**, and so is anything built on it. Recordings keep a fingerprint of each tool call, so `halo compare` can tell:

- When the stale results all come after b's last model answer, that answer is compared instead of the output. A pipeline that ends by saving its report (`|> Log.write(content: report)`) returns the save's recorded result whatever it wrote, so its outputs would always look the same. The run's line says `(on Editor.write_report's answer)`, and the report shows both answers.
- When a stale result went into that answer, the run is `diverged`, and its line names the tool.

The **judge** sees the run's input, the criteria, and both outputs, in random order (`--seed`, 1) and unlabelled, and picks one or calls a tie. It's a small Halo pipeline on `--judge`'s model, by default the priciest model a already uses, so judging sends the data nowhere new. `--criteria <file.md>` says what a better output is for this pipeline; without it the judge uses a general one. `--no-judge` skips judging and counts differing outputs as ties.

It ends with a summary:

```
Won 15 · tied 3 · lost 2
Also: 1 now halts, 1 diverged
Cost per run  $0.0210 → $0.0120 (-43%), estimated from live calls and the recorded cost of reused ones
Spent $0.3100 of $1.00 · report: compare.md (unredacted)
```

- **Cost per run** is a's recorded cost against b's estimate: what b's live calls cost plus what the reused answers cost when they were recorded. It counts only runs that finished both times.
- **`--budget`** (default $1.00) stops it starting new runs once live calls and judging have cost that much. One run can still spend up to b's own worst case.
- **`--report <file.md>`** writes every run side by side: input, both outputs, the judge's reason, and how many model answers were reused. It holds unredacted inputs and outputs, like the recordings it came from, so keep it out of version control.
- **`--json`** prints the fence and every run's result.
- Missing API keys stop it: before anything runs for the judge's model, and at the first changed stage that needs one.

Limits:

- It compares against recorded runs only, so it needs `halo run` (which records by default) to have run the original. Runs recorded before 0.5.0 have no model fingerprints, so every model call goes live; runs recorded before 0.5.1 have no tool fingerprints, so a stale tool result can't be spotted, and it says so. Record them again. `halo serve` doesn't record unless asked, and only the newest 50 recordings are kept.
- Effects are what each tool provider says about itself. An MCP tool's methods show as `Tool.*` with the effect not described, so the fence can only check that b calls no `Tool.*` that a didn't.
- The approvals check counts yields and listens, and checks approval rules per call. It doesn't check that a yield still comes before the same effects.
- A `@thread` pipeline's runs depend on state the replay doesn't restore.
- Lowering a `MaxSpend` changes the policy's declaration, so it counts as outside the fence.

## `halo history`

A pipeline with `@checkpoint` keeps every step it saved, not just the latest. Beside the checkpoint file, `.halo/checkpoints/<Pipeline>-<runId>.steps.jsonl` gets one line per stage: the stage, the value it produced, and only the `context.data` keys that stage changed.

```bash
halo history 6f9696ef-1c2b-4c47-9a1e-3f0c2d1b9a77
```

```
   1  14:50:18.257  stage 0   data  → data
   2  14:50:18.263  stage 1   Resilient.prompt  → Resilient, prompt
   3  14:50:18.265  stage 2   System.Print
```

Each line shows the step number, its time, the stage, the keys it changed, the run's cost so far, and `⏹ halted` where a gate closed. A step's number is the length of the run's trace at that point, so it matches the trace entry, and it keeps counting through loops and when the run is resumed. `--step N` prints the run's state after step N: `context.current` and the whole of `context.data`. `--json` prints the raw steps, or with `--step` the folded state. You can also pass the path to a `.steps.jsonl` file instead of a run ID.

A history is a record of what the run did. Editing the checkpoint file by hand doesn't change earlier steps: the edit shows up as a change at the next step the run saves. Like recordings, histories aren't redacted, so keep `.halo/checkpoints` out of version control.

## `halo rewind`

Go back to a step of a `@checkpoint` run and continue from there:

```bash
halo rewind tidy.halo 6f9696ef-1c2b-4c47-9a1e-3f0c2d1b9a77 --step 2
```

The run continues as a new run, with a new run ID. It starts with the state the old run had after step 2: `context.data`, `context.current`, the trace, the calls and the cost so far. Then it runs every stage after that step against the current file, so you can change a prompt or a model and see what the run does from that point. If step 2 was a gate that closed, the gate is checked again. The old run's checkpoint and history aren't changed. The new run records where it came from in `context.meta.rewoundFrom` (`{ runId, step }`), and its history begins with the steps it shares with the old run.

**Stages after the step run again for real:** models are called, tools run, and people are asked again. If any of those stages calls a tool that writes, calls out, or doesn't say what it does (see [`halo plan`](#halo-plan)), `halo rewind` lists those stages and stops unless you pass `--yes`. If a loop comes after the step, it can jump back before it, so every stage counts. With `--mock`, nothing runs for real and no `--yes` is needed.

Limits:

- Stage numbers come from the old run. If you add or remove stages before the step, the new run continues from the wrong place.
- A rewound run has no recording, because the recording would be missing everything before the step. Policy violations and shadow results from before the step aren't carried over.

## From TypeScript

`RuntimeConfig.recorder` receives each recorded call (`{ kind: "agent" | "tool" | "approval" | "yield" | "listen", target, value, toolCalls? }`) as it happens. The CLI's helpers are in `src/runtime/replay.ts`:

```ts
import { HaloRuntime } from "halo";
import { Recorder, readRecording, replayMocks } from "halo/src/runtime/replay.ts";

const runId = crypto.randomUUID();
const recorder = new Recorder(".halo/recordings", runId);
const runtime = new HaloRuntime({ recorder: recorder.record }).load(ast);
recorder.start("Tidy", args);
const result = await runtime.run("Tidy", args, { runId });
recorder.finish({ status: result.status, output: result.output });

// Later: replay it.
const rec = readRecording(".halo/recordings", runId);
const tools = [...ast.tools, ...ast.stores].map((t) => t.name);
const again = await new HaloRuntime().load(ast).mockAll({ yield: { approved: true }, ...replayMocks(rec, { tools }) }).run(rec.pipeline, rec.args);
```

`replayMocks(rec, { liveModels, liveTools, tools })` returns mocks for `mockAll`, with the same behavior as the CLI flags. Pass `tools` (the declared tool and store names) to refuse calls to tools the recording never called; without it, those would run for real. Recorded yields and listens are answered; for an older recording without them, add `yield: { approved: true }` before the replay mocks, as the CLI does.

A checkpoint's step history is exported from the package too:

```ts
import { readSteps, stateAt, stepsPathFor } from "halo";

const steps = await readSteps(stepsPathFor(result.context.meta.checkpoint!));
const { data, current, step } = stateAt(steps, 2); // the run as it was after step 2

// Continue from step 2 as a new run.
const again = await runtime.rewind(result.context.meta.checkpoint!, 2);
```
