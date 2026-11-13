# Halo Scopes: tenants and siloed tasks

| | |
|---|---|
| Status | Draft proposal. Step 1 of the [rollout](#rollout) is built (the rules, `files:`, `secrets:`); the rest isn't. |
| Date | 13 November 2026 |
| Builds on | Policies (`AllowTools`, `DenyTools`, `DenyArgs`, `AllowHosts`, `MaxSpend`), Docker sandboxes (`from:`, `hosts:`, forks, `diff`/`apply`), `halo serve` consumer keys, the trace |

## Summary

An orchestrator splits a tenant's job into tasks and hands each to a subagent with its own computer. Today the limits on each subagent are fixed in the source: an agent's policies and its sandbox tool's declaration. The orchestrator can pick which declared role does a task, but it can't say *"this task gets `src/billing/`, `api.stripe.com` and $0.50, and nothing else"*.

This proposal adds **scopes**: limits the orchestrator attaches to a task at run time, which the runtime enforces and which **can only narrow** what the code already allows. A scope is applied to a stage with `within`:

```halo
|* each(t in context.data.plan, concurrency: 4) => Dispatch(task: t.task) within t.scope as results
```

Scopes stack in three layers, each one inside the last:

```
code       what the declarations allow: agents' policies, tools' config        (the ceiling)
  tenant   what this tenant's runs may use: its folder, hosts, secrets, quotas  (halo serve)
    task   what one task may use: some of its tenant's files, hosts, tools, budget  (within)
```

A scope that asks for more than the layer above it allows is refused before anything runs.

## Goals

- Let an orchestrator, even one driven by a model, give each task a smaller silo than its role, without being able to give one a bigger silo.
- Make a scope bind **everything a stage does**: the agent's tool calls, the pipeline's own tool calls, the sandboxes the stage creates, and the pipelines it calls.
- Keep silos separate. A scoped task starts with only its own files, never a fork of a sandbox that holds someone else's.
- Give tenants their own folder, secrets, hosts and quotas in `halo serve`, so no tenant can see another's data or spend another's budget.
- Record each task's scope in the trace, so a reviewer, `halo replay` and an audit can see what each subagent was allowed to do.

## Non-goals (for now)

- Scopes on hosted sandboxes (E2B, Daytona). They can't enforce `hosts:`, and they don't fork. Scopes with `hosts` need Docker, as `hosts:` does today.
- Multi-host scheduling. Tenants share the machine `halo serve` runs on (see [Limits across tenants](#limits-across-tenants)).
- A scope language with arbitrary logic. A scope is data: lists and numbers.

## What a scope is

A scope is a **policy filled in at run time**. Each field becomes rules, and those rules are added to the agent's own policies for the length of the stage:

| Field | Example | Becomes | Narrows |
|---|---|---|---|
| `tools` | `["Box.read", "Box.run", "Box.diff"]` | `AllowTools(...)` | the methods the agent is offered and may call |
| `files` | `["src/billing", "test/billing"]` | `AllowFiles(...)` (new) | what's copied into the sandbox, and what `apply` may write back |
| `hosts` | `["api.stripe.com"]` | `AllowHosts(...)` | the sandbox's egress allowlist; `[]` means no network |
| `secrets` | `["STRIPE_TEST_KEY"]` | `AllowSecrets(...)` (new) | the environment variables put into the sandbox |
| `budget` | `0.50` | `MaxSpend(...)`, counted for this stage only | model spend inside the stage |
| `time` | `"20m"` | a stage timeout and the sandbox's `ttl_minutes` | wall-clock time |
| `label` | `"billing"` | nothing; names the silo in the trace and in errors | — |

Rules in Halo already intersect: several `AllowTools` must all allow a call, and any `DenyTools` refuses it. So a scope that only **adds** rules can't widen anything. The runtime checks this up front anyway, so a planner that over-reaches gets a clear error instead of a silently smaller silo:

```
Dispatch within scope "billing": hosts asks for "*.stripe.com", which the code doesn't allow
  (Box allows: registry.npmjs.org, api.stripe.com)
```

### Where a scope comes from

`within` takes either a declared policy or a value from the run:

```halo
policy BillingOnly : AllowFiles("src/billing", "test/billing") & AllowHosts("api.stripe.com") & MaxSpend(0.50)

  |> Dev.work(task) within BillingOnly                 // fixed: written in the source
  |> Dev.work(task) within context.data.plan[0].scope  // dynamic: e.g. from a planner agent
```

A dynamic scope is checked against a schema: unknown fields are an error, and so are the wrong types or a path containing `..`. A scope written by a model is untrusted input, held to the ceiling like any other.

### What `within` binds

For the length of the stage, including pipelines it calls and fan-outs inside it:

1. **Agent tool calls.** The scope's rules join the agent's, both for which methods the model is offered (`toolVisible`) and for each call (`checkToolCall`).
2. **The pipeline's own tool calls.** Today a pipeline's direct calls (`|> Box.apply()`) aren't checked against policies, because the pipeline is trusted code. Inside `within`, they are checked against the scope: `Box.apply()` in a `files: ["src/billing"]` task can't write `src/auth/`. Outside `within`, behaviour doesn't change.
3. **Sandboxes created in the stage.** A sandbox tool's config is narrowed before the container starts:
   - `from:` copies in only `files`, keeping their paths.
   - `hosts:` becomes the intersection of the tool's hosts and the scope's.
   - `secrets` are set as environment variables in the container, and nowhere else (see [Secrets](#secrets)).
   - `ttl_minutes` and resources are capped by `time` and by the tenant's quotas.
4. **`diff` and `apply`.** `diff` reports only changes within `files`. `apply` writes only those; changes elsewhere stay in the sandbox and are listed as `outside` in both results. A refusal would block every task that builds something (build output lands outside `files`), and a list keeps the reviewer informed without writing anything. Inside `within`, an `outside` list will also be recorded as an `AllowFiles` violation.

### Silos

Separation between tasks comes from three rules:

- **A scoped stage gets fresh sandboxes.** It doesn't fork the run's sandbox, which may hold files outside its scope. It starts from the tool's image plus its `files`. (A fan-out inside a scoped stage still forks, from the scoped sandbox.)
- **One network per sandbox.** Each sandbox already gets its own internal Docker network and proxy, so two silos can't reach each other.
- **Only the pipeline moves data between silos.** An agent's result goes back into `context.data`, where the orchestrator (pipeline code) decides who sees it next. One subagent can't read another's sandbox.

## Tenants

A tenant is the outer scope of every run it starts. Tenants generalise the consumer keys `halo serve --package` already has:

```jsonc
// .halo/tenants.json (or HALO_TENANTS_FILE)
{
  "acme": {
    "key": "Env.ACME_KEY",            // how its requests authenticate
    "dir": "/srv/tenants/acme",       // its folder; from: and apply can't leave it
    "hosts": ["registry.npmjs.org", "api.stripe.com"],
    "secrets": { "STRIPE_TEST_KEY": "Env.ACME_STRIPE_TEST_KEY" },
    "budget": { "run": 5.00, "day": 50.00 },
    "sandboxes": { "concurrent": 6, "cpus": 2, "memory": "4g" },
    "isolation": "vm"
  }
}
```

- **Its runs are scoped.** A run started with acme's key runs `within` acme's scope. Every task scope inside the run must fit inside it.
- **`context.tenant`** is readable in templates (`from: "{{tenant.dir}}/{{area}}"`), so one set of pipelines serves every tenant. `context.tenant` never includes secret values.
- **Its sandboxes are labelled.** Containers carry `halo.tenant=acme`, so `halo sandboxes --tenant acme` lists them and `prune` can clean them up.
- **Isolation per tenant.** A tenant can require `isolation: "vm"`. Its sandboxes then run under gVisor or Kata, or fail to start if neither is installed (fail closed).

### Secrets

Secrets are the case where a mistake costs most, so they follow stricter rules than the other fields:

- A secret's **name** can be scoped; its **value** never enters `context`, a prompt, a trace or a log. This keeps the rule Halo already has for `Env.*`.
- A sandbox receives a secret only if three layers all allow it: the tool declares it can take it (`Remote("docker", secrets: ["STRIPE_TEST_KEY"])`), the tenant has it, and the task's scope names it.
- The value is passed with each command (`docker exec --env NAME`, the value only in the docker client's environment), not when the container is created. `docker commit` saves a container's settings along with its files, so a secret set at `docker run` would land in every snapshot; set per command, it never does. A rewind, a pause or a `keep` gets the value again from the tenant. (Built and checked against Docker: neither the snapshot's image config nor the container's settings contain it.)
- Secret values are redacted from anything a sandbox returns (`stdout`, `diff`, `read`), as `Redact` does today.

### Limits across tenants

`halo serve` enforces a tenant's `budget.day` and `sandboxes.concurrent` across all of its runs:

- A run that would go over a quota waits in a queue (up to a limit) instead of failing.
- Spend is checked before each model call, as `MaxSpend` is today, against a per-tenant total kept in the serve state folder.
- `/api/usage` reports runs, spend and sandbox time per tenant, extending the per-consumer metering `--package` already has.

## The orchestrator pattern, end to end

```halo
policy Budget     : MaxSpend(5.00)
policy StayInside : DenyTools("Box.apply", "Box.download", "Box.keep")

// The ceiling for every task: what any silo could ever get.
tool Box : Remote("docker", image: "node:22", from: "{{tenant.dir}}",
                  hosts: ["registry.npmjs.org", "api.stripe.com"],
                  secrets: ["STRIPE_TEST_KEY"])

agent Planner [anthropic/claude-sonnet-4-5, temp: 0.0]
  system """
    Split the job into independent tasks. For each, give the smallest scope that can do it:
    {"task": "...", "scope": {"label": "...", "files": [...], "hosts": [...], "secrets": [...], "budget": 0.5}}
    Tasks must not share files.
  """
  requires Budget

agent Worker   [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: Box]  requires Budget, StayInside
agent Reviewer [anthropic/claude-sonnet-4-5, temp: 0.0]                    requires Budget

pipeline Task(task: String) -> Result:
  task
    |> Worker.work("{{task}} Run the tests.") as report
    |> Box.run(command: "npm test 2>&1 | tail -20") as tests
    |> Box.diff() as changes
    |> System.Value([context.data.report, context.data.tests, context.data.changes])

pipeline Job(job: String) -> Result:
  job
    |> Planner.split(job) as plan
    |! yield                                                  // optional: a person approves the scopes
    |* each(t in context.data.plan, concurrency: 4) => Task(task: t.task) within t.scope as results
    |> Reviewer.review("Check each change stays within its task.", context.data.results) as verdict
    |! yield
    |> Box.apply(from: context.data.results) within { files: context.data.plan[*].scope.files }
```

What each silo gets: only its own files, hosts and secrets, its own budget, and a container that no other silo can reach. What the planner can do wrong: give a task too little (it fails, and the reviewer sees why), or give a task anything the ceiling allows. It can't give a task more than the ceiling, or another tenant's anything.

## Validation and `halo plan`

- `halo validate` checks `within` targets: a declared policy must exist. A literal scope is checked against the schema and, where it can be, against the ceiling.
- `halo plan` shows each scoped stage with its ceiling, the worst case a dynamic scope could reach, so a reviewer of the code sees the outer limit without running a planner.
- `AllowFiles` and `AllowSecrets` join `ENFORCED_RULES`. Like `AllowHosts`, they're an error on a sandbox that can't enforce them.

## Trace and replay

- Each scoped stage's trace entry records the **effective** scope (after intersection) and its hash, and that hash is part of the chained entry hash. `verifyTrace` therefore vouches for the limits each task ran under, not just what it did.
- Violations carry the scope's `label` and the tenant: `acme/billing: Box.apply was refused: test/auth/x.ts is outside AllowFiles`.
- `halo replay` re-applies the recorded scopes rather than re-running the planner, so a replay can't come out with a different silo.

## Changes to what exists

| Area | Change |
|---|---|
| Parser | `within <policy | expr>` as a stage suffix; `AllowFiles`, `AllowSecrets` rules; `secrets:` on `Remote` |
| `PolicyEngine` | `rulesFor(agent, scope?)` adds the scope's bound rules; check direct pipeline tool calls inside `within` |
| `AllowHosts` | intersect by pattern (`*.stripe.com` ⊇ `api.stripe.com`), not by exact string as `allowedHosts` does now |
| `ExecutionContext` | `scope?` (inherited by called pipelines and fan-out branches, like `branch`); `tenant?` |
| `remote.ts` | narrow `from:`, `hosts:`, `ttl` and env per scope; scoped stages start fresh, not forked; `apply` checks `AllowFiles`; labels include `halo.tenant` |
| `halo serve` | `tenants.json`; runs start with the tenant's scope; quotas and the queue; `/api/usage` per tenant |
| Trace | `TraceEntry.scope` and `scopeHash` |
| CLI | `halo sandboxes --tenant`; `halo plan` shows ceilings |

## Alternatives considered

### A scope handle: `Scope.narrow(...)`

```halo
task
  |> Scope.narrow(base: ApiBox, files: "src/billing/", hosts: ["api.stripe.com"]) as scoped
  |> scoped.agent.work(task)
```

This gives the same guarantee: the new scope intersects its base and can't widen it. The difference is that the scope is a **value** you hold and call through, where `within` is a **region** of the pipeline. The region design wins on four counts:

- **It binds everything, not just the calls made through the handle.** Inside `within`, the pipeline's own calls (`Box.apply`), called pipelines and fan-outs are all scoped. With a handle, a direct `ApiBox.apply()` on the next line bypasses the scope, because it doesn't go through `scoped`.
- **It can't escape.** A handle stored in `context.data` can outlive the stage, or be passed to a different task. A region ends when its stage does.
- **It fits the language.** Halo calls methods on declared names (`Dev.work`, `Box.run`), not on values. `scoped.agent.work` would need first-class objects with methods, a much larger change than one stage suffix.
- **It's one place to look.** `halo plan`, the trace and a reviewer find a task's limits on the stage that runs it.

From the handle design, this proposal keeps the **explicit base**. `within` takes its ceiling from the agent and tool the stage uses. When a stage uses several sandbox tools, `within t.scope, base: ApiBox` says which tool's limits the scope narrows. Then a typo in a scope can't silently target a different, wider tool.

### Pre-declaring every narrow role

That is what works today: one policy and one sandbox tool per role. It's fine for a few fixed roles, but forces a choice between declaring every combination of files and hosts and reusing a wider silo than the task needs. Scopes make the declared roles the ceilings and let tasks narrow them.

### Generating policies from the planner's output

Turning a model's JSON straight into policies would let a prompt injection in the tenant's repo write a wider policy. Intersecting with a ceiling written in code is the whole point. A scope's fields can only ever add rules.

## Rollout

1. **Rules.** *(Built.)* `AllowFiles` and `AllowSecrets`; `AllowHosts` intersecting by pattern; `files:` on any sandbox and `secrets:` on Docker sandboxes. This is useful on its own, with static policies.
2. **`within`.** Static and dynamic scopes, checks on the pipeline's own calls, fresh sandboxes per scope, trace and replay.
3. **Tenants.** `tenants.json`, `context.tenant`, tenant secrets and labels, quotas and the queue.
4. **Merging silos.** `apply(from: [...])` for several tasks' diffs. When tasks' `files` don't overlap, the merge can't conflict. The planner prompt asks for that, and `apply` checks it.

## Open questions

- **Refuse or clamp?** This proposal refuses a scope that asks for more than its ceiling. Clamping it (dropping the extra) is friendlier to a planner, but hides mistakes. A `clamp: true` option on `within` is possible later.
- **Can a scoped stage ever fork?** Starting fresh is the safe default. A task that needs the run's installed dependencies could opt in with `within t.scope, inherit: true`, but only if the run's sandbox holds nothing outside the task's `files`. That's hard to check without hashing the sandbox, which `diff` already does.
- **Who may approve a scope?** A `|! yield` on the plan works today. An `ApproveScope(...)` rule could pause only for scopes that ask for secrets or for external hosts.
- **Reads outside `files`.** A silo only has its own files, so the agent can't read the rest of the repo for context. A `read_files` field (copied in read-only, never applied back) may be needed for real codebases.
- **Tenant storage.** Is `tenants.json` enough, or should tenants live in the serve state database from the start, as Halo Cloud would need?
