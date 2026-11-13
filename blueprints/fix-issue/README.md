# Fix an issue

A Halo blueprint: a complete, deployable app, not a snippet. Someone labels a GitHub issue `halo-fix`. A coding agent fixes it on a copy of your repository in a sandbox and runs the tests there. A person reads the diff, and only on a yes does it become a branch, a commit and a pull request.

```
issue labeled "halo-fix" ─▸ POST /hooks/github ─▸ OnIssueEvent ─▸ FixIssue
  ├─ read the issue; bring repo/ up to date with GitHub
  ├─ the Dev agent fixes it on a copy of repo/ in a sandbox   (Docker, E2B or Daytona)
  ├─ the pipeline runs the tests itself; a red run goes back to Dev, twice at most
  ├─ ‖ a person reads the diff and approves or rejects it      (approval link, Slack, or Studio)
  ├─ yes: write it to repo/, branch halo/issue-<n>, commit, push, open the PR
  └─ no:  leave a comment on the issue
```

| File | What it is |
|---|---|
| `pipelines/fix.halo` | The workflow: `OnIssueEvent` (the webhook) and `FixIssue` (one issue) |
| `halo.json` | The service: the GitHub webhook, Slack notices |
| `samples/` | A webhook body, and canned answers for offline tests: `mocks.json` (approved) and `mocks-reject.json` (rejected) |
| `Dockerfile`, `fly.toml` | Deployment, with E2B sandboxes (see [Where the sandbox runs](#where-the-sandbox-runs)) |
| `.env.example` | Every key it needs, and where to get it |

What keeps it safe:

- **The agent can't touch your repository.** It works on a copy in a sandbox that has none of your secrets. `StayInside` takes `Repo.apply` and `Repo.download` away from it, so the only way a change leaves the sandbox is the pipeline's `Repo.apply()`, after the `|! yield`.
- **The tests decide, not the model.** After the agent says it's done, the pipeline runs `npm test` in the same sandbox. A failing run goes back to the agent with the output; if it still fails after two more tries, the run fails and nobody is asked to review a red build.
- **The diff is measured from the files.** `Repo.diff()` compares the sandbox's files with the ones it was given, so the reviewer sees what actually changed, not what the agent says it changed.
- **Issues are written by strangers.** `Untrusted` blocks injection attempts in the issue before the agent reads it, and the agent's system prompt says the issue is a bug report, not instructions. Only the `halo-fix` label starts a run, so only people who can label issues can spend money; `MaxSpend(2.00)` caps one issue.
- **The token stays on the server.** `GITHUB_TOKEN` reads the issue, pushes the branch and opens the PR from the pipeline. The sandbox gets `repo/`'s tracked files, never `.git` or the environment.

## 1. Try it offline (no keys)

```bash
halo test pipelines/fix.halo -p FixIssue --arg number=42 --mocks samples/mocks.json
halo test pipelines/fix.halo -p FixIssue --arg number=42 --mocks samples/mocks-reject.json
halo test pipelines/fix.halo -p OnIssueEvent --body samples/issue-labeled.json --mocks samples/mocks.json
```

The first ends with the pull request (`{ "number": 43, "url": ... }`). The second stops at the review and comments on the issue instead (the run ends as `halted`). The third is what the webhook does with GitHub's `issues` event. Use `halo debug` in place of `halo test` to see every step.

## 2. Run it for real, locally

You need Docker running (or `E2B_API_KEY`), a model key, and a GitHub token for the repository.

```bash
cp .env.example .env     # ANTHROPIC_API_KEY, GITHUB_REPO, GITHUB_TOKEN
git clone https://github.com/<owner>/<name>.git repo
halo run pipelines/fix.halo -p FixIssue --arg number=<an issue number>
```

`repo/` is the clone the sandbox copies from and the pull request is pushed from; it uses your own git credentials here. The first Docker run pulls `node:22`, which takes a minute. Halo shows the agent's summary, the test output and the diff, and asks you: answer `approve`, `reject`, or `{"approved": false, "reason": "..."}` to put a reason in the issue comment.

Then run the service:

```bash
halo serve
```

Open http://127.0.0.1:8080 (Halo Studio) to see runs waiting for review, read the diff, and approve or reject it.

## 3. Connect GitHub

In the repository's **Settings → Webhooks**, add a webhook:

- **Payload URL:** `https://<your server>/hooks/github`
- **Content type:** `application/json`
- **Secret:** your `GITHUB_WEBHOOK_SECRET` (GitHub signs each delivery with it, and Halo checks `x-hub-signature-256`)
- **Events:** *Let me select individual events* → **Issues**

Then create a `halo-fix` label. Labelling an issue with it starts a fix; other issue events end straight away (as `halted`) without a model call. To start from something else, such as a slash command in a comment, change the gate in `OnIssueEvent`.

## 4. Where the sandbox runs

`Remote("auto")` is a Docker container when Docker is running where Halo runs, otherwise an E2B sandbox (`E2B_API_KEY`), otherwise a Daytona one (`DAYTONA_API_KEY`). The two differ in one way that matters here:

| | Docker | E2B / Daytona |
|---|---|---|
| Where | a laptop, a VM, a CI runner | anywhere, including Fly, Render and Railway |
| Allowed hosts (`hosts:`) | yes: the sandbox reaches only the hosts you list | no |
| A review that waits | the sandbox is saved and stopped while the run pauses | the sandbox stays up for `ttl_minutes`, then it's gone |

**This blueprint deploys to Fly with E2B**, because Fly machines (like Render and Railway) have no Docker. That means the agent's sandbox has the open internet: it can install packages, and in principle it could send your code somewhere. Halo won't pretend otherwise: `hosts:` on a sandbox that lands on E2B or Daytona fails the run rather than running without the allowlist, which is why `pipelines/fix.halo` leaves it out.

If your code shouldn't leave your machines, run Halo where Docker is, and add the allowlist. On a VM or a self-hosted CI runner with Docker, add `hosts:` to the `Repo` tool (the line is in the file, commented out):

```halo
tool Repo : Remote("auto", from: "repo", image: "node:22", ttl_minutes: 1440,
                   hosts: ["registry.npmjs.org", "pypi.org", "*.pythonhosted.org", "github.com", "codeload.github.com"])
```

and run `halo serve` there directly (not in this image: it has no Docker, and giving a container the host's Docker socket gives it the host). A refused connection shows up in the test output (`blocked: ["evil.example"]`) and in the run's `context.meta.violations`.

**Approve within the sandbox's lifetime.** `Repo.apply()` reads the changed files from the sandbox, so with E2B the review has to happen before `ttl_minutes` (24 hours here; E2B's own plan limit may be shorter). A Docker sandbox is saved when the run pauses and started again on approval, so it has no such limit. If a review comes too late, the run fails at `Repo.apply`; label the issue again to start over.

## 5. Deploy

Halo needs a host that runs a long-lived process with a disk: paused runs (diffs waiting for review) are kept in `.halo/`. Serverless functions and Cloudflare Workers can't run it.

**Fly.io**

```bash
fly launch --copy-config --no-deploy        # pick a name, then set it in fly.toml's HALO_PUBLIC_URL
fly volumes create halo_state --size 1
fly secrets set ANTHROPIC_API_KEY=... E2B_API_KEY=... GITHUB_REPO=owner/name GITHUB_TOKEN=... \
  GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 24) HALO_SERVE_TOKEN=$(openssl rand -hex 24)
fly deploy
```

**Anywhere else that runs a container** (Render, Railway, a VM): build the `Dockerfile`, mount a volume at `/app/.halo`, set the variables from `.env.example`, and expose port 8080. The container clones `GITHUB_REPO` into `repo/` when it starts, with `GITHUB_TOKEN` (git reads it from the environment; it isn't written to disk), and `FixIssue` fetches before every run. The image validates the pipelines while it builds, so a broken file fails the deploy instead of the first issue. `GET /healthz` answers health checks without the token.

On the internet, `HALO_SERVE_TOKEN` protects the API, MCP and Studio (send it as `Authorization: Bearer ...`). The webhook checks GitHub's signature, and approval links carry their own signature, so neither needs the token. Set `SLACK_WEBHOOK_URL` to have each diff waiting for review posted to Slack with its approval link.

## Make it yours

- **The test command:** the pipeline runs `npm test` (step 4 in `pipelines/fix.halo`), in `node:22` on Docker. For another stack, change the command and `image:` (`python:3.12-slim` with `pytest -q`, say), or build an image with your toolchain and dependencies already in it, so the agent doesn't spend its first minutes installing them. On E2B, `template:` names your own template.
- **The agent's rules:** `Dev`'s system prompt says what it may not touch. Add your own (generated files, migrations, the public API).
- **Model and budget:** swap `anthropic/claude-sonnet-4-5` for any provider Halo supports. `MaxSpend(2.00)` is per issue, across every try; `halo plan pipelines/fix.halo` shows every call.
- **Try more than once:** run three attempts in forked Docker sandboxes and keep the best one; see the [Best of N](https://github.com/cmjio/halo/blob/main/docs/guide/best-of-n.md) guide.

## What it doesn't do yet

- One review at a time. Runs share `repo/`, so two approvals landing in the same few seconds can trip over each other. A run that fails part-way through leaves `repo/` on its branch; the next run resets it to GitHub's default branch.
- Labelling the same issue again reuses its branch (`halo/issue-<n>`, force-pushed). If a pull request for it is already open, opening another fails; the new commit is on the branch and the open PR shows it.
- The agent sees the issue's title and body, not its comments or linked issues.
