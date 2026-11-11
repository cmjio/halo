# Schedules you can rely on

| | |
|---|---|
| Status | Draft proposal. Step 1 of the rollout (firing correctness) is built; the rest isn't. |
| Date | 11 November 2026 |
| Builds on | `halo serve` schedules (`src/serve/cron.ts`, `src/serve/server.ts`), directives, `halo plan`, `halo compare`, the `halo evolve` fence |

This lives outside `docs/` because everything under `docs/` is published to halolang.com.

## Summary

`halo serve` already runs pipelines on a cron schedule from `halo.json`. That works for a demo. It doesn't hold up for the jobs the examples describe: "every 15 minutes" (HVAC optimizer), "02:00 nightly, no buyer awake" (warehouse reorder), a daily digest. Those pipelines run with nobody watching, so the scheduler is the only thing that notices when something goes wrong.

This proposal does three things:

1. **Declares the schedule next to the pipeline** with a `@schedule` directive. Then `validate`, `plan`, `compare` and `evolve` can see it. `halo.json` stays the place to override it for each deployment.
2. **Makes firing correct.** It adds time zones, defined DST behaviour, state that survives a restart, catch-up for missed runs, and an overlap rule.
3. **Tells the run why it started.** It adds `context.trigger`, so a digest can say "since the last run" instead of hard-coding `days: 1`. Scheduled runs that fail are announced, not just logged.

## What exists today

- `halo.json` → `schedules: [{ pipeline, cron, args }]`. A standard 5-field cron in the server's local time.
- A timer fires at the top of each minute. `tick()` starts every schedule that matches. It skips a schedule only when `s.last` already equals the current minute string, and that string is kept in memory.
- `GET /api/pipelines` lists each pipeline's schedules and next run. The CLI banner prints them.
- Tests call `tick(date)` directly, with `scheduler: false`.

### Gaps

| Gap | Effect |
|---|---|
| Local time only | A server in UTC fires `0 9 * * 1-5` at 9:00 UTC. Containers are almost always UTC |
| DST isn't defined | Spring forward: a `30 2 * * *` job is silently skipped. Fall back: whether it runs twice depends on whether `last` was overwritten in between |
| `last` lives only in memory | A restart during the firing minute can run the job twice. A server that's down at 02:00 never runs the 02:00 job, and nothing records that it was missed |
| No overlap rule | A `*/15` run that takes 20 minutes overlaps the next one. A nightly run paused at `\|! yield` gets a second copy the next night, and then a third |
| Schedule is separate from the pipeline | `halo compare` can't see that a change makes a pipeline run 96 times a day instead of once. `halo plan` can't put a monthly cost on it. `evolve` could in principle reach it through config |
| Run doesn't know it was scheduled | Pipelines hard-code windows (`days: 1`). After a missed or late run, that window leaves gaps or overlaps |
| Failures are only logged | `notify.slack` announces paused runs only. A scheduled job that fails every night stays quiet |

## Design

### 1. `@schedule` directive

```halo
@schedule("0 2 * * *", tz: "America/Los_Angeles")
pipeline NightlyReorder() -> Result:
  ...

@schedule(every: 15m, overlap: skip)
pipeline OptimizeHVAC(campus: String) -> Result:
  ...

@schedule("30 8 * * mon-fri", tz: "Europe/London", repo: "acme/api", limit: 20)
pipeline TriageIssues(repo: String, limit: Number) -> Result:
  ...
```

- The first positional argument is a cron expression in the same 5-field syntax as today. Alternatively, `every: <duration>` gives a fixed interval. It is anchored to the Unix epoch, so `15m` fires at :00, :15, :30, :45 and doesn't drift with restarts. The minimum is `1m`.
- **Option arguments** (reserved names): `tz`, `overlap`, `catchup`, `jitter`. Each is described below.
- **Every other named argument is a pipeline argument.** The validator requires each one to match a parameter, and requires every parameter to be covered, either here or by `halo.json` (see 2). A parameter that collides with a reserved option name must be set in `halo.json`.
- A pipeline can have more than one `@schedule`, for example a different time on weekends.
- `halo run`, `halo test`, `halo mcp` and the API ignore the directive. It only adds a trigger to `halo serve`.

**Grammar change.** `directiveArg` becomes `(IDENTIFIER ':')? (literal | MODEL_REF | dottedId)`. `literal` already covers durations like `15m`. `Directive.args` gains a `named` map. This also gives other directives room for named options later (for example `@retry(3, 2s, on: RateLimit)`).

### 2. `halo.json` overrides

The existing `schedules` array stays and keeps working unchanged. It gains the same options:

```json
{
  "timezone": "Europe/London",
  "schedules": [
    { "pipeline": "TriageIssues", "cron": "0 9 * * 1-5", "args": { "repo": "acme/api", "limit": 10 } },
    { "pipeline": "OptimizeHVAC", "args": { "campus": "lakeside" } },
    { "pipeline": "NightlyReorder", "enabled": false }
  ]
}
```

- An entry with **no `cron`/`every`** applies to the pipeline's `@schedule`s. It supplies `args`, or overrides `tz`/`overlap`/`catchup`, or turns them off with `"enabled": false` (for a staging or preview deployment).
- An entry **with** `cron`/`every` adds a schedule, as it does today.
- The top-level `timezone` is the default for every schedule. Without it, schedules use the server's local time, as they do today, and the startup banner names the zone in use.
- `halo serve --no-schedules` turns off every schedule and watch. It replaces the test-only `scheduler: false`, which stays as an option.

Rule: **the `.halo` file says what the pipeline is for, and `halo.json` says where it runs.** Cron and pipeline arguments can live in either place. A deployment can always turn a schedule off.

### 3. Firing semantics

Each schedule has a **slot**: the instant it is due, computed in its time zone. Firing is keyed by slot, not by a wall-clock string.

**Time zones.** `tz` is an IANA name, checked with `Intl.supportedValuesOf("timeZone")` at validate time. `cronMatches` changes to take wall-clock fields (minute, hour, day, month, weekday) produced by `Intl.DateTimeFormat` for the zone, not a `Date` read in local time.

**DST.** The behaviour matches Vixie cron for fixed-time jobs:
- Spring forward: a time that doesn't exist (02:30 on the change day) fires once, in the first minute after the jump (03:00).
- Fall back: a time that occurs twice fires once, on the first occurrence.
- `every:` schedules count real elapsed time and ignore DST.

**State.** `<stateDir>/schedules.json` holds, for each schedule key (`pipeline + cron|every + tz`): `lastSlot`, `lastRunId`, `lastStatus`, `lastStartedAt`, and the number of `skipped` and `missed` slots. It is written before the run starts. A restart in the same minute therefore sees that the slot was taken and doesn't fire again.

**Catch-up** (`catchup:`, default `1h`). At startup, and after any gap of more than 90 seconds between ticks (a laptop that slept, for example), the scheduler finds the most recent slot after `lastSlot`.
- If that slot is within the `catchup` window, it fires **once**, late. `context.trigger.late` says by how much.
- Older slots are counted as `missed` and logged. They are never replayed one by one, because a server that was down for a week shouldn't start 672 HVAC runs.
- `catchup: none` turns this off. `catchup: 24h` suits a nightly job that must run at least once.
- A schedule seen for the first time has no `lastSlot`, so it doesn't catch up. Adding a schedule doesn't immediately fire it.

**Overlap** (`overlap:`, default `skip`). A schedule's run is *active* while it is running **or paused**. The scheduler checks this with `lastRunId`: the run is still in flight, or the run store still holds its snapshot, so this works across restarts with `FileRunStore`.
- `skip` (default): the slot is not run and is counted in `skipped`. If the reason is a paused run, the paused-run notice is sent again. Someone is sitting on an approval that is now blocking the schedule.
- `allow`: start it anyway, as today.
- There is no `queue` option on purpose. Queued slots pile up behind a stuck run and then all fire at once.

**Jitter** (`jitter: 2m`, default none). A random delay within the window, fixed per schedule key so it is stable across restarts. It spreads `0 * * * *` jobs that all call the same API.

**One scheduler per state folder.** `halo serve` takes `<stateDir>/scheduler.lock` (pid + heartbeat). A second process on the same folder serves the API but doesn't fire schedules, and says so at startup. It takes over if the heartbeat goes stale. Coordinating across machines is Halo Cloud's job (see `halo-cloud.md`), not this proposal's.

### 4. `context.trigger`

Every run gets a `context.trigger` that says how it started. It is set by whatever starts the run. A plain `runtime.run()` call gets `{ kind: "api" }`.

```
context.trigger = {
  kind: "schedule",            // | "api" | "webhook" | "watch" | "cli" | "mcp" | "resume"
  schedule: "0 2 * * * America/Los_Angeles",
  at: "2026-11-12T10:00:00Z",  // the slot
  previous: "2026-11-11T10:00:00Z",  // the last slot whose run completed, or null
  late: 0                      // ms between the slot and the start (catch-up, jitter, a slow tick)
}
```

`previous` is what digests and "since last time" jobs need:

```halo
@schedule("30 8 * * *", tz: "Europe/London")
pipeline DailyDigest(root: String) -> Result:
  root
    |> Git.log(since: context.trigger.previous) as commits
    |> Writer.summarize("What changed since the last digest?")
```

`previous` advances only when a run **completes**. After a failed run, the next one covers both windows, so the digest has no gap. Webhooks, watches and the API set `kind`, plus `path` or `source` where it applies. The validator learns that `context.trigger.*` exists.

### 5. Hearing about scheduled runs

Nobody watches a scheduled run, so `notify` grows:

```json
"notify": { "slack": "Env.SLACK_WEBHOOK_URL", "on": ["paused", "failed", "missed"] }
```

- `paused` is today's behaviour, and stays the default.
- When `on` isn't set and the server has schedules, the default becomes `["paused", "failed"]`, but only for runs a schedule started. A run started through the API already has a caller who sees its result.
- `missed` is sent once per catch-up check that finds missed slots, never once per slot.
- `halted` (a gate stopped the run) isn't included by default. Halting is usually the pipeline working as intended ("nothing to reorder tonight").

### 6. Tooling

| Command | Change |
|---|---|
| `halo validate` | Checks the cron or `every`, `tz`, the option values, and that the arguments cover the parameters (a warning when `halo.json` might cover them, an error with `--strict` and no `halo.json` entry) |
| `halo plan` | Shows each schedule with its runs per month, and **worst-case cost per month** (worst-case cost per run × runs). The 96-a-day HVAC job then shows its real price |
| `halo compare` | Reports schedules that were added or removed, and changes in runs per month, as capability changes, in the same section as new tools and effects |
| `halo evolve` | The fence rejects any rewrite that adds a `@schedule`, removes one, or changes one |
| `halo schedules [files]` | New. Lists every schedule after `halo.json` is merged in, with its zone, the next 5 slots, and `lastStatus`/`skipped`/`missed` from the state folder. `--at <time>` shows the slots from that time onward, for checking DST |
| `halo run --trigger schedule --at <time>` | Fills in `context.trigger` as the scheduler would, so a scheduled pipeline can be tested with `halo test` |
| `halo serve` banner | Adds the zone and any catch-up it did at startup: `Schedule 0 2 * * * America/Los_Angeles → NightlyReorder (next ...; caught up 02:00, 41m late)` |
| Studio | The pipeline view shows the schedule state: next slot, last run with its status, and skipped and missed counts. It gets a pause/resume toggle (`POST /api/schedules/<key>/pause`, which writes `paused: true` to `schedules.json` and survives restarts) |

## Compatibility

- Existing `halo.json` `schedules` entries behave as they do today, with three exceptions: catch-up (`1h`), overlap (`skip`) and state in `schedules.json`. The first two are behaviour changes, so the release notes should mention them. Setting `"catchup": "none", "overlap": "allow"` on an entry restores the old behaviour exactly.
- `cronMatches(cron, date)` stays exported. The new path is `cronMatchesIn(cron, fields)` plus a `slotsBetween(schedule, from, to)` helper that catch-up and `halo schedules` share.
- `HaloServer.tick(now)` stays, so the tests don't change shape.

## Non-goals

- Second-level precision, and schedules faster than once a minute (use a watch, or a loop inside the pipeline).
- Holiday or business calendars. A gate at the start of the pipeline handles "not on bank holidays" more clearly than a calendar does.
- Coordinating schedules across machines (see Halo Cloud).
- Replaying every missed slot.

## Rollout

1. **Firing correctness, no new syntax.** Adds `timezone`/`tz`, slot keys, DST rules, `schedules.json`, catch-up, overlap and the scheduler lock, all in `halo.json`. Tests drive `tick()` across a spring-forward and a fall-back day, a restart within the firing minute, a server down at the slot, and a paused run during the next slot.
2. **`context.trigger`** for every trigger kind, plus `notify.on`.
3. **`@schedule`**: the grammar change for named directive arguments, the validator, merging with `halo.json`, and `halo schedules`.
4. **Tooling.** Adds runs per month and monthly cost to `plan`, schedule changes to `compare`, the `evolve` fence rule, and the Studio state and pause toggle.

Each step ships on its own. Step 1 is worth shipping even if the rest is never built.

## Open questions

1. **Arguments in the directive, or only in `halo.json`?** Named arguments in `@schedule` are convenient, but they mix option names with parameter names. The alternative is a schedule-only `@schedule` plus parameter defaults in the language (`limit: Number = 20`), which would also help the CLI and the API. It's a bigger change, and arguably the better one.
2. **Default `catchup`.** `1h` covers restarts and short outages without surprising anyone. `none` is safer for jobs that cost a lot or touch the outside world. Should the default depend on the plan's effects (`none` when the pipeline has `write`/`external` effects)?
3. **Should a paused run block its schedule by default?** `skip` stops a job from piling up behind an approval nobody answered. It also means one ignored approval quietly stops a nightly job. The resent notice is meant to make that visible. Is that enough?
