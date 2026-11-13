# Remote Computers

`Remote` gives an agent a computer somewhere else to run commands on and move files to. That can be a machine you already have, reached over SSH, or a fresh sandbox that exists only for one run and is deleted afterwards: in the cloud, or a Docker container on this machine.

```halo
tool Box : Remote("deploy@build.example.com")        // a machine you reach over SSH
tool Lab : Remote("e2b")                              // a fresh cloud sandbox from E2B
tool Lab : Remote("daytona", snapshot: "python")      // ... or from Daytona
tool Lab : Remote("docker", image: "node:22")         // ... or a container on this machine
tool Lab : Remote("auto")                             // Docker if it's running, else E2B, else Daytona
```

Every kind has the same methods, so an agent or pipeline doesn't need to know which one it has:

| Method | Arguments | Returns | Effect |
|---|---|---|---|
| `run` | `command`, `cwd`, `env`, `timeout_ms` (default 120000) | `{ command, stdout, stderr, exitCode, timedOut, json? }` | external |
| `read` | `path` | `{ path, content, bytes, encoding }` (`base64` for binary files) | read |
| `write` | `path`, `content` | `{ path, bytes }` (folders are created) | external |
| `list` | `path` (default: home) | `{ path, entries: [{ name, type }] }` | read |
| `upload` | `from` (local), `to` (remote) | `{ from, to, bytes }` | external |
| `download` | `from` (remote), `to` (local) | `{ from, to, bytes }` | write |
| `info` | | `{ backend, host }` or `{ backend, id }` | read |
| `diff` | `path` (only under it) | `{ files: [{ path, status }], patch }`: what changed since the sandbox started | read |
| `apply` | `to` (local, default: the `from:` folder), `path` | `{ to, written, deleted }`: the changes, written back here | write |
| `keep` | `fork` | `{ fork, snapshot }`: carry on from a fan-out branch's sandbox (Docker) | external |

- Commands run in a shell on the remote computer. Remote paths are relative to the home folder.
- When stdout is JSON, it's also returned parsed, as `json`.
- `upload` and `download` use local paths inside `root:` (default `.`); a path can't leave it.
- In a pipeline, `{{placeholders}}` in `command` are shell-quoted, like in `Bash`: `Box.run(command: "grep {{term}} app.log")` is safe whatever `term` holds. Other arguments, like `path`, are filled in as written.

## Sandbox agents

`sandbox:` in an agent's brackets gives the agent a computer of its own. It's the safe place for a `Coder` to run what it writes: the sandbox runs on someone else's machine, has none of your files or secrets, and is gone when the run ends.

```halo
agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: "e2b"]

pipeline Build(task: String) -> Result:
  task |> Dev.work("Run it, and the tests, before you say it's done.")
```

With `sandbox: "e2b"`, `sandbox: "daytona"` or `sandbox: "docker"`, nothing else needs declaring:

- The agent gets a `Remote` tool named after itself (`DevSandbox`), with a fresh sandbox for each run.
- Every call the agent makes in a run uses the same sandbox, so `Dev.work` can build something and a later `Dev.check` can test it. Agents never share one.
- It may call the tool without `tools:` on each call: `tools: auto`, unless the agent sets `tools:` itself.
- Its system prompt says the sandbox is there and to check its work in it.
- `halo plan` lists `DevSandbox.run` and the other methods like any tool's.

To hand the agent files, or take its work back, name a `Remote` tool you've declared. The agent then uses that tool, and the pipeline's calls to it in the same run reach the same sandbox:

```halo
tool Lab : Remote("e2b", template: "my-python")
agent Fixer [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: Lab]

pipeline Fix(script: String, error: String) -> Result:
  script
    |> Lab.write(path: "main.py", content: script) as given
    |> Fixer.work("main.py fails with this error. Fix it.", error) as report
    |> Lab.read(path: "main.py")
```

Naming a tool is also how to set a sandbox's options, such as `template:` or `snapshot:`. `sandbox:` can name an SSH `Remote` too, if the agent should work on a real machine.

## How sandboxes last

A run gets its sandbox on its first call to the tool. The same sandbox is used for the rest of that run, and Halo deletes it when the run ends. Two runs never share a sandbox. A run that pauses (waiting for an approval, say) keeps its sandbox until it ends.

| Backend | Key | Declaration options |
|---|---|---|
| `"e2b"` | `E2B_API_KEY` | `template:` (default `"base"`), `ttl_minutes:` (30), `user:` (`"user"`), `apiUrl:` |
| `"daytona"` | `DAYTONA_API_KEY` | `snapshot:`, `idle_minutes:` (15), `target:` (or `DAYTONA_TARGET`), `organization:` (or `DAYTONA_ORGANIZATION_ID`), `apiUrl:` (or `DAYTONA_API_URL`) |
| `"docker"` | none (Docker running here) | `image:` (`"python:3.12-slim"`), `ttl_minutes:` (30), `network:` (`true`), `memory:` (`"2g"`), `cpus:` (2), `pids:` (512), `start_timeout_ms:` (300000), `docker:` (the docker program, e.g. `"podman"`) |

| `"auto"` | whichever it picks | Docker when it's running (and has a VM runtime, with `isolation: "vm"`), else E2B with `E2B_API_KEY`, else Daytona with `DAYTONA_API_KEY`. The options of whichever it picks apply. One run never switches |

`apiKey:` on the declaration overrides the environment variable. If Halo exits before it can delete a sandbox, the service deletes it: E2B after `ttl_minutes`, Daytona once it has been idle for `idle_minutes`. Daytona returns stdout and stderr together, in `stdout`.

## Docker sandboxes

`Remote("docker")` needs no account: it starts a container from `image:` with the `docker` on this machine, so it works offline, costs nothing, and can use any image you can pull or have built, such as one with your project's toolchain already in it.

```halo
tool Lab : Remote("docker", image: "node:22", network: false, memory: "1g")
agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: "docker"]
```

- The container gets none of your files, environment or Docker socket: nothing is mounted. Move files in and out with `write`, `upload` and `download`.
- It runs with `--memory`, `--cpus` and `--pids-limit` set, and `no-new-privileges`. `network: false` cuts it off from the network (so `pip install` won't work either).
- Commands run with `bash` when the image has it, else `sh`, in `/home/user`.
- The container is started with `--rm` and only lives `ttl_minutes`, so if Halo dies before deleting it, it removes itself. Containers Halo made carry the label `created-by=halo` (`docker ps --filter label=created-by=halo`).
- The first run pulls the image if it isn't here yet; `start_timeout_ms:` is how long that may take.

A container shares this machine's kernel, so it keeps an agent away from your files but isn't as strong a wall as a cloud sandbox. For code you trust less, use `isolation: "vm"` (below), or E2B or Daytona.

## A project in, its changes out

`from:` copies a local folder (inside `root:`) into the sandbox when it starts: git's files when it's a repository (tracked, plus untracked ones that aren't ignored), else everything outside `node_modules`, `.git`, `.venv` and the like. The agent works on the copy. `diff` then says what it changed, and `apply` writes those changes back, after you've looked:

```halo
tool Repo : Remote("docker", from: ".", image: "node:22")
tool Git : Git(".", write: true)
agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: Repo]

pipeline Fix(issue: String) -> Result:
  issue
    |> Dev.work("Fix this. Run the tests until they pass.") as report
    |> Repo.diff() as changes
    |! yield(msg: "Apply this change?", [context.data.changes.patch]) as review
    |? (context.data.review.approved == true)
    |> Repo.apply() as applied
    |> Git.commit(message: "{{issue}}")
```

- `diff` compares the sandbox's files with the ones it was given (with no `from:`, with nothing, so it lists everything the agent made). It skips the same folders, and dot-folders at the top (`.cache`, `.local`…) the project didn't have. `patch` is a unified diff; binary files are named, not shown.
- `apply` writes added and changed files, and deletes deleted ones, under `to:` (default: the `from:` folder). Like `download`, it can't leave `root:`. It is a `write`, so `ApproveEffects(write)` or a `|! yield` before it puts a person in charge of what lands.
- `from:` works with every sandbox kind; it is copied in as one archive, at most 20,000 files and 50 MB.

## Forks

In a Docker sandbox, each branch of a fan-out (`|* { ... }` or `|* each`) gets its own copy of the sandbox as it was when the fan-out started. Three attempts at a fix don't trip over each other, and each starts from the same files. After the fan-out, `keep(fork: n)` carries on with branch `n`'s sandbox:

```halo
tool Lab : Remote("docker", from: ".")
agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: Lab]
agent Picker [anthropic/claude-sonnet-4-5]
  system "Reply with JSON: {\"index\": <the number of the attempt you pick, from 0>}"

pipeline BestOfThree(task: String) -> Result:
  task
    |* each(style in ["minimal", "thorough", "fast"]) => Dev.work("Do it, {{style}}. Run the tests.") as attempts
    |> Picker.choose("Which attempt passed its tests with the smallest change?", context.data.attempts) as best
    |> Lab.keep(fork: context.data.best.index)
    |> Lab.diff()
```

A branch that never used the sandbox has nothing to keep. The branches' containers stop when the fan-out ends; what they did is kept as snapshots (images) until the run ends. E2B and Daytona sandboxes don't fork: a fan-out's branches share the run's one sandbox.

## Rewind and pauses

A Docker sandbox's files follow the run:

- In a `@checkpoint` pipeline, the sandbox is saved (`docker commit`) at each step where it changed. `halo rewind` to step N starts the new run's sandbox from the files it had after step N, not from scratch. These snapshots outlive the run, for rewinding later.
- When a run pauses (at `|! yield`, say), its Docker sandboxes are saved and stopped, so a pause that lasts days holds no containers. `halo resume` starts them again from the snapshot, on the same Docker. E2B and Daytona sandboxes stay up while a run pauses, as before.

Snapshots are images named `halo-sandbox:...`, labelled `created-by=halo`. `halo sandboxes` lists them (and running sandboxes); `halo sandboxes prune` removes them.

## Allowed hosts

`hosts:` lets a Docker sandbox reach only those hosts. `"*.pythonhosted.org"` means that domain and its subdomains:

```halo
tool Lab : Remote("docker", hosts: ["pypi.org", "*.pythonhosted.org", "registry.npmjs.org"])
```

The sandbox sits on an internal Docker network with no route out. Its only way out is a proxy (a small container from `oven/bun:1-alpine`) that lets through connections to those hosts, and `HTTP_PROXY` and `HTTPS_PROXY` point at it, so `pip`, `npm`, `curl` and `git` over HTTPS work as usual. A connection to any other host is refused: the run's result for that command says so (`blocked: ["evil.example"]`), and it is recorded in `context.meta.violations` (rule `AllowHosts`, phase `tool`). A program that ignores the proxy settings can't get out at all; it doesn't get a name lookup either.

For a sandbox agent, an `AllowHosts` policy does the same, so the rule sits with the agent's other policies:

```halo
policy Deps : AllowHosts("pypi.org", "*.pythonhosted.org")

agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: "docker"]
  requires Deps
```

Several `AllowHosts` policies narrow: a host must be in each. `AllowHosts` needs a sandbox the agent owns (`sandbox: "docker"` or `"auto"`); for a `Remote` tool shared with the pipeline, put `hosts:` on its declaration. E2B and Daytona can't enforce it, so `hosts:` with them is an error rather than a promise Halo can't keep; `network: false` is the way to cut a Docker sandbox off entirely.

## Isolation

A Docker container shares this machine's kernel. `isolation: "vm"` asks for more: a container runtime registered with Docker that gives each container its own kernel, such as gVisor (`runsc`) or Kata Containers. Halo picks one Docker reports (`docker info`), and refuses to start, saying what's missing, if there's none. `runtime:` names one yourself.

```halo
tool Lab : Remote("docker", isolation: "vm")
tool Lab : Remote("auto", isolation: "vm")       // a Docker VM runtime if there is one, else E2B or Daytona
```

E2B and Daytona run each sandbox in its own VM already.

## A machine over SSH

```halo
tool Box : Remote("deploy@build.example.com")
tool Box : Remote("ssh://deploy@10.0.0.5:2222", key: "~/.ssh/ci_ed25519")
tool Box : Remote("staging")                       // a Host alias from ~/.ssh/config
```

Halo runs the `ssh` on this machine, so your keys, agent and `~/.ssh/config` all apply. It never prompts for anything (`BatchMode`), and host keys are checked against `known_hosts` as usual. For a new host that isn't in `known_hosts` yet, `accept_new_hosts: true` trusts its key the first time; a key that later changes is still refused. Each call is its own connection. Other options: `key:`, `connect_timeout:` (seconds, default 15), `cwd:` (the default folder for `run`), `ssh:` (the ssh program).

The host must look like a host. Anything starting with `-`, or containing spaces or shell characters, is refused, so a value can't turn into an ssh option. To reach a host literally named `e2b` or `daytona`, write `ssh://e2b`.

## Keeping it in bounds

`run` and `write` are `external`: they change a computer that isn't this one. So a policy can keep an agent to looking only:

```halo
policy LookOnly : AllowEffects(read)

agent Inspector [anthropic/claude-haiku-4-5, tools: auto]
  equips Box
  requires LookOnly           // read, list and info only
```

On a server you care about, use an SSH key that can do only what the agent should, such as a separate user, or a `command=` restriction in `authorized_keys`. Give the agent a sandbox instead when it doesn't need your machine.
