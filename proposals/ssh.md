# Halo SSH: reaching real machines, safely

| | |
|---|---|
| Status | Draft proposal. 1.12.0 shipped the groundwork (see [What exists](#what-exists)); nothing here is built. |
| Date | 27 November 2026 |
| Builds on | `Remote` over SSH, `hostKey:`/`knownHosts:`, the pinned ssh options, policies (`AllowTools`, `AllowEffects`), the trace |

## Summary

`Remote("deploy@host")` gives an agent a real machine. That is the most dangerous tool Halo has: the machine is yours, it holds data, and what runs there can't be rolled back like a sandbox. Today the limits are coarse. A policy can hide `run` entirely, or allow it entirely. Every call opens a new connection. Nothing in the trace says what ran on which host as whom.

This proposal adds what an operator needs before pointing an agent at a server they care about:

- `jump:` for bastion hosts, declared in Halo instead of a ProxyCommand.
- Agent forwarding, off unless a declaration asks for it, and then only for one host.
- One connection per run, shared by its calls, through a socket only that run can use.
- `AllowCommands(Box, "systemctl status *")`: which commands an agent may run, by argv prefix.
- An audit event per remote call, in the trace.
- A check of the remote login shell, since Halo's quoting is for POSIX shells.
- `profile: "read-only"`: a machine an agent can look at but not change.

It also looks at a pure-TypeScript SSH client against shelling out to `ssh`, and recommends staying with `ssh` for now.

## What exists

As of 1.12.0:

- Halo runs the system `ssh` with `BatchMode=yes` and pins the options that would give the host more than a shell: `ForwardAgent=no`, `ClearAllForwardings=yes`, `StrictHostKeyChecking=yes` (or `accept-new`), `ControlMaster=no`, `PermitLocalCommand=no` and others. ssh keeps the first value it sees for an option, and `-o` comes before `~/.ssh/config`, so a `Host *` block can't undo them.
- ssh gets a small environment (`PATH`, `HOME`, `USER`, `SSH_AUTH_SOCK`...), so `SendEnv *` can't ship Halo's API keys.
- `hostKey:` pins a key or fingerprint; `knownHosts:` names the only file to check.
- An exit of 255 is told apart from a connection failure by a marker the remote shell prints first. A command that may have run is never retried.
- `upload` refuses credential files unless `allowFiles:` names them.

Host aliases in `~/.ssh/config` still work, including their `ProxyJump`. So does everything below that a person sets up by hand. What's missing is a way to say it in the declaration, where `halo plan`, a reviewer and the validator can see it.

## Goals

- Every way a call can reach further than one host, as one user, is written in the declaration and shown by `halo plan`.
- A policy can limit what runs on a host as precisely as it limits which methods are offered.
- A reviewer can tell from the trace what ran where, as whom, and what came back.
- Nothing here weakens the 1.12.0 defaults. Each new reach is opt-in, per tool.

## Non-goals (for now)

- Password or keyboard-interactive login. Halo never prompts.
- Managing `authorized_keys` or certificates on hosts. That is the operator's job; this proposal says what to put there.
- Windows hosts (no POSIX shell). `shell: "pwsh"` may follow the shell check below.

## Jump hosts: `jump:`

```halo
tool Db : Remote("app@10.0.4.12", jump: "ops@bastion.example.com", hostKey: "SHA256:…", jumpHostKey: "SHA256:…")
tool Db : Remote("app@10.0.4.12", jump: ["ops@bastion.example.com", "ops@inner-bastion"])
```

**Semantics.** Each entry is parsed like the host (`parseSshTarget`), so it can't carry options or shell characters. Halo passes them as `-J user@host:port,...`. ssh turns `-J` into a ProxyCommand that runs another ssh. That inner ssh reads `~/.ssh/config` but not Halo's `-o` options. So Halo can't use `-J` as is: it builds the ProxyCommand itself, with the same pinned options, as `ProxyCommand=ssh <pinned> -W %h:%p -- <jump>`. Each hop is quoted by Halo, so a host value can't reach the shell ssh runs it with.

**Host keys.** `jumpHostKey:` pins the bastion's key, one per hop. Without it, the bastion's key must be in `known_hosts` (strict), like any host.

**Security notes.**

- A bastion sees only the encrypted stream (`-W`), not the commands. That is why `jump:` is safe where agent forwarding to the bastion is not.
- The inner ssh gets the same small environment and pinned options. The test is the same as today's: `ssh -G` on the generated ProxyCommand.
- A ProxyJump in `~/.ssh/config` still works for a host alias. `jump:` is for when the declaration should say it.

## Agent forwarding, opt-in

```halo
tool Build : Remote("ci@build.example.com", forwardAgent: true, agentKeys: ["~/.ssh/github_deploy"])
```

Some remote commands need a key: `git clone git@github.com:…` on the host. Forwarding your agent lets the host use **every** key in it, for as long as the connection is open, to log in anywhere as you. So:

- `forwardAgent: true` alone is an error. It needs `agentKeys:`: Halo starts a fresh `ssh-agent` for the run, adds only those keys (with `ssh-add -c` when `confirm: true`, which needs a person), and forwards that agent. Your own agent is never forwarded.
- The run's agent is killed when the run ends, or when the connection closes.
- `halo validate` warns about every `forwardAgent: true`, naming the keys.
- `halo plan` says "forwards an agent holding 1 key (github_deploy) to build.example.com".

The better answer is usually a deploy key on the host itself. The docs say so first.

## One connection per run

Today each call is its own connection: a handshake, a login, often a second or more on a far host. An agent that runs twenty commands pays for twenty.

```halo
tool Box : Remote("deploy@build.example.com", reuse: true)
```

**Semantics.** With `reuse: true`, the run's first call starts a master connection: `ssh -M -N -o ControlPath=<socket> -o ControlPersist=no`. Later calls in the same run pass `-o ControlMaster=no -o ControlPath=<socket>` and share it. The master is closed when the run ends (`ssh -O exit`), as sandboxes are.

**The socket.** Anyone who can open a ControlMaster socket can run commands on the host as you, with no key. So:

- It lives in a folder Halo makes for the run, mode 0700, under `$XDG_RUNTIME_DIR` (or the temp dir), named by a random id, not the host.
- It is never a path in `~/.ssh/config`. The pinned `ControlPath=none` still applies to every call outside the run.
- Two runs never share one, even to the same host. A fan-out's branches share the run's.
- Halo checks the folder's owner and mode before each use, and refuses a socket it didn't make.

**Failure.** A master that dies (the network dropped) makes the next call fail with "couldn't reach", which is retryable: nothing ran. A call that was using the master when it died gets the "may have run" error, as today.

## `AllowCommands`: which commands may run

```halo
policy LookAround : AllowCommands(Box, "systemctl status *", "journalctl -u app *", "df -h", "ls *")

agent Oncall [anthropic/claude-haiku-4-5, tools: auto]
  equips Box
  requires LookAround
```

**Semantics.** For `Box.run`, the command is split into words as a POSIX shell would. Then it is allowed only if:

- it is one simple command: no `;`, `&&`, `||`, `|`, `&`, redirections, `$(...)`, backticks, `$VAR` or globs outside quotes, no newlines;
- its words start with one of the patterns' words, where `*` in a pattern matches any number of further words (only at the end) and `?` matches exactly one word.

Then Halo doesn't send the model's text. It sends the words it parsed, each quoted with `shellQuote`. So what runs is exactly the argv that was checked, whatever the text looked like.

`systemctl status *` allows `systemctl status nginx` and `systemctl status nginx --no-pager`. It refuses `systemctl status nginx; rm -rf /`, `systemctl restart nginx` and `systemctl status $(id)`.

**Security notes.**

- An argv prefix can't see what a program does with its arguments. `find * -exec`, `less` (`!sh`), `vim`, `awk`, `git -c core.pager=…`, `tar --to-command` all run commands. The docs list these, and `halo validate` warns when a pattern ends in `*` after one of them.
- `sudo` in a pattern is allowed, but the pattern after it is checked as if `sudo` weren't there, and the warning above applies to the rest.
- It is no stronger than the host's own limits. On a host you care about, also use a `command=` in `authorized_keys`, or a forced command that reads `SSH_ORIGINAL_COMMAND` and runs only a list. The docs show both.
- `AllowCommands` is enforced by Halo on this machine. It joins `ENFORCED_RULES`, and calls from the pipeline itself are checked too, as `AllowFiles` is.

**Other methods.** `write`, `upload` and `download` aren't commands. `AllowCommands` doesn't limit them; `AllowTools` and `AllowFiles`-like path rules do (`AllowPaths(Box, "/var/log/*")` is a possible follow-up).

## An audit event per remote call

Each SSH call adds an entry to the trace:

```json
{ "kind": "remote", "tool": "Box", "method": "run", "host": "build.example.com", "user": "deploy", "port": 22,
  "hostKey": "SHA256:rqHB…", "jump": [], "command": "systemctl status nginx", "argv": ["systemctl", "status", "nginx"],
  "exitCode": 0, "startedAt": "…", "ms": 412, "stdoutSha256": "…", "stderrBytes": 0, "agent": "Oncall" }
```

- `hostKey` is the fingerprint ssh accepted, read from `ssh -v`'s "Server host key:" line, so the trace says which machine answered, not just its name.
- Output is recorded by hash and size, not content, by default (`audit: "full"` keeps it, masked as today). The trace is often kept longer than a run's logs.
- `write` and `upload` record the path, size and sha256 of what was sent; `download` of what came back.
- The entry is part of the chained entry hash, so `verifyTrace` covers it.
- `halo serve` can forward these events to a webhook or syslog (`"audit": { "url": … }` in halo.json), for teams that already collect SSH audit logs.

## Checking the remote login shell

Halo quotes values for a POSIX shell: `cd`, `export` and `{{placeholders}}` use single quotes, with `'\''` for a quote inside. The remote command runs in the login shell of the user on the host. If that shell is fish, csh or tcsh, this quoting is read differently:

- `shellQuote("\\")` gives `'\'`. In sh that is one backslash. In fish, `\'` inside single quotes is an escaped quote, so the string doesn't end there, and what follows is read as more of the string, or as code.
- csh expands `!` inside single quotes (history), and treats a newline in a quoted string as an error.

**Proposal.** On the first call in a run, Halo runs `echo "$0"; printf '%s' "${SHELL-}"` with a quoted probe value and checks two things: that the login shell is `sh`, `bash`, `dash`, `ksh`, `zsh`, `ash` or `mksh`, and that the probe comes back byte for byte. If not, every call fails with:

```
Box: the login shell for deploy@build.example.com is fish, which reads Halo's quoting differently, so commands can't be sent safely.
Set the user's shell to bash or sh (chsh -s /bin/bash deploy), or declare shell: "sh" to wrap each command in sh -c.
```

`shell: "sh"` can't simply send `sh -c '<command>'`: the quoting around the command would be read by the same login shell that reads quoting wrongly. Instead Halo sends only `exec sh -s`, which every one of these shells reads the same way, and writes the command to ssh's stdin, where no shell parses it as quoting. That uses up stdin, so a command can't read its own input from it, and `write` needs another way to send its bytes (a heredoc inside the script). So it is opt-in.

The probe's result is cached for the run (and with `reuse: true`, for the connection).

## A read-only profile

```halo
tool Prod : Remote("ops@prod-1.example.com", profile: "read-only")
```

A preset for the case people most often want: an agent that can look at a production machine and explain what's wrong, and change nothing.

| | With `profile: "read-only"` |
|---|---|
| Methods offered | `read`, `list`, `download`, `info`, and `run` limited by `AllowCommands` |
| `write`, `upload` | not offered; refused if called |
| `run` | only the profile's commands: `uptime`, `df -h`, `free -m`, `ps aux`, `ss -tlnp`, `systemctl status *`, `journalctl --no-pager -n * -u *`, `cat /proc/loadavg`, `ls *`, `stat *`, `head -n * *`, `tail -n * *`, `grep -F * *` (no `-r` on `/`), and those a policy adds |
| `download` | still writes here, inside `root:` |

It is a convenience, not a guarantee. A read can still be harmful (`cat` of a secret), and the commands above can read anything the user can. The docs pair it with a dedicated user on the host whose only rights are read rights, and say so in `halo plan`'s line for the tool.

## A pure-TypeScript SSH client, or shelling out?

| | Shell out to `ssh` (today) | A TypeScript client in Halo |
|---|---|---|
| Keys, agents, hardware keys, certificates, Kerberos | All of them, as the user already has them | Each one built and kept up to date by us |
| `~/.ssh/config` (aliases, `ProxyJump`, `Match`) | Works | Must be reimplemented, or not supported |
| Who controls the options | ssh's config parser; Halo pins options with `-o` and must know which ones a config can add (`SendEnv`, `SetEnv`, `ProxyCommand`) | Halo, completely: there is no config file to fight |
| Host key checks | ssh's, against known_hosts; pinning needs `KnownHostsCommand` (OpenSSH 8.5+) | Halo's own, easy to pin and to record in the trace |
| Exit 255, dropped connections | Inferred from exit codes and stderr | Known exactly from the protocol (exit-status, channel close) |
| Connection reuse | ControlMaster sockets (see above) | One connection object in memory, nothing on disk |
| Crypto and protocol bugs | OpenSSH's, which is the most reviewed SSH code there is | Ours, or a dependency's; a new attack surface in Halo itself |
| Size, install | Nothing to add; ssh is everywhere Halo runs | A dependency (ssh2 is about 1 MB with native optional parts) or a large amount of code |
| Windows | Built-in OpenSSH since Windows 10 | Same code everywhere |

**Recommendation.** Keep shelling out. The things a library would make easier (pinning, audit, exact exit status, reuse) can each be done with `ssh` as this proposal shows, while the things `ssh` does that a library wouldn't (every key type and agent, the user's config, OpenSSH's review history) are hard to match. Revisit if Halo needs SSH where there is no `ssh` binary (a browser, a Worker), or if the pinned-option list keeps growing with every OpenSSH release.

A middle path worth keeping in mind: `ssh -F /dev/null` plus options Halo writes itself, with host aliases resolved by `ssh -G` first. That makes the config file unable to add anything, at the cost of a second ssh call per new host.

## Changes to what exists

| Area | Change |
|---|---|
| `remote.ts` | `jump:` (built ProxyCommand with pinned options), `jumpHostKey:`, `forwardAgent:`/`agentKeys:` (a run-scoped ssh-agent), `reuse:` (run-scoped ControlMaster), the shell probe, `profile:` |
| `policies.ts` | `AllowCommands(tool, patterns...)`: parse, check, and rewrite the command to the checked argv |
| `shell.ts` | a POSIX word splitter that refuses anything but one simple command (shared with `AllowCommands`) |
| Trace | `kind: "remote"` entries; `audit:` on the declaration |
| `halo plan` | jump hosts, forwarded keys, reuse, profile and `AllowCommands` patterns per tool |
| `halo validate` | warns on `forwardAgent`, on `AllowCommands` patterns after a program that runs commands, and on `profile: "read-only"` with `write` in `AllowTools` |
| Docs | `docs/stdlib/remote.md`: each option; a page on setting up a host (a dedicated user, `command=` in `authorized_keys`, a forced command) |

## Rollout

1. **Audit events and the shell check.** No new syntax for the audit; the shell check fails closed with a clear message. Both make what exists safer.
2. **`jump:` and `jumpHostKey:`.** Small, and replaces the most common reason people reach for `-o ProxyCommand` in a `Bash` command (which 1.12.0 refuses with a placeholder).
3. **`AllowCommands` and `profile: "read-only"`.** The argv parser, the rewrite to the checked argv, and the preset on top.
4. **`reuse: true`.** After the trace can show which calls shared a connection.
5. **`forwardAgent:` with `agentKeys:`.** Last, and only if deploy keys on hosts turn out not to be enough.

## Open questions

- **Should `reuse: true` be the default?** It is faster and, with a run-scoped socket, no less safe. But a socket on disk is a new thing to get wrong, so it starts opt-in.
- **`AllowCommands` for sandboxes too?** The parser is the same. In a sandbox the stakes are lower, but a policy that reads the same everywhere is simpler to review.
- **Should the shell probe also check `PATH` and `umask`?** They change what a command does as much as the shell does, and an agent on a host with an odd `PATH` may run something other than it thinks.
- **Recording the host key.** `ssh -v` output is not a stable interface. `KnownHostsCommand` sees the key too (it is how `hostKey:` works) and could log it, but only when Halo sets that command.
