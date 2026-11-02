# Pipe Operators

Each operator adds one stage to a pipeline. Any stage that produces a value can end with `as name`, which stores the value at `context.data.name`.

## Pipe `|>`

Calls an agent, tool, `System` method, or pipeline. The call's result becomes the flowing value (`context.current`).

```halo
agent Writer [openai/gpt-4o-mini]

pipeline Draft(topic: String) -> Result:
  topic
    |> Writer.outline("Outline an article about {{topic}}.") as outline
    |> Writer.draft(context.data.outline)
    |> System.Print()
```

A tool call with no positional arguments receives the flowing value as its first argument. For agent calls, see [Calls](../guide/reference.md#calls).

## Gate `|? (cond)`

If the condition is false, the run stops. Its status is `"halted"` and `context.meta.halted` records the stage and condition. A halt is not an error. A trailing `=>` is allowed: `|? (cond) =>`.

```halo
agent Scorer [openai/gpt-4o-mini]

pipeline Review(doc: String) -> Result:
  doc
    |> Scorer.score("""Reply with JSON: {"score": <0-100>}""") as review
    |? (context.data.review.score >= 70 && context.data.review.score <= 100)
    |> System.Print("Passed")
```

Comparisons are loose. `==` and `!=` compare numbers numerically and everything else as text. `<`, `<=`, `>`, and `>=` are false if either side isn't a number. Missing values are `null`. A value on its own is truthy unless it is `false`, `null`, `0`, `""`, `"false"`, or an empty list.

## Branch `|? { … }`

Runs the call in the first arm whose condition holds. `else` must come last. If no arm matches, the value passes through unchanged.

```halo
agent Engineer [openai/gpt-4o-mini]
agent Support  [openai/gpt-4o-mini]

pipeline Route(ticket: String, kind: String) -> Result:
  ticket
    |? {
         (kind == "bug") => Engineer.fix(ticket),
         (kind == "billing") => Support.refund(ticket),
         else => Support.reply(ticket),
       } as handled
```

Each arm is a single call. To run several stages in an arm, call a pipeline.

## Fan-out `|* { … }`

Runs the calls in parallel on the same input. The result is a list in the same order. Each call's result is also stored at its usual places, and per-call `as` bindings work. A bare agent name is shorthand for `Agent.prompt()`, and a bare pipeline name calls that pipeline.

```halo
agent Optimist  [openai/gpt-4o-mini]
agent Skeptic   [anthropic/claude-haiku-4-5]
agent Moderator [openai/gpt-4o-mini]

pipeline Debate(claim: String) -> Result:
  claim
    |* { Optimist.argue_for(), Skeptic.argue_against() as against, Moderator } as views
    |> Moderator.summarize(context.data.views)
```

## Each `|* each(item in list) => Call()`

Calls once per item of a list, at most `concurrency` at a time (default 4). Inside the call, the item is available by its name and as the flowing value, and `index` is its position. The result is the list of results.

```halo
agent Summarizer [openai/gpt-4o-mini]

pipeline SummarizeAll(docs: List) -> Result:
  docs
    |* each(doc in docs, concurrency: 2) => Summarizer.summarize("Summarize document {{index}}: {{doc}}") as summaries
```

## Yield `|! yield(...)`

Asks a human. The response is stored at `context.data.yield` and in the `as` binding, and the flowing value continues unchanged.

The arguments:

- `msg:`/`message:` or a positional string is the message
- `channel:`/`queue:` or a tool name says where to ask
- list arguments are attachments
- a duration or `timeout:` limits the wait (only when a handler is answering)

```halo
agent Writer [openai/gpt-4o-mini]

pipeline Publish(topic: String) -> Result:
  topic
    |> Writer.draft() as draft
    |! yield("Publish this draft?", channel: "#editors", [context.data.draft], 1h) as review
    |? (context.data.review.approved == true)
    |> System.Publish(context.data.draft)
```

If no handler is registered, the run pauses. See [Human-in-the-Loop](../guide/architecture/human-in-the-loop.md).

## Listen `~> listen(Source.Event)`

Waits for an external event. The event's payload is stored at the target path (`context.data.Slack.Reaction`) and in the `as` binding. The target can also be a `context.…` path that resolves to an event name. Without an `onListen` handler, the run pauses until `signal(runId, "Slack.Reaction", payload)`.

```halo
tool Chat : Slack(Env.SLACK_BOT_TOKEN, channel: "#approvals")

pipeline Approve(request: String) -> Result:
  request
    |> Chat.post(text: "Approve {{request}}? React to this message.")
    ~> listen(Slack.Reaction) as reaction
    |? (context.data.reaction.reaction == "approve")
```

Halo does not subscribe to Slack. Your server receives the event (for example, from a Slack webhook) and calls `signal()`.

## Loop `|<> loop(Agent, "cond", max: n)`

While the condition holds, the run jumps back to that agent's most recent earlier stage and continues from there with the current value. That value is usually a failing result the agent should fix. While looping, `context.data.loop` holds `{ target, iteration, condition }`. After `max` tries (default 3), the run fails with a `LoopLimitError`. When the loop exits, the `as` binding is the number of times it went back.

```halo
tool Shell : Bash()

agent Coder [anthropic/claude-sonnet-4-5]
  equips Shell

pipeline FixTests(task: String) -> Result:
  task
    |> Coder.write_code("Write sum.ts exporting sum(a, b). Reply with only the code.") as code
    |> Shell.run(command: "printf '%s' {{code}} > sum.ts && bun test sum.test.ts") as tests
    |<> loop(Coder, "context.data.tests.exitCode != 0", max: 3) as attempts
```

On each pass, `Coder` gets the failing `tests` result (stdout, stderr, exitCode) as its input. Agents can't edit files themselves. Here the Bash stage writes the agent's answer to disk, and `{{code}}` is shell-quoted when it is inserted. The condition is a string that uses the same syntax as gates. The validator parses it.
