# Halo Cloud: hosting and registry

| | |
|---|---|
| Status | Draft proposal. Nothing here is built. |
| Date | 5 November 2026 |
| Prototype | [Halo Cloud prototype](https://claude.ai/artifact/LnPMtJ9aRtLQM9ptC6HrNp) (private; ask for access) |
| Builds on | `halo serve`, `halo plan`, `halo replay`, `halo rewind`, tool packages and `halo.lock`, blueprints, agent presets, skills |

This proposal lives outside `docs/` on purpose. Everything under `docs/` is published to halolang.com, and this describes a product that doesn't exist yet.

Hostnames and new commands in this proposal (`*.acme.halolang.com`, `registry.halolang.com`, `halo deploy`, `halo promote`, `halo secrets`, `halo login`) are placeholders.

## Summary

Halo has a language, a runtime, and a single-process server (`halo serve`). It has no place to host projects for a team, and no place to share what people build with it beyond a static `index.json` of tool packages.

Halo Cloud is two products with one sign-in:

1. **Hosting.** You connect a repo or run `halo deploy`, and your pipelines run with durable paused runs, per-environment secrets, previews for every pull request, and an approvals inbox. Each project can also serve its pipelines over MCP.
2. **The registry.** Tools, MCP servers, agents, skills and blueprints, published with automated review and provenance. Every listing shows first what the package can reach.

Both products are built on features the language already has, so the platform doesn't need a new language. Effects (`read`, `write`, `external`), `halo plan`, policies, the hash-chained trace, and the `halo.lock` permission record already describe what a pipeline can do. The platform decides when a deploy, an install or an upgrade needs a person to look first, and shows that person what they need to decide.

## Goals

- Get from a repo or a blueprint to a live, safe deployment in under ten minutes, without writing a Dockerfile.
- Make promotion depend on **what a change can now do**, not only on whether the tests pass.
- Give the people who answer `|! yield` one inbox, wherever the run came from.
- Make debugging cheap. Use rewind and replay so you don't re-run models you've already paid for.
- Make installing a third-party package an informed decision, and treat an upgrade that asks for more as a new decision.
- Let an organization set guardrails that every project inherits and can't skip.
- Keep the CLI the source of truth. Anything you can do in the UI also works from `halo`.

## Non-goals (for now)

- A visual pipeline editor. `.halo` files stay in git.
- Hosting model inference. Projects use provider keys, or Ollama on runners the organization provides.
- Running on Node-based serverless platforms. The runtime needs Bun.
- A paid marketplace. The registry is free to publish to and install from in the first versions.

## Who it's for

| Role | Wants | Main journeys |
|---|---|---|
| **Builder** | To write `.halo` files and have them run somewhere real, safely | First deploy, ship a change, install a tool, reuse an agent, serve over MCP |
| **Operator / approver** | Healthy pipelines, and quick answers to paused runs | Answer a paused run, debug a failed run, roll back |
| **Publisher** | People to find and trust what they ship | Publish a package or MCP server, publish an agent |
| **Org admin** | Control over what runs, what it costs, and who decided | Review an upgrade, set guardrails |

## Concepts

```
Organization ─┬─ Members and roles
              ├─ Provider connections (model keys)
              ├─ Guardrails (required policies, models, budgets, package trust)
              └─ Project ─┬─ Secrets (per environment)
                          ├─ Stores (vector, KV, file), threads
                          └─ Environment (production | staging | preview-<PR>)
                                └─ Deployment (immutable)
                                      └─ Run ── stages, cost, trace, recording
```

- **Organization.** Billing, members, provider keys, guardrails and the trust list. A personal account is an organization with one member.
- **Project.** One repository (or one folder within one) with a `halo.json`. It owns the pipelines, stores, threads and secrets.
- **Environment.** `production`, `staging` and one `preview-<n>` per open pull request. Each has its own secrets, URLs and state. Previews get fresh, empty stores by default, so they can't write to production state.
- **Deployment.** A content-addressed bundle that never changes: the `.halo` files, `halo.json`, `halo.lock`, the packages it pins, and the `halo plan` output for the bundle. An environment points at one deployment at a time. Promoting or rolling back moves that pointer.
- **Run.** One execution of a pipeline on one deployment. A paused run is tied to the deployment that started it, and resumes on that deployment even after production has moved on.

## What exists today, and what the platform adds

| Today (local or self-hosted) | On Halo Cloud |
|---|---|
| `halo serve`: one Bun process with API, webhooks, schedules, watches, approval links, Slack buttons, `/mcp`, Studio | The same triggers, run by managed workers. Each environment gets stable URLs |
| `FileRunStore`, or your own `RunStore` | A durable run store shared by workers. It implements `take()`, so only one worker resumes a run |
| `VectorStore` in SQLite, or Postgres with `url:` | Hosted pgvector, one namespace per store per environment |
| `KV(path)`, `File(path)` | Hosted key-value and file storage per environment. The local path in the declaration is mapped for you |
| `.env` and environment variables | Write-only secrets per environment, each listed with the declaration or package that reads it |
| `halo validate --strict`, `halo test` | Run on every deployment bundle before it can serve traffic |
| `halo plan` | Run on every deployment, and **compared** with the deployment it would replace |
| `halo replay`, recordings in `.halo/recordings` | Recent production runs replayed against a preview before it's promoted |
| `halo history`, `halo rewind` for `@checkpoint` runs | "Rewind to step N" on any failed run's page |
| `MaxSpend` per run | Plus budgets across runs: monthly, per project and per organization |
| Per-machine trust in `.halo/trust.json` | Per-organization trust list, granted by admins, keyed by checksum |
| A static `registry/index.json` | A hosted registry that serves the same `index.json` format, plus agents, skills and blueprints, org-private packages, review, provenance and evals |

Because the hosted registry keeps the `index.json` format, `halo add`, `halo search` and `halo install` keep working against it unchanged with `--registry`.

## Hosting

### Creating a project

Halo Cloud accepts three sources:

1. **A GitHub repository.** Pushes to the default branch deploy to `staging`, or straight to `production` if the project has no staging. Each pull request gets a preview.
2. **A blueprint.** Halo creates the repository from the blueprint, then treats it as source 1.
3. **`halo deploy` from a folder.** The first run asks which organization and project to link, and writes the link to `.halo/project.json`. That folder is already ignored by `halo init`. `halo deploy` creates a preview, and `halo deploy --prod` deploys and promotes.

Halo detects what the project needs from files that already exist, so there is no new configuration format:

| Source | Detected |
|---|---|
| `halo.json` `files` | Which `.halo` files to load |
| `pipeline` declarations | API endpoints, MCP tool candidates |
| `halo.json` `webhooks`, `schedules`, `watches` | Triggers. Previews don't run schedules or watches unless asked |
| `store` and `tool` declarations | Hosted storage to create |
| `Env.*` in tool declarations and `halo.json` | Required secrets |
| `halo.lock` | Packages, their permissions, and whether any of them runs code |
| `agent` model strings | Which provider connections are needed |

### Secrets

- Each secret belongs to one environment. Values are write-only once saved.
- Each secret shows **what reads it**: a declaration with its file and line (`tool Mail : Email(Env.RESEND_API_KEY, …) · support.halo:35`), a `halo.json` key, or a package's `reads env` list. If nothing reads a secret, it's flagged as unused.
- Provider keys (`ANTHROPIC_API_KEY`, …) are set once per organization and inherited. A project can override one.
- Secrets reach tools only. `Env.*` can already only be read in tool declarations, so the platform injects secrets at the tool boundary and never into the runtime's prompt context. `Redact(APIKey)` still applies to anything a person pastes in.
- Some secrets are generated, such as webhook secrets. A generated secret can be revealed once.

CLI: `halo secrets set NAME --env production`, `halo secrets list`.

### Checks

Every deployment bundle runs these before it can serve traffic. If one fails, the deployment is kept but nothing points at it.

1. `halo validate --strict`
2. `halo test` with the project's mocks, if it has any (`--mocks`, `--body` from `halo.json` or the blueprint's `samples/`)
3. `halo plan` for every pipeline
4. Org guardrails (see [Guardrails](#guardrails))
5. `halo install` against `halo.lock`, with each checksum verified and any code package checked against the org's trust list

### Release: the plan diff

A preview's page compares its plan with what production serves now:

| Row | Example |
|---|---|
| New or removed pipelines | `+ Refund(request: String)`, API only |
| New tool effects | `Pay.create_refund` `external`, guarded by `ApproveTools("Pay.create_refund")` |
| New packages | `stripe@1.0.0`, network `api.stripe.com`, runs no code |
| New secrets | `STRIPE_API_KEY`, **missing in production** |
| Worst-case cost per run, per pipeline | `$0.040 → $0.040`, `— → $0.11` (cap `MaxSpend(0.25)`) |
| Models and agents | `+1 agent: Billing · claude-sonnet-4-5` |
| New approval points | A new `\|! yield`, or new `Approve*` rules |

Each row has a verdict (fine, needs approval, blocks). An organization sets the **promotion rules** that decide the verdicts:

| Rule | Default |
|---|---|
| A secret the new deployment reads is missing in the target environment | Blocks |
| A check failed | Blocks |
| New `external` effect without an `Approve*` policy or a `\|! yield` before it | Needs an owner's approval |
| New `external` effect behind an approval | Needs an owner's approval |
| Worst-case cost per run rises by more than 50% | Needs an owner's approval |
| New package that runs code | Blocks until an admin trusts its checksum |

### Release: replay

Before promotion, the platform replays recent production runs of the pipelines that changed against the preview. By default that's the last 50 completed runs from the past 24 hours. Replays use the answers each run got (`halo replay`, mocked models and tools), so they cost nothing and change nothing.

The result is grouped by outcome: *same*, *different output*, *now pauses*, *now halts*, *now fails*. Each run links to a side-by-side comparison. This catches changes that tests miss, such as a new gate that halts real inputs.

Recordings are unredacted (see [Security](#security)), so replay runs inside the project's own environment, and only maintainers can open the comparisons.

### Promotion and rollback

- Promoting points the environment at the deployment. New runs use it at once.
- Runs paused on the previous deployment resume on that deployment. A deployment stays loadable while any run is paused on it, or for 30 days, whichever is longer.
- Rollback means promoting an earlier deployment. It goes through the same rules, except that it never needs approval for effects that deployment already had in production.
- CLI: `halo promote <deployment> --env production`, `halo rollback --env production`.

### Triggers and endpoints

Each environment gets:

| Endpoint | Example |
|---|---|
| API | `POST https://support-inbox.acme.halolang.com/api/pipelines/HandleEmail/runs` |
| Webhooks | `POST https://support-inbox.acme.halolang.com/hooks/email` |
| MCP | `https://support-inbox.acme.halolang.com/mcp` |
| Studio | `https://support-inbox.acme.halolang.com/`, behind org sign-in |

Previews use `pr-<n>.support-inbox.acme.halolang.com`. Schedules run in the organization's time zone (today they run in the server's local time). Watches poll from the platform. A `command` watch runs in the project's sandbox, the same way a code package does.

## Operating

### Runs

- The runs list can be filtered by pipeline, trigger, status and deployment. Statuses are `completed`, `paused`, `halted`, `failed` and `policy violation`. **Halted is not counted as a failure**, because a `|?` gate stopping a run is intended.
- A run's page shows every stage in order, with its operator (`|>`, `|?`, `|*`, `|!`), its `as` binding, duration, cost and tokens. Calls under a fan-out `|*` are nested beneath it.
- Selecting a stage shows its output, the policies that were checked and what each found (for example `Redact(Email): 1 redaction`), and its error and retries if it failed.
- The header shows whether the trace's SHA-256 chain verifies.
- Actions: **Replay** (mocked), **Replay with live tools**, **Rewind to step N** (for `@checkpoint` runs; this creates a new run that reuses the earlier stages' results), and **Download trace**.

### Approvals

One inbox for every paused run a person can answer:

- `|! yield`: shows `msg` and the context values the pipeline passed to the yield. If the pipeline accepts an edited answer (as the support-inbox blueprint does with `{"approved": true, "reply": "..."}`), the draft is editable in place.
- Tool calls held by `ApproveTools` or `ApproveEffects`: shows the exact call and arguments, the agent's reason for making it, and the policy that held it.
- `~> listen` waits are shown as waiting on an event, with a manual "send event" for testing.

Answering in the inbox, in Slack, or from the signed link all call the same `signal(runId, …)`. Whichever answer arrives first wins, and the other places update to say who answered. Each project can route approvals to a Slack channel or an email address, and to an approver group.

### Alerts

Per project:
- a failure rate above a threshold
- any policy violation
- a run waiting for a person longer than N hours
- a budget passing 80%

Alerts go to Slack, email or a webhook.

## MCP hosting

Every deployment has an `/mcp` endpoint. The project chooses which pipelines it exposes. **None are exposed by default** on Halo Cloud. Today `halo serve` exposes every pipeline unless `mcp: false` is set, so this is a deliberate change for hosted projects.

- A pipeline's arguments become the tool's input schema, and its declared return `schema` becomes the output schema.
- A pipeline that pauses still pauses when it's called over MCP. The client gets back `paused` with a link to the approval, and nothing past the pause happens until a person answers. The page warns about this when such a pipeline is exposed.
- Clients can sign in two ways:
  - **Organization sign-in:** OAuth, following the MCP authorization spec. Runs are recorded under the person who made the call.
  - **API tokens:** for services. Each token is scoped to one project and a set of tools, and can be revoked.
- The page shows the commands to connect Claude Code (`claude mcp add --transport http …`) and Cursor (`.cursor/mcp.json`). It also shows calls per client over the last 7 days.
- **List in registry** publishes the endpoint as an MCP server listing. It's visible to the organization by default, or public.

## The registry

### What it holds

| Kind | What it is | Format |
|---|---|---|
| Tool package | Providers: http (data only), mcp (URL or command), module (code) | `halo-tool.json`, as today |
| MCP server | An mcp provider package, or a hosted project's `/mcp` endpoint | `halo-tool.json`, or a listing created from a project |
| Agent | A namespaced agent preset: system prompt, settings, skills, answer schema, tool requirements, and an eval set | `agents` section in the package manifest (below) |
| Skill | A `SKILL.md` in the Agent Skills format | `skills` section in the package manifest |
| Blueprint | A complete project, deployable with one click | A repository template with `halo.json` and offline tests |

### One manifest for providers, agents and skills

A package can ship any mix of providers, agent presets and skills. This extends `halo-tool.json` (a `halo-package.json` alias could be added later):

```json
{
  "name": "invoice-auditor",
  "version": "2.1.0",
  "publisher": "ledger-labs",
  "providers": {},
  "skills": { "three-way-match": "skills/three-way-match/SKILL.md" },
  "agents": {
    "InvoiceAuditor": {
      "system": "agents/invoice-auditor.md",
      "settings": { "temp": 0.0, "max_steps": 8 },
      "skills": ["three-way-match", "data-extraction"],
      "answers": "schemas/audit.json",
      "needs": [{ "method": "extract" }, { "method": "query", "effect": "read" }],
      "toolRules": "AllowEffects(read)",
      "evals": "evals/invoices.jsonl"
    }
  }
}
```

**Language change:** `preset:` accepts a namespaced name from an installed package, such as `preset: ledger-labs/InvoiceAuditor`. Today it only takes the twelve built-in presets. Validation checks that the agent `equips` tools providing the methods in `needs`.

### Listings

Every listing leads with what the package can reach:
- network hosts
- environment variables it reads
- programs it starts
- whether it runs code

Methods are shown coloured by effect. Then come the install command, a declaration snippet, versions, and provenance.

Agent listings add an **evals table**: pass rate, false alarms, median cost and p50 latency on each model the registry ran. They also list the tools the agent needs and the policies and tool rules it ships with.

**Add to project** opens a pull request that runs `halo add` and updates `halo.lock`. A package is never installed outside git.

### Publishing

```bash
halo pack ./tools/orders-api
halo publish orders-api-1.2.0.halotool            # to registry.halolang.com
halo publish orders-api-1.2.0.halotool --org acme # private to Acme
```

Publishing goes through automated review, and the same checks run in `halo pack --check` so publishers can run them first:

| Check | Fails when |
|---|---|
| Manifest valid | Schema errors, provider name clashes with a built-in |
| Effects declared | Any method has no `effect` |
| Descriptions present | Any method has no description. Agents choose tools by their descriptions |
| Requests stay in scope | An http provider's base URL is templated in ways a model could control |
| Secrets go to the publisher's own hosts | Warns when an env var is sent to a host outside the publisher's verified domains |
| Commands are pinned | An mcp `command` uses `npx -y` without a version, or a Docker image without a digest |
| Agents validate | The preset's declaration doesn't validate, or its prompt mentions tools it doesn't declare (warning) |
| Evals ran | An agent package has no eval set, or it failed to run |

Before publishing, the publisher sees **the listing consumers will see**, including the **permission diff** from the previous version: new hosts, env vars, commands, methods and effects.

**Visibility:**
- **Org-private:** members of the organization can find and install it.
- **Public:** needs a verified publisher (a verified domain or GitHub organization) and a human review of the first version and of any version that adds permissions.

**Provenance:**
- Packages built in CI are signed with the CI provider's OIDC identity, and the listing shows the repository, commit and workflow.
- The checksum is the same sha256 that `halo.lock` pins.
- Unsigned uploads are allowed for org-private packages only.

**Who pays for evals:** see [Open questions](#open-questions).

### Upgrades

An upgrade arrives as a pull request, opened by Halo's own bot or Dependabot. Its page shows:

- The permission diff, version to version.
- **What it means for this project.** For example: "TriageIssues can't call `merge_pull_request`: its agent requires `AllowEffects(read)`."
- Replay of recorded runs that use the package.
- If the package runs code: a trust request, because trust is per checksum.

## Guardrails

Organization settings that projects inherit and can't turn off:

- **Required policies.** Written in Halo:

  ```halo
  policy AcmeBaseline : Block(PromptInjection) & Redact(APIKey)
  ```

  A deployment fails its checks if any agent doesn't require these, either directly or through a policy that includes them.
- **Models.** An allow list by prefix (`anthropic/*`, `openai/gpt-4o`, `ollama/*` on org runners). A deployment that uses another model fails its checks.
- **Budgets across runs.** Monthly, per organization and per project, with an alert at 80%. At 100%, new runs wait for an owner's approval before they start, and runs already going finish. This is a gate before the run starts. It doesn't change `MaxSpend`, which still caps each run.
- **Package trust.**
  - Http packages and MCP-by-URL packages can be added by any maintainer.
  - Packages that run code need an admin to trust their checksum.
  - Allowed publishers are listed, and anyone else needs an admin.
- **Promotion rules.** See [Release: the plan diff](#release-the-plan-diff).
- **Audit log.** Approvals, promotions, trust decisions, secret changes and blocked deploys, kept for one year.

### Roles

| Role | Can |
|---|---|
| Owner | Everything, including billing and deleting the organization |
| Admin | Guardrails, trust, members, provider connections |
| Maintainer | Deploy, promote within the rules, set secrets, add packages, publish org-private packages |
| Approver | Answer approvals for the projects or groups they're assigned to, and view runs |
| Viewer | View projects and runs. Can't see secret values or recordings |

## Journeys

Each journey is walkable in the prototype. "Done when" says what success looks like.

### Builder

**1. Deploy a project for the first time.**
1. Start from a repository, a blueprint, or `halo deploy`.
2. Halo shows what it found: pipelines, triggers, stores, agents and models.
3. Halo lists the required secrets, each with the line that reads it. Provider keys come from the organization.
4. Checks run: validate, offline tests, plan, guardrails.
5. The project is live, with its endpoints and next steps (point the webhook, connect Slack, choose MCP tools).

*Done when* a real webhook produces a run that pauses in the approvals inbox. *Edge cases:* a repository with `.halo` files but no `halo.json` (offer to create one), a pipeline that reads a secret nobody can provide (blocks, and names it).

**2. Ship a change safely.**
1. A pull request opens a preview.
2. The preview page shows the plan diff, checks, replay results, and who must approve.
3. Fix anything that blocks, for example a missing secret.
4. Promote.

*Done when* production serves the new deployment, and the old one is listed with a rollback button. *Edge cases:* a pull request that changes `halo.lock` to add a package that runs code (blocks until an admin trusts it), and approval rules that require someone who isn't available (an admin can override, and it's logged).

**3. Find and install a tool.**
1. Browse by kind.
2. Read the listing's methods and permissions.
3. **Add to project** opens a pull request against `halo.lock`.
4. Set the secret the package reads.

*Done when* the pull request's preview shows the new effects in its plan diff.

**4. Reuse a published agent.**
1. Browse agents.
2. Compare evals across models.
3. Copy the declaration with `preset: publisher/Name`, and equip the tools it needs.

*Done when* `halo validate` passes with the preset's tool requirements met.

**5. Serve pipelines over MCP.**
1. Choose which pipelines to expose.
2. Choose how clients sign in.
3. Copy the connect command.
4. Optionally list the server in the registry.

*Done when* a call from Claude shows up as a run, recorded under the caller's name.

### Operator and approver

**6. Answer a paused run.**
1. Open the inbox, or get to it from Slack.
2. Read the context, and edit the draft if needed.
3. Approve or reject.

*Done when* the run resumes, and Slack shows who answered. *Edge cases:* two people answer at once (the first wins, and the second sees who answered), and a signed link has expired (the inbox still works).

**7. Debug a failed run.**
1. Filter runs to failed.
2. Open the failing stage and read its error, retries and timings.
3. Rewind to that step, or replay with live tools.

*Done when* the rewound run completes without re-running the stages before it.

**8. Roll back a bad deploy.**
1. Pick an earlier deployment.
2. Roll back.
3. Paused runs keep their own deployment.

*Done when* new runs use the earlier deployment, and runs that were paused still resume.

### Publisher

**9. Publish a tool package or MCP server.**
1. Choose the kind and the source.
2. Read the automated review and fix anything that blocks.
3. Read the listing and the permission diff.
4. Set visibility and check provenance.
5. Publish.

*Done when* the listing is live, and existing users see an upgrade with the permission diff.

**10. Publish an agent.** As journey 9, plus eval runs across models during review. The listing shows them.

### Org admin

**11. Review a package upgrade.**
1. Read the permission diff.
2. Read what it means for each project that uses the package.
3. If it runs code, trust the checksum.
4. Merge.

*Done when* the next deploy uses the new version, and the trust decision is in the audit log.

**12. Set guardrails.**
1. Write the required policies.
2. Set the model allow list.
3. Set budgets.
4. Set package trust rules.
5. Connect provider keys once for the organization.

*Done when* a project that doesn't comply fails its checks, and the failure names the rule.

## Screens

These are the screens in the prototype. Its hash names are in brackets.

| Screen | Purpose |
|---|---|
| Journey map (`journeys`) | The object model and the 12 journeys, grouped by role |
| Overview (`home`) | Runs, spend against budget, approvals waiting, failures, projects, activity |
| New project (`new`) | Source → what Halo found → secrets → checks → live |
| Project (`project`) | Environments, pipelines with their triggers and outcomes, deployments with rollback, endpoints, stores |
| Preview / deployment (`deploy`) | Plan diff, replay results, checks, who must approve, promote |
| Runs (`runs`), Run (`run`) | Filterable list; stage timeline with output, policies, errors, rewind and replay |
| Approvals (`approvals`) | The inbox, with editable drafts and tool call arguments |
| Registry (`registry`) | Browse by kind, with permissions on every card |
| Package (`package`) | Methods by effect, permissions, versions, provenance, install |
| Agent (`agent`) | Declaration, evals across models, what it needs, what it ships with |
| Publish (`publish`) | Kind and source → review → listing and diff → visibility and provenance |
| Upgrade (`upgrade`) | Permission diff, what it means for each project, trust request |
| MCP server (`mcp`) | Tools to expose, sign-in, connect commands, calls by client |
| Guardrails (`governance`) | Required policies, budgets, models, package trust, audit log |
| Secrets and models (`secrets`) | Per-environment secrets with what reads them, provider connections |

## CLI additions

```bash
halo login
halo deploy [--prod]                          # preview, or deploy and promote
halo promote <deployment> --env production
halo rollback --env production
halo logs [--pipeline Name] [--follow]
halo runs [--status failed]                   # remote runs; halo history and halo rewind take remote run ids
halo approvals                                # list; answer with halo resume <runId> --payload ...
halo secrets set NAME --env production | list | rm NAME
halo publish <file> [--org acme]              # the default registry becomes registry.halolang.com
halo pack --check                             # the registry's review, locally
```

Existing commands keep working offline and locally. The default for `halo add` changes from the bundled `registry/index.json` to the hosted registry. The bundled index stays as a fallback when there's no network.

## Runtime and infrastructure work

The runtime is mostly ready. The platform needs these changes:

1. **A shared run store.** A `RunStore` over Postgres that implements `take()`, so that when several workers try to resume the same run, only one does. The interface already supports this.
2. **Paused runs tied to their deployment.** Store the deployment id in `RunSnapshot`, and load that deployment's bundle when the run resumes.
3. **Storage mapping.** Resolve `KV(path)`, `File(path)` and SQLite-backed `VectorStore` to hosted storage per environment, without changing the declarations.
4. **Out-of-process code packages.** Today a `module` package runs inside Halo's process, with every environment variable. Hosted, it must run in a sandbox with only the env its manifest lists and a network allow list. Stdio MCP commands and `command` watches run there too.
5. **Secret injection at the tool boundary.** Resolve `Env.*` from the secret store when a tool is built, not from `process.env`.
6. **Namespaced presets.** `preset: publisher/Name`, resolved from installed packages, plus validation of the preset's `needs`.
7. **Plan diff.** A structured `halo plan --json`, and a `halo plan --diff <old-bundle>` that both the CLI and the platform use.
8. **Replay in bulk.** `halo replay` across a set of recordings, grouping outcomes.
9. **A budget gate.** A hook before a run starts that can hold it for approval.

## Security

- **Recordings are unredacted** (as `.halo/recordings` is today), because replay needs real inputs. Hosted recordings are encrypted per project, kept for 14 days by default, and readable only by maintainers. Viewers and approvers see redacted run pages.
- **Trust is per organization, and per checksum.** A pull request can't grant trust, just as it can't today with `.halo/trust.json`.
- **Approval links are signed and expire** (7 days by default). Answering one requires signing in if the organization requires it.
- **Previews never get production secrets or production state.** A preview can be given staging secrets.
- **Registry checksums don't protect against a malicious publisher.** Provenance, verified publishers, human review of permission increases, and per-version trust are the protections.
- **MCP callers are people, not the platform.** With organization sign-in, the run is attributed to the caller and their role is checked.

## Phases

| Phase | Ships | Journeys |
|---|---|---|
| 1. Hosting | Projects from GitHub or `halo deploy`, production and previews, secrets, checks, runs, approvals, rollback, MCP | 1, 2, 5, 6, 7, 8 |
| 2. Registry | The hosted index, listings with permissions, publishing with review and provenance, org-private packages, upgrade pull requests with the permission diff | 3, 9, 11 |
| 3. Guardrails and agents | Required policies, model lists, budgets across runs, audit log, agent packages with evals, namespaced presets | 4, 10, 12 |

Plan diff and replay ship in phase 1. They make the platform more than a place to run `halo serve`.

## Open questions

1. **Who pays for evals?** Running an agent's eval set on several models costs money on each release. Options: the publisher's provider keys, a free quota, or only models the publisher chooses.
2. **Self-hosting.** Should the platform's control plane (checks, plan diff, replay, approvals inbox) be open source, so a team can run it next to `halo serve` without Halo Cloud?
3. **Previews and external effects.** Should previews stub `external` tools by default, so a preview can't send email or move money even with staging keys?
4. **How long deployments stay loadable** while runs are paused on them. Thirty days covers approvals, but `~> listen` waits can be longer.
5. **Public review capacity.** A human review of every permission increase on public packages may not scale. Do we review only packages above an install threshold?
6. **Pricing.** Per run, per compute-second, or per seat. This proposal doesn't set it.
