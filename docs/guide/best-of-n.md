# Best of N

For a hard change, one attempt by a coding agent is a coin toss. Several attempts, each run and tested, and then a choice between them, is much less of one. The catch is that attempts in one shared sandbox trample each other's files. A Docker sandbox solves that by **forking**: each branch of a fan-out gets its own copy of the sandbox, all starting from the same files, and afterwards the run carries on with the one you keep.

The finished file is [`examples/patterns/best-of-n.halo`](https://github.com/cmjio/halo/blob/main/examples/patterns/best-of-n.halo).

```halo
policy Budget : MaxSpend(3.00)
policy StayInside : DenyTools("Lab.apply", "Lab.download", "Lab.keep")

tool Lab : Remote("docker", from: ".", hosts: ["pypi.org", "*.pythonhosted.org", "registry.npmjs.org"])

agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: Lab]
  requires Budget, StayInside

agent Picker [anthropic/claude-sonnet-4-5, temp: 0.0]
  system """
    You compare attempts at the same coding task. Prefer an attempt whose tests passed, then the
    smallest change, then the clearest code. Attempts are numbered from 0.
    Reply with JSON: {"index": 0, "why": "..."}
  """
  requires Budget

pipeline BestOfThree(task: String) -> Result:
  task
    |* each(style in ["the smallest change that works", "a thorough fix with a new test", "a fix that also tidies the code around it"], concurrency: 3) => Dev.work("{{task}}. Take this approach: {{style}}. Run the tests.") as attempts
    |> Picker.choose("Task: {{task}}. Which attempt should we keep?", context.data.attempts) as best
    |> Lab.keep(fork: context.data.best.index) as kept
    |> Lab.diff()
```

## What happens

1. **The fan-out forks.** `|* each` runs `Dev.work` three times at once. The first time a branch uses `Lab`, Halo saves the sandbox as it was when the fan-out started (`docker commit`) and starts the branch's own container from it. Here the run hadn't used `Lab` yet, so each branch starts from a fresh copy of the project (`from: "."`). Had an earlier stage installed dependencies, every branch would start with them installed.
2. **Each attempt works alone.** The three agents edit, install and run tests in three containers. One branch's `rm -rf build` can't touch another's.
3. **The branches end.** When the fan-out finishes, each branch's sandbox is saved, and its container stops. `context.data.attempts` holds the three agents' answers.
4. **You choose.** `Lab.keep(fork: n)` makes branch `n`'s sandbox the run's. The next call to `Lab` starts a container from it, so `Lab.diff()` shows what that attempt changed, compared with the project as it was copied in.

`|* { A(), B() }` forks the same way, one branch per call. A fan-out inside a branch forks from that branch. A branch that never used the sandbox has nothing to keep, and `keep` says so.

## Choosing well

The picker is only as good as what it's shown. Give it evidence, not just each attempt's description of itself:

- Ask each attempt to end with the test command it ran and the result (the `Coder` preset does this).
- Better still, check for yourself: run the tests in each branch as part of the branch, so the result comes from the sandbox rather than from the agent. A pipeline called once per attempt can do both:

```halo
pipeline Attempt(task: String, style: String) -> Result:
  task
    |> Dev.work("{{task}}. Take this approach: {{style}}. Run the tests.") as report
    |> Lab.run(command: "npm test 2>&1 | tail -20") as tests
    |> System.Value([context.data.report, context.data.tests])

pipeline BestOfThreeChecked(task: String) -> Result:
  task
    |* each(style in ["minimal", "thorough", "tidy"], concurrency: 3) => Attempt(task: task, style: style) as attempts
    |> Picker.choose("Task: {{task}}. Which attempt should we keep?", context.data.attempts) as best
    |> Lab.keep(fork: context.data.best.index)
    |> Lab.diff()
```

Each attempt is now the agent's report paired with the tests' real result (`exitCode`, `stdout`), so the picker compares what the sandbox says, not just what the agents claim. A called pipeline runs inside the branch that called it, so `Dev` and the `Lab.run` after it use the same fork.

- Make the decision a person's when it matters: put `Lab.diff()` in a `|! yield` before anything is applied (see [Coding Agents](./coding-agents.md#getting-the-work-back)).

## What it costs

- **Models:** N attempts cost about N times one attempt. `MaxSpend` caps the whole run, across all branches.
- **Time:** the attempts run at once (`concurrency:`), so the run takes about as long as the slowest one.
- **Disk:** each branch's snapshot is an image layer holding what that branch changed, on top of the image. Fork snapshots are removed when the run ends; `halo sandboxes` shows any left by a run that crashed, and `halo sandboxes prune` removes them.

## Limits

- Forks need Docker. E2B and Daytona sandboxes don't fork: every branch of a fan-out uses the run's one sandbox, so attempts would share files. Use `Remote("docker")` (not `"auto"`) for best-of-N.
- `keep` follows the most recent fan-out at the same level. Call it before the next fan-out.

## Trying it offline

```json
{
  "Dev.work": "Done; tests pass.",
  "Picker.choose": { "index": 1, "why": "Passed, and added a regression test." },
  "Lab.keep": { "fork": 1, "snapshot": "halo-sandbox:mock" },
  "Lab.diff": { "files": [{ "path": "csv.py", "status": "modified" }], "patch": "..." }
}
```

```bash
halo test examples/patterns/best-of-n.halo --arg task="Handle quoted commas" --mocks mocks.json
```

## Next

- [Coding Agents That Run Their Code](./coding-agents.md): the sandbox, a project in, a diff out.
- [Forks](../stdlib/remote.md#forks) in the Remote reference.
