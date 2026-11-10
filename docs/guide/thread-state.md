# Thread State

A run's `context` ends with the run. Thread state is what a pipeline keeps from one run to the next: a chat's recent messages, a ticket's notes, what an assistant knows about a user. Mark the pipeline with `@thread`, naming the input that says which thread a run belongs to:

```halo
agent Assistant [anthropic/claude-sonnet-4-5]

@thread(user_id)
pipeline Chat(user_id: String, msg: String) -> Result:
  msg
    |> Assistant.reply("Recent messages: {{context.thread.messages}}\nThey say: {{msg}}") as reply
    |> Thread.append(messages: ["user: {{msg}}", "assistant: {{reply}}"], keep: 20)
    |> System.Value(context.data.reply)
```

Every run with `user_id: "ana"` shares one thread, and `user_id: "bo"` has another. The full example is [77: Thread state](/examples/thread-state).

## Reading and changing it

`context.thread` is the thread's state: an object of fields, empty for a new thread. Use it anywhere you'd use `context.data`: in prompts (`{{context.thread.summary}}`), arguments, gates and branches.

Three built-in calls change it. Each passes the flowing value through unchanged, and none is stored in `context.data`:

| Call | Does |
|---|---|
| `Thread.set(summary: context.data.summary, stage: "booked")` | Sets fields |
| `Thread.append(messages: context.data.reply, keep: 20)` | Adds the value to the end of a list field (making one if needed). `keep: n` keeps only the newest n items |
| `Thread.clear("draft")`, `Thread.clear()` | Removes the named fields, or every field |

Each call changes `context.thread` right away, so later stages of the run see it.

## When changes are saved

A run keeps its changes as a list of operations and saves them when it ends:

- **Completed or halted** at a gate: saved.
- **Failed**: nothing is saved. A thread never holds half of a failed run.
- **Paused** at `|! yield` or `~> listen`: nothing is saved until the run is resumed and ends. Other runs on the thread don't see its changes in the meantime.

Saving applies the operations to the thread **as it is when the run ends**, in one transaction, not to the copy the run loaded. So two runs on one thread at the same time (two messages sent quickly, two workers) don't lose each other's changes: both `Thread.append`s land in the list. `Thread.set` and `Thread.clear` take effect in the order the runs end, so the run that ends last wins for a field both set.

## Naming and sharing threads

`@thread(user_id)` names the thread after the pipeline, so `Chat`'s threads are `Chat` threads. To share threads between pipelines, give them the same name:

```halo
@thread(ticket_id, Support)
pipeline OpenTicket(ticket_id: String, text: String) -> Result: ...

@thread(ticket_id, Support)
pipeline CloseTicket(ticket_id: String) -> Result: ...
```

A pipeline that a `@thread` pipeline calls uses the caller's thread: its `Thread.*` calls and `context.thread` are the caller's. `@thread` on a pipeline that is only ever called does nothing.

The key input must be a non-empty string or number, or the run fails before its first stage.

## Inspecting and resetting threads

Threads are kept in `.halo/threads.sqlite` (`threadPath` in `RuntimeConfig`), with a log of every save: which run, which version, what it did.

```bash
halo threads                  # every thread: name, key, version, runs, fields
halo thread Chat ana          # its state, and the saves that changed it, newest first
halo thread Chat ana --json
```

```bash
halo thread Chat ana --reset --yes
```

`--reset` deletes the thread's state. The next run starts a fresh thread. Without `--yes` it says what it would delete and stops. The log is kept, with a `reset` line, so the thread's history still shows what happened.

Runs with `--mock` (and `halo test`) keep threads in memory, so trying a pipeline never changes a real thread.

## With checkpoints and rewind

With `@checkpoint`, a run's thread view (what it loaded, and its operations so far) is part of every snapshot and step. [`halo rewind`](/guide/plan-and-replay#halo-rewind) gives the new run the thread as the old run saw it at that step. If the old run had already saved its changes, the new run saves only the changes it makes after the step, so nothing is applied twice.

## Thread state or a store?

Use thread state for what a pipeline itself reads and updates between runs, keyed by an input. Use a [`store`](/examples/08-store) (`KV`, `File`, `VectorStore`) when an agent should choose what to look up or save, or for searching across many records.

A tool or store you declare named `Thread` takes the name over: `Thread.*` then calls your tool, as it did before thread state existed.
