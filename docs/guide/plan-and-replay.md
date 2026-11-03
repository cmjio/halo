# Plan and Replay

Two commands help you trust a pipeline: `halo plan` shows what a run could do before it runs, and `halo replay` runs a recorded run again with the answers it got, without calling any model.

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

- each model answer, including the tool calls an agent asked for
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

Use it to check that a change to the pipeline doesn't change the result, to look at a failure again without paying for the models, or (with `--live-models`) to try new prompts against the same tool results.

| Flag | Replays | Calls for real |
|---|---|---|
| (none) | Model answers and tool results | Nothing |
| `--live-models` | Tool results | The models: new prompts against the same tool results |
| `--live-tools` | Model answers | The tools: **writes, posts and shell commands run again** |

When the pipeline asks for something the recording doesn't have (a new agent stage, a tool the recorded run never called, one more call than was recorded, or a different model answer leading to a different tool call), the run fails with `REPLAY_MISMATCH`: "the pipeline or its input changed". A tool call an agent chose is the exception: the mismatch goes back to the model as a tool error, like any other failed tool call.

Limits:

- A call to any tool declared in the file that the recording has no result for fails with `REPLAY_MISMATCH`, unless you pass `--live-tools`. Nothing runs for real by accident.
- Recordings made before `|! yield` answers were recorded have none: a replay of one approves every yield, as `halo test` does.
- `@shadow` calls aren't recorded.
- Replay follows the recorded order per target. If parallel stages (`|*`, `each`) call the same target, they can get each other's answers.

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
```
