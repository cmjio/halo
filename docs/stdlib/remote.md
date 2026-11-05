# Remote Computers

`Remote` gives an agent a computer somewhere else to run commands on and move files to. That can be a machine you already have, reached over SSH, or a fresh cloud sandbox that exists only for one run and is deleted afterwards.

```halo
tool Box : Remote("deploy@build.example.com")        // a machine you reach over SSH
tool Lab : Remote("e2b")                              // a fresh cloud sandbox from E2B
tool Lab : Remote("daytona", snapshot: "python")      // ... or from Daytona
```

Both kinds have the same methods, so an agent or pipeline doesn't need to know which one it has:

| Method | Arguments | Returns | Effect |
|---|---|---|---|
| `run` | `command`, `cwd`, `env`, `timeout_ms` (default 120000) | `{ command, stdout, stderr, exitCode, timedOut, json? }` | external |
| `read` | `path` | `{ path, content, bytes, encoding }` (`base64` for binary files) | read |
| `write` | `path`, `content` | `{ path, bytes }` (folders are created) | external |
| `list` | `path` (default: home) | `{ path, entries: [{ name, type }] }` | read |
| `upload` | `from` (local), `to` (remote) | `{ from, to, bytes }` | external |
| `download` | `from` (remote), `to` (local) | `{ from, to, bytes }` | write |
| `info` | | `{ backend, host }` or `{ backend, id }` | read |

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

With `sandbox: "e2b"` or `sandbox: "daytona"`, nothing else needs declaring:

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

`apiKey:` on the declaration overrides the environment variable. If Halo exits before it can delete a sandbox, the service deletes it: E2B after `ttl_minutes`, Daytona once it has been idle for `idle_minutes`. Daytona returns stdout and stderr together, in `stdout`.

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
