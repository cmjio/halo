# Coding Agents That Run Their Code

An agent without a computer can write code, but it can only guess whether the code works. Give it a sandbox and it works the way a developer does: write, run, read the error, fix, run again. The sandbox is a throwaway Linux machine with none of your files, secrets or network unless you hand them over, and it is gone when the run ends.

This guide builds one pipeline, step by step: an agent fixes something in your project, in a sandbox, and nothing reaches your folder until you've read the diff and said yes. The finished file is [`examples/patterns/patch-review.halo`](https://github.com/cmjio/halo/blob/main/examples/patterns/patch-review.halo).

## The shortest version

```halo
agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: "auto"]

pipeline Build(task: String) -> Result:
  task |> Dev.work("Run it, and the tests, before you say it's done.")
```

`sandbox: "auto"` gives `Dev` a computer of its own for each run: a Docker container if Docker is running here, otherwise an E2B or Daytona cloud sandbox if you've set `E2B_API_KEY` or `DAYTONA_API_KEY`. Nothing else needs declaring:

- The agent gets a `Remote` tool named `DevSandbox` with `run`, `read`, `write`, `list` and the rest, and may call it without `tools:` on each call.
- Its system prompt says the sandbox is there and to check its work in it.
- Every call `Dev` makes in a run uses the same sandbox. Two runs never share one.

The `Coder` preset is made for this: it reads before it writes, makes small changes, and runs the tests after each one. See [Agent Presets](../stdlib/agent-presets.md).

## Which sandbox

| | Docker | E2B | Daytona |
|---|---|---|---|
| Needs | Docker running here | `E2B_API_KEY` | `DAYTONA_API_KEY` |
| Costs | nothing | by usage | by usage |
| Isolation | a container (shares this machine's kernel); `isolation: "vm"` with gVisor or Kata | its own VM | its own VM |
| Your own image | any image you can pull or build (`image:`) | a template | a snapshot |
| Allowed hosts (`hosts:`) | yes | no | no |
| Forks, rewind, pauses without a running sandbox | yes | no | no |
| Works on Fly, Render, Cloud Run | no: there's no Docker there | yes | yes |

`"auto"` is a good default for something you'll run on a laptop, in CI and on a server: Docker where there is one, the cloud where there isn't. Name one (`"docker"`, `"e2b"`, `"daytona"`) when it matters. Each kind is described in [Remote Computers](../stdlib/remote.md).

## Giving it your project

A sandbox starts empty. `from:` copies a local folder into it when it starts: git's files when the folder is a repository (tracked, and untracked ones that aren't ignored), else everything outside `node_modules`, `.git`, `.venv` and the like. To set `from:`, declare the sandbox as a tool and name it in `sandbox:`:

```halo
tool Repo : Remote("auto", from: ".")
agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: Repo]
```

Declaring it yourself also means the pipeline can use the same sandbox the agent worked in, which the rest of this guide needs. The agent works on the copy; your folder isn't touched.

## Letting it install packages, and nothing else

A coding agent usually needs a package registry, and nothing more. `hosts:` lets the sandbox reach only those hosts:

```halo
tool Repo : Remote("auto", from: ".", hosts: ["pypi.org", "*.pythonhosted.org", "registry.npmjs.org"])
```

The sandbox gets no route out except through a proxy that allows those hosts, so `pip install` and `npm install` work, and the agent can't send your code anywhere else. A refused connection shows up in the command's result (`blocked: ["evil.example"]`) and in `context.meta.violations`. A program that ignores proxy settings can't get out at all.

Allowed hosts are enforced by Docker sandboxes. If `"auto"` lands on E2B or Daytona, the run fails rather than quietly running without the allowlist. For an agent with `sandbox: "docker"` (one it owns), an `AllowHosts` policy does the same job and sits with its other policies; see [Allowed hosts](../stdlib/remote.md#allowed-hosts).

## Keeping your folder out of the agent's reach

`Remote` tools have two methods that write to *your* folder: `download` and `apply`. Those should be the pipeline's decisions, after you've looked, so take them away from the agent:

```halo
policy StayInside : DenyTools("Repo.apply", "Repo.download", "Repo.keep")

agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: Repo]
  requires StayInside
```

A denied method isn't offered to the model at all. `halo plan` shows what the agent may call, so you can check:

```
  1      Dev.work [anthropic/claude-sonnet-4-5]
         may call Repo.run: external
         may call Repo.read: read
         may call Repo.write: external
         may call Repo.list: read
         may call Repo.upload: external
         may call Repo.info: read
         may call Repo.diff: read
         chooses its own calls, up to 40 steps
```

## Getting the work back

When the agent says it's done, don't take its word for what it changed. `diff` compares the sandbox's files with the ones it was given, and returns the changed files and a unified diff:

```halo
    |> Repo.diff() as changes
```

```json
{
  "files": [{ "path": "src/page.ts", "status": "modified" }],
  "patch": "--- a/src/page.ts\n+++ b/src/page.ts\n@@ -1 +1 @@\n-  return items.slice(start, end - 1)\n+  return items.slice(start, end)\n"
}
```

Show it to a person, and only on a yes, `apply` writes the changes back to the folder they came from (added and changed files written, deleted ones deleted), and `Git` commits them:

```halo
policy Budget : MaxSpend(1.00)
policy StayInside : DenyTools("Repo.apply", "Repo.download", "Repo.keep")

tool Repo : Remote("auto", from: ".", hosts: ["pypi.org", "*.pythonhosted.org", "registry.npmjs.org"])
tool Git  : Git(".", write: true)

agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: Repo]
  requires Budget, StayInside

pipeline Fix(task: String) -> Result:
  task
    |> Dev.work("{{task}}. Run the project's tests until they pass, and say which command you ran.") as report
    |> Repo.diff() as changes
    |? (context.data.changes.files.length > 0)
    |! yield(msg: "Apply this change to your folder and commit it?", [context.data.report, context.data.changes.patch]) as review
    |? (context.data.review.approved == true)
    |> Repo.apply() as applied
    |> Git.commit(message: "{{task}}", all: true)
```

Under `halo run` in a terminal, the `yield` prints the agent's report and the patch and asks you. Under `halo serve`, the run pauses and the approval link or Slack buttons answer it (see [Human-in-the-Loop](./architecture/human-in-the-loop.md)). A Docker sandbox doesn't sit there running while it waits: it's saved and stopped, and started again from the same files when someone answers.

`apply` can't write outside the tool's `root:` (default `.`), and `to:` sends the changes somewhere else, such as a scratch folder to look at first.

## Checking the tests yourself

The agent says the tests pass. The pipeline can check, in the same sandbox, and send it back if they don't:

```halo
pipeline FixChecked(task: String) -> Result:
  task
    |> Dev.work("{{task}}. Run the tests until they pass.") as report
    |> Repo.run(command: "npm test 2>&1 | tail -40") as tests
    |<> loop(Dev, "context.data.tests.exitCode != 0", max: 2)
    |> Repo.diff()
```

The tests decide, not the model's report. When they fail, `loop` goes back to `Dev.work` with the failing output, up to twice more. If they still fail, the run fails (`loop(Dev) gave up after 2 tries`), so a red build never reaches the diff.

## Trying it offline

`halo test` runs a pipeline with every model and tool call mocked: no Docker, no keys, no cost. Canned answers in a JSON file walk it down the path you want to check:

```json
{
  "Dev.work": "Fixed the off-by-one in paginate(); ran `npm test`: 42 passed.",
  "Repo.diff": { "files": [{ "path": "src/page.ts", "status": "modified" }], "patch": "..." },
  "yield": { "approved": true },
  "Repo.apply": { "to": ".", "written": ["src/page.ts"], "deleted": [] },
  "Git.commit": { "committed": true, "hash": "abc1234", "files": ["src/page.ts"] }
}
```

```bash
halo test examples/patterns/patch-review.halo --arg task="Fix the off-by-one" --mocks mocks.json
```

Change `"yield"` to `{ "approved": false }` to check that a no stops the run before anything is written. See [Testing and Mocks](../dx/testing-and-mocks.md).

## When something goes wrong

- **The first run is slow.** Docker pulls the image the first time (a few minutes for `python:3.12-slim`), and the proxy's image if you use `hosts:`. Later runs start in a second or two.
- **Go back and try a different prompt.** With `@checkpoint` on the pipeline, `halo rewind` to a step restores the sandbox's files as they were after that step, so the new attempt starts from the same place. See [`halo rewind`](./plan-and-replay.md#halo-rewind).
- **Replay without running anything.** `halo replay` feeds a recorded run's command results back, so you can rerun it with a changed prompt without starting a sandbox.
- **Leftovers.** Sandboxes delete themselves when a run ends, or after `ttl_minutes` if Halo dies first. `@checkpoint` snapshots stay, for rewinding. `halo sandboxes` lists what's there and `halo sandboxes prune` removes it.
- **Code you trust less.** A Docker container shares this machine's kernel. Use `isolation: "vm"` (with gVisor or Kata installed) or a cloud sandbox for code from strangers.

## Next

- [Best of N](./best-of-n.md): several attempts in forked sandboxes, and keep the best.
- [Remote Computers](../stdlib/remote.md): every option, and SSH machines.
- [Agents with Tools](./agents-with-tools.md): how an agent chooses its calls, approvals, and tool policies.
