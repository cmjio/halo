# Halo and MCP: trust, lifetime, and the rest of the protocol

| | |
|---|---|
| Status | Draft proposal. The 1.12.0 fixes in [What exists today](#what-exists-today) are built; the rest isn't |
| Date | 27 November 2026 |
| Builds on | The MCP client (`src/runtime/mcp.ts`), the MCP server (`src/serve/mcp-server.ts`, `halo mcp`, `halo serve` `/mcp`), tool policies (`AllowEffects`, `ApproveTools`, `DenyTools`), `halo plan` and the fence, `halo.lock`, approvals and paused runs, Docker sandboxes |

This lives outside `docs/` because everything under `docs/` is published to halolang.com.

## Summary

Halo speaks MCP both ways. As a client, `tool Git : MCP("npx -y @modelcontextprotocol/server-github")` turns a server's tools into methods an agent can call. As a server, `halo mcp` and `halo serve` turn pipelines into tools for Claude, Cursor and other clients.

Two things are weak today. First, Halo believes what a server says about itself. A tool's effect comes from its annotations, and its description goes straight to the model. A server can change both after you've read them. Second, Halo implements the tools part of the protocol and little else: no sampling, no elicitation, no prompts, no streaming from its own server, and only a simple process lifetime.

This proposal fixes the first by letting the author say what a server's tools do (`effects:`), and by pinning what the server said in `halo.lock`. It fills in the second with sampling routed to a declared agent, elicitation mapped to `|! yield`, prompts, per-run and sandboxed servers, server-side streaming, OAuth, and a proper process lifetime.

## What exists today

As of 1.12.0:

- A stdio server runs without a shell. It sees `PATH`, `HOME` and the variables named in `env:`.
- Without `cwd:`, a stdio server starts in a private empty folder, so it can't load the project's `.env`. Relative paths in its command are made absolute against the project first.
- Settings Halo doesn't read (`timeout: 5`, `oauth: true`) are errors, with did-you-mean.
- Every `tools/call` sends a `progressToken`. Progress restarts the `timeout_ms` wait, up to `max_ms`. Each report is a `tool_progress` run event.
- A tool's effect comes from its annotations: `readOnlyHint` is read, `destructiveHint` or `openWorldHint` is external, anything else is write.
- `halo plan` can't start servers, so it shows `Git.*: unknown`. It counts that as "maybe acts on the world", not as nothing.
- On the server side, each pipeline's tool gets a description and annotations from its plan. A paused run returns `{ status, runId, waitingFor, approveUrl }` as `structuredContent`.
- A `notifications/cancelled` stops only the caller's own call.

## Goals

- Let the author, not the server, decide what a tool's effect is, and make `halo plan`, `AllowEffects` and `ApproveEffects` use that.
- Notice when a server's tools change after they were reviewed, and refuse the changed ones by default.
- Check what goes to a server and what comes back against the schemas the server published.
- Support sampling, elicitation and prompts without giving a server any power a declared agent or a person doesn't already have.
- Keep one tenant's or run's server state away from another's, and run untrusted servers in a sandbox.
- Stream long runs and pauses from Halo's own server.
- Never leave a server process (or its children) running after Halo is done with it.

## Non-goals (for now)

- Resource subscriptions (`resources/subscribe`). Halo reads resources when asked.
- Roots that expose the project. Halo answers `roots/list` with no roots, and keeps doing so.
- Being a general MCP gateway or proxy for other clients.
- The legacy HTTP+SSE transport (2024-11-05). Streamable HTTP and stdio are enough.

## 1. Author-declared effects

### Syntax

```halo
tool Git : MCP("npx -y @modelcontextprotocol/server-github", env: ["GITHUB_TOKEN"],
  effects: {
    read: ["list_*", "get_*", "search_*"],
    write: ["create_*", "update_*"],
    external: ["merge_pull_request", "push_*"],
  })
```

Each key is an effect: `read`, `write` or `external`. Each value is a list of tool names, with `*` matching any run of characters.

An option says what happens to tools no pattern names:

```halo
  effects: { read: ["list_*"], other: "unknown" }   // the default is "annotations"
```

- `other: "annotations"` (the default): use the server's annotations, as today.
- `other: "unknown"`: treat them as unknown, which policies treat as the most severe effect.
- `other: "hide"`: don't offer them to agents at all. A pipeline that calls one gets `TOOL_METHOD`.

### Semantics

- A declared effect wins over the server's annotations, always.
- A name that matches patterns under two effects gets the more severe one (`external` over `write` over `read`). `halo validate` warns when that happens, since it's probably a mistake.
- `AllowEffects(read)` offers only tools whose effect is read. A tool whose effect is unknown (`other: "unknown"`) is treated as `external` by `AllowEffects` and `ApproveEffects`, so it is hidden or asked about like the most severe kind.
- `halo plan` lists the declared patterns without starting the server: `may call Git.list_*: read`, `may call Git.merge_pull_request: external`. Tools no pattern names show as `Git.(others): unknown` (or nothing, with `other: "hide"`).
- The fence compares declared effects like any other.

### Validation

- `effects:` must be a record. Its keys are `read`, `write`, `external` and `other`. Anything else is an error, with did-you-mean.
- Each pattern is a string of letters, digits, `_`, `-`, `.` and `*`.
- A pattern that matches none of the locked tools (see [section 2](#2-pinning-tool-definitions-in-halolock)) is a warning: the server may have renamed it.

### Security notes

- Annotations are a server's claim. Declared effects are the author's. Only the author's should be relied on for `AllowEffects`.
- `other: "hide"` is the safe choice for a server you only want part of. It's the same as `DenyTools` with every unnamed tool, but it keeps working when the server adds tools.
- Effects are about Halo's policies. They don't stop a server from doing more than its name suggests. A `list_files` that deletes files is still a bad server.

## 2. Pinning tool definitions in `halo.lock`

### The problem

A server's tool list is read when an agent call starts. A server can change a tool's description to tell the model to do something else, or change its schema, after you reviewed it. This is a "rug pull". The model sees the new text, and nothing tells you.

### Syntax

```sh
halo mcp lock            # connect to every MCP tool in the project, record what each offers
halo mcp lock Git        # just one
halo mcp diff            # what changed since the lock, without changing it
```

`halo mcp lock` starts local servers, so it needs the same trust as running them. It asks before starting a command it hasn't started before, unless `--yes` is given.

### What is recorded

`halo.lock` gets an `mcp` section, keyed by file and tool name:

```json
{
  "mcp": {
    "flows/maintain.halo#Git": {
      "server": "sha256:…",
      "serverInfo": { "name": "github", "version": "0.6.2" },
      "protocolVersion": "2025-06-18",
      "tools": {
        "list_issues": { "sha256": "…", "effect": "read" },
        "merge_pull_request": { "sha256": "…", "effect": "external" }
      },
      "lockedAt": "2026-11-27T10:00:00Z"
    }
  }
}
```

- `server` is a hash of the command or URL, never the values of `env:`, `apiKey:` or `headers:`.
- Each tool's `sha256` covers its name, title, description, `inputSchema`, `outputSchema` and annotations, as canonical JSON.
- `effect` is the effect Halo worked out when locking (declared, else from annotations).

### At run time

When a locked tool list is read:

- A tool whose hash matches is offered as usual.
- A tool whose hash differs is **refused**: not offered to agents, and a pipeline's call fails with `MCP_DRIFT`. The error names the tool and says to run `halo mcp diff` and then `halo mcp lock`.
- A new tool is not offered until it is locked. A pipeline's call to it fails with `MCP_DRIFT`.
- A tool that's gone is fine. Calls to it fail as they do today.

A declaration can relax this with `drift: "warn"`: changed and new tools are offered, and each is logged and emitted as a `violation` event. `drift: "off"` turns the check off for that tool. A tool with no lock entry is not checked, so nothing changes for projects that never run `halo mcp lock`.

`halo serve` and `halo mcp` refuse to start when a locked server's tools have drifted, unless `--allow-drift` is given. That way drift shows up at deploy time, not in the middle of a run.

### `halo plan` from the lock

When a tool is locked, `halo plan` lists its real methods and their effects from the lock, without starting the server. `Git.*: unknown` then only appears for tools that aren't locked.

### Security notes

- This defends against a server that changes after review. It does not defend against a server that was malicious when you locked it. Read the descriptions in `halo mcp diff` before locking.
- An HTTP server can show one tool list to `halo mcp lock` and another later. The run-time check catches that, because it compares every list it reads.
- The hash covers the description because the description is what the model reads. A change of one word is a change.

## 3. Input and output schema validation

Today Halo sends whatever arguments the model chose, and returns whatever comes back.

- **Before a call**, Halo checks the arguments against the tool's `inputSchema`, for a JSON Schema subset: types, `properties`, `required`, `items`, `enum`, `additionalProperties`. A mismatch from an agent's call goes back to the model as a tool error it can fix, without reaching the server. A mismatch from a pipeline's own call is a `TOOL_ARGUMENT` error.
- **After a call**, when the tool has an `outputSchema`, Halo checks `structuredContent` against it. The spec says a server must return matching content, and a client should check. A mismatch is a `TOOL_FAILED` error: a server that breaks its own contract shouldn't be trusted to have done what it said.
- `validate: false` on the declaration turns both off, for servers whose schemas are known to be wrong.

A schema Halo can't check (`$ref` outside the document, `oneOf` deeper than a few levels) is skipped, and the call goes through. A schema bigger than 64 KB is skipped too.

## 4. Sampling, routed to a declared agent

### Syntax

```halo
agent Summarizer [anthropic/claude-haiku-4-5]
  requires Cheap

tool Research : MCP("uvx research-server", sampling: Summarizer)
```

### Semantics

- Halo tells the server it supports sampling only when the declaration has `sampling:`. Without it, a `sampling/createMessage` request gets a `-32601` error, as today.
- With it, each request runs as a call to that agent: its model, its policies (`Block`, `Redact`, output rules), and its `MaxSpend`. The cost is added to the run that made the tool call.
- The server's `systemPrompt` is appended to the agent's own system prompt, never put in its place.
- `maxTokens` is capped at the agent's `max_tokens`. `modelPreferences` are ignored: the agent's model is the one that runs.
- `includeContext` is treated as `"none"`. A server never sees the run's other messages.
- The sampling call gets no tools.
- Each sampling call is an `llm` event, labelled `Summarizer (sampling for Research.search)`, so it's in the trace, the plan and the cost.
- `max_sampling: 5` (the default) caps the sampling calls one tool call may make. The next one gets an error.
- `halo plan` shows the agent under the tool call: `may ask Summarizer (sampling)`, with its worst-case cost.

### Security notes

- The prompt comes from the server, so it's untrusted input, like a web page. The agent's input policies apply to it.
- A server can't pick a more expensive model, bypass `MaxSpend`, or reach the run's context.
- The spec suggests a person approves each sampling request. `ApproveTools("Research.sampling")` can ask for that, using the run's approval path.

## 5. Elicitation, mapped to `|! yield`

### Syntax

```halo
tool Deploy : MCP(url: "https://deploy.example/mcp", apiKey: Env.DEPLOY_KEY, elicitation: true)
```

### Semantics

- Halo says it supports elicitation only when the declaration has `elicitation: true`. Otherwise an `elicitation/create` request gets an error.
- With it, the server's question becomes a pause, like `|! yield`. The person sees the server's message, the tool and method that asked, and a form built from `requestedSchema` (which the spec limits to flat strings, numbers, booleans and enums).
- When Halo can ask at once (`halo run` in a terminal, `runtime.onInterrupt`), it asks and answers the request in the same call.
- When it can't (`halo serve`, `halo mcp`), the run pauses. The in-flight tool call is abandoned and the server is told it was cancelled. When the pause is answered, the stage runs again. The answer is stored with the request's message and schema, and when the server asks the same thing again, Halo answers from it at once. This is the same pattern tool approvals use today.
- Accept, decline and cancel map to the spec's `action` values. A person who doesn't answer before the pause expires is a `cancel`.
- Inside a fan-out, `each`, or a branch, where a run can't pause, elicitation fails the call with `APPROVAL_NEEDED`, as tool approvals do.

### Security notes

- Running the stage again calls the tool again. A server that did something before asking will do it twice. The docs will say so, and recommend elicitation only for servers that ask before they act.
- The spec says servers must not ask for sensitive data through elicitation. Halo can't check that. The form says which server is asking, and that the answer goes to it.
- The answer goes only to the server that asked, never to a model.

## 6. Prompts and server instructions

### Prompts

```halo
pipeline Review(pr: Integer) -> Result:
  pr
    |> Git.prompt("review_pr", pr_number: pr) as brief
    |> Reviewer.review(context.data.brief)
```

- `Tool.prompt(name, ...args)` calls `prompts/get` and returns its messages as text (one message) or a list of `{ role, content }`.
- `Tool.list_prompts()` returns the server's prompts. Both are read effects.
- Prompts are never offered to agents as tools. They are text for a pipeline to use.

### Server instructions

A server's `initialize` result may include `instructions`. Today Halo keeps them and does nothing.

- `instructions: true` on the declaration adds them to the system prompt of any agent call that has the tool, under a heading that names the server.
- The default is `false`. Instructions are the server's text, written for any client, and they go to the model with the weight of a system prompt. That's a lot of trust for a default.
- Locked servers (section 2) include the instructions in the lock, so a change is drift.

## 7. Per-run servers and sandboxing

### Syntax

```halo
tool Scratch : MCP("npx -y some-notes-server", per_run: true)
tool Shell   : MCP("uvx mcp-shell", sandbox: docker, hosts: [], files: ["src"])
```

### `per_run: true`

- A new server is started for each run and stopped when the run ends (completes, fails, halts or pauses).
- Use it for servers that keep state in memory: one run, or one tenant under `halo serve`, can't see what another left behind.
- Under `halo serve`, a run that pauses stops its server. When it resumes, it gets a new one. That is stated in the docs: state doesn't survive a pause.
- `per_run` doesn't apply to HTTP servers. For them, a session is already per client; a per-run session id is a possible follow-up.

### `sandbox: docker`

- The command runs inside a container, using the Docker sandbox Halo already has: an image (`image:`, default the sandbox's), no network except `hosts:`, and only the `files:` copied in.
- `env:` names are passed into the container, like a sandbox's `secrets:`.
- The working folder is the container's, so the `.env` problem fixed in 1.12.0 can't arise.
- stdio goes through `docker exec -i`. The container is per declaration, or per run with `per_run: true`.
- A sandboxed server counts as wallet-safe: it can't run commands on the host.

### Security notes

- Today a stdio server runs as you, with your files and network. That's the main risk of MCP in Halo. `sandbox: docker` is the real fix, and the docs should recommend it for any server you didn't write.
- `per_run` limits what leaks between runs. It doesn't limit what a server can do in one.

## 8. Server-side streaming of long runs and pauses

Halo's `/mcp` endpoint answers each POST with one JSON response. A run that takes ten minutes holds the request open with nothing on it, and proxies time it out.

- When a `tools/call` request accepts `text/event-stream`, Halo answers with a stream.
- If the request has a `progressToken`, Halo sends `notifications/progress` as stages finish: `progress` is the number of stages done, `total` the pipeline's stage count, and `message` the stage's label.
- Halo also sends a comment line every 15 seconds, so proxies keep the stream open.
- When the run completes, fails, halts or pauses, the result goes on the stream and the stream ends. A pause ends the call with the `{ status: "paused", ... }` result that exists today.
- Clients that only accept JSON get JSON, as today.
- Resuming a dropped stream (`Last-Event-ID`) is a follow-up. It needs sessions, which Halo's server doesn't keep yet.

`halo mcp` (stdio) gets the same progress notifications, since stdio has no request timeout but clients still like to show progress.

A later step could let the client answer a pause in the same stream, by sending an elicitation request to the client instead of ending the call. That depends on the client supporting elicitation, and on deciding whether the MCP client's user is the right person to approve (often they aren't: the approver is someone else).

## 9. MCP OAuth

MCP's authorization spec uses OAuth 2.1 with discovery, dynamic client registration, PKCE and resource indicators. Halo only supports `apiKey:` and `headers:` today.

The OAuth design for Halo as a whole is in [proposals/oauth.md](oauth.md), which covers token storage, refresh, scopes and who may consent. For MCP, the plan is:

- `MCP(url: "...", auth: oauth)` uses that design, with discovery from the server's protected resource metadata.
- Tokens are never in `halo.lock`, the trace or the environment of a stdio server.
- The resource indicator is the declared URL, so a token for one server can't be replayed to another.

Until that proposal lands, `oauth:` stays an unknown setting (an error since 1.12.0).

## 10. Process lifetime

### Today

A stdio server starts on first use and stays until `closeMcpClients()`. If it exits, the next call starts it again, at once, every time. `close()` ends stdin, waits one second, then kills the process. With `npx`, that kills `npx` but can leave its `node` child running.

### Proposed

- **Process groups.** Start each server in its own process group, and on close send `SIGTERM` to the group, then `SIGKILL` after a grace period (`kill_grace_ms`, default 2000). That reaches `npx`'s, `uvx`'s and shell wrappers' children. On Windows, use `taskkill /T`.
- **Idle shutdown.** `idle_ms:` (default 10 minutes under `halo serve`, never for `halo run`) stops a server that has had no requests for that long. The next call starts it again.
- **Restart backoff.** After a server exits, wait before starting it again: 0.5 seconds, doubling up to 30. After 5 exits within 5 minutes, stop trying for that declaration and fail calls with `MCP_CRASHING`, with the last stderr lines. A clean run of a few minutes resets the count.
- **Startup timeout.** `initialize` gets its own limit (`start_ms`, default 30000), separate from `timeout_ms`, because `npx -y` may download a package first.
- **Exit with Halo.** When Halo exits on a signal, it kills every server group, so a `Ctrl-C` doesn't leave servers behind.
- **Visible state.** Studio's run page shows which servers a run used, with their pid, uptime and restart count.

### Security notes

- An orphaned server keeps whatever the declaration gave it: the variables in `env:`, a network connection, open files. Killing the group closes that.
- Restart backoff stops a crashing server from burning CPU or hammering an API in a loop.

## Validation and `halo plan`

- `effects:`, `drift:`, `validate:`, `sampling:`, `max_sampling:`, `elicitation:`, `instructions:`, `per_run:`, `sandbox:`, `idle_ms:`, `start_ms:` and `kill_grace_ms:` join the settings `halo validate` knows.
- `sampling:` must name a declared agent. `sandbox:` takes `docker` for now.
- `halo plan` uses declared effects and the lock, shows sampling agents and their cost, and marks tools that can elicit as "may ask a person".

## Threat model

| Threat | Today | With this proposal |
|---|---|---|
| A server lies in its annotations | `AllowEffects` trusts them | Declared `effects:` win; `other: "unknown"` or `"hide"` for the rest |
| A server changes a description after review (rug pull) | Not noticed | `MCP_DRIFT`: the changed tool is refused |
| A server reads the project's `.env` | Fixed in 1.12.0 for runtimes that read the working folder | Also covered by `sandbox: docker` |
| A server reads your files or network | It runs as you | `sandbox: docker` with `hosts:` and `files:` |
| A server's state leaks between runs or tenants | One process for all | `per_run: true` |
| A server makes Halo spend through sampling | Not possible (unsupported) | Only through a declared agent, under its `MaxSpend` |
| A server phishes a person through elicitation | Not possible (unsupported) | Opt-in; the form names the server; the answer goes only to it |
| An orphaned server keeps running | Possible with `npx` | Process groups and exit handling |
| One client cancels another's run | Fixed in 1.12.0 | — |

## Rollout

1. **1.12.0 (built).** Private working folder, settings validation, progress and `max_ms`, plan wording, server annotations and paused results, cancellation per caller.
2. **Effects and lifetime.** `effects:`, unknown as external in `AllowEffects`/`ApproveEffects`, process groups, idle shutdown, restart backoff, `start_ms`.
3. **Pinning.** `halo mcp lock` and `diff`, drift checks at run time and at `halo serve` start, `halo plan` from the lock.
4. **Schemas, prompts and instructions.** Input and output validation, `prompt()` and `list_prompts()`, `instructions: true`.
5. **Halo's own server.** Streaming progress and results over SSE, keep-alive, the same progress over stdio.
6. **Sampling and elicitation.** Both opt-in, with plan, trace and approval support.
7. **Isolation and auth.** `per_run: true`, `sandbox: docker`, and OAuth once [proposals/oauth.md](oauth.md) lands.

Each step is useful alone, and each adds its settings to `halo validate` when it ships, not before.

## Open questions

- **Should `other: "unknown"` be the default?** Treating every undeclared MCP tool as external at run time is safe, but `ApproveEffects(external)` would then ask about every MCP call, and changing the default would break projects that rely on annotations today. Maybe it should be the default only for tools that aren't locked.
- **Lock per project or per machine?** Tool definitions belong in `halo.lock`, so a team reviews the same thing. But an HTTP server might show different tools to different users. A per-user override file may be needed.
- **Who approves an elicitation under `halo serve --package`?** The consumer, the publisher, or nobody (refuse)? Refusing is the safe default until the hosted approval story exists.
- **How much of the Docker sandbox to reuse.** The existing sandbox is built for agents running commands. A long-lived stdio server inside it may need a different lifecycle (no `ttl_minutes`, health checks).
- **Should `effects:` accept a server's annotation as a floor?** If the server says `destructiveHint: true` but the author wrote `read`, should Halo warn? It probably should, since one of them is wrong.
