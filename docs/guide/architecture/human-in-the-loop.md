# Human-in-the-Loop

Two operators wait for something outside the pipeline:

- `|! yield(...)` asks a human. The response goes to `context.data.yield` and the `as` binding.
- `~> listen(Source.Event)` waits for an event. The payload goes to `context.data.Source.Event` and the `as` binding.

The flowing value continues unchanged after both.

```halo
tool   DeployHook : POST("deploy.example.com/hooks/deploy", apiKey: Env.DEPLOY_TOKEN, sendInput: false)
agent  DevOps [anthropic/claude-sonnet-4-5]

pipeline Deploy(commit: String) -> Result:
  commit
    |> DevOps.assess("""Reply with JSON: {"risk": "low" | "high", "reason": "..."}""") as assessment
    |! yield("Deploy {{commit}}? Risk: {{assessment.risk}}", channel: "#deploys", [context.data.assessment]) as decision
    |? (context.data.decision.approved == true)
    |> DeployHook.trigger(commit: commit)
```

Only a top-level pipeline can pause. If a pipeline you call reaches `yield` or `listen` with no handler, the run fails. A gate that halts inside a called pipeline stops only that pipeline, and the caller continues with its output.

## Three ways to answer

**1. A handler.** Register `onInterrupt` / `onListen` (or pass them in `RuntimeConfig`). Whatever the handler returns is the response.

```ts
runtime.onInterrupt(async (req) => {
  // req.message, req.channel, req.attachments, req.timeoutMs, req.context
  return { approved: await askSomeone(req.message) };
});
```

**2. Pause and signal.** With no handler, a top-level run stops with `status: "paused"`. `context.meta.paused` is `{ stage, waitingFor, message }`, where `waitingFor` is `"yield"`, the listen target, or `"approval"` (an agent's [tool call](../agents-with-tools.md#approvals)). The run is saved in the `runStore`. Later, from any process that shares the store:

```ts
import { FileRunStore, HaloRuntime, parse } from "halo";

const runtime = new HaloRuntime({ runStore: new FileRunStore(".halo/runs") }).load(parse(source));

const first = await runtime.run("Deploy", { commit: "abc123" });
if (first.status === "paused") await saveForLater(first.runId);

// ...when the human answers (e.g. in a webhook handler):
const done = await runtime.signal(runId, "yield", { approved: true });
// For ~> listen(Slack.Reaction): runtime.signal(runId, "Slack.Reaction", payload)
```

`signal()` throws a `SignalError` with code `RUN_NOT_FOUND` if no paused run has that id (each run can be resumed only once). It throws with code `SIGNAL_MISMATCH` if the run is waiting for a different event. The default `MemoryRunStore` keeps paused runs only for the life of the process. Use `FileRunStore`, or implement `RunStore` (`save`/`load`/`delete`), to survive restarts.

**3. The CLI.** `halo run` prompts in the terminal. Type `approve`, `reject`, any word, or JSON. A word becomes `{ action, status, reaction, text, approved }`, and `approved` is true for approve/yes/ok/lgtm/merged. With `--auto-approve` (and in `halo test`), every yield and listen gets `{ action: "approve", approved: true, status: "approved", reaction: "approve" }`. When stdin isn't a terminal, the run pauses, is saved to `.halo/runs/`, and prints the command that continues it:

```bash
halo resume deploy.halo 3f2c…-run-id --payload approve
halo resume deploy.halo 3f2c…-run-id --payload '{"approved": false, "note": "wait for Monday"}'
```

`--event` names the event explicitly. By default the CLI uses whatever the run is waiting for.

## Timeouts

`yield(..., 30m)` or `timeout: "30m"` limits how long a **handler** may take. If it takes longer, the run fails with a `TimeoutError`. A paused run has no deadline.

## Slack-style approvals

Under `halo serve` with `slack.signingSecret`, pause announcements get Approve / Reject buttons, and a `Slack` tool's `buttons:` answer the next pause of the run that posted them (see [Slack buttons](../production/serving.md#slack-buttons)).

In your own server, `Slack.post(..., buttons: [...])` posts buttons whose value is `{"runId": "...", "after": <pauses so far>, "answer": "<label>"}` (JSON, during a run; `context.meta.pauses` counts a run's pauses). Have your Slack app's interaction endpoint verify Slack's signature, read that value, and call `runtime.signal(runId, ...)` with the event the run is waiting for.

## Approving a diff

The most useful thing to approve is often a change a coding agent made in a sandbox. `Remote.diff()` returns the changed files and a unified diff; attach it to the `yield`, and write the change back only on a yes:

```halo
policy StayInside : DenyTools("Repo.apply", "Repo.download")
tool Repo : Remote("auto", from: ".")
agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: Repo]
  requires StayInside

pipeline Fix(task: String) -> Result:
  task
    |> Dev.work("{{task}}. Run the tests.") as report
    |> Repo.diff() as changes
    |! yield(msg: "Apply this change?", [context.data.report, context.data.changes.patch]) as review
    |? (context.data.review.approved == true)
    |> Repo.apply()
```

While the run waits, a Docker sandbox is saved and stopped, and started from the same files when the answer comes, so an approval that takes a day holds no containers. See [Coding Agents That Run Their Code](../coding-agents.md#getting-the-work-back).

## Approving tool calls

An agent that chooses its own tool calls can be made to ask first, with `ApproveTools(...)` or `ApproveEffects(...)`. Those requests come to the same `onInterrupt` handler (with `channel: "approval"`), or pause the run waiting for `"approval"`. See [Agents with Tools](../agents-with-tools.md#approvals).
