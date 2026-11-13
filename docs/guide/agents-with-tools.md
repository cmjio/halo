# Agents with Tools

By default a pipeline decides every tool call. Give an agent call `tools:` and the agent chooses its own calls instead: it asks for a tool, sees the result, and asks for another, until it answers. Halo uses each provider's native tool calling. Every call the agent asks for is checked against its [tool policies](../stdlib/policies.md#tool-rules) before it runs.

```halo
policy FixerTools : AllowTools("Code.*", "Tests.run")
  & DenyTools("Code.delete")
  & DenyArgs("Code.write", "path", "\\.test\\.")
  & DenyArgs("Tests.run", "command", "^(?!bun test[\\w ./-]*$)")

tool Code  : Workspace("{{workdir}}", write: true)
tool Tests : Bash(cwd: "{{workdir}}", timeout_ms: 120000)

agent Fixer [anthropic/claude-sonnet-4-5, temp: 0.0, max_steps: 40]
  system "You fix a TypeScript project until its acceptance tests pass. Run them with Tests.run."
  equips Code, Tests
  requires FixerTools

pipeline FixUntilGreen(workdir: String, spec: String) -> Result:
  workdir
    |> Fixer.fix("Make the acceptance tests pass. The spec:", spec, tools: [Code, Tests]) as report
    |> Tests.run(command: "bun test acceptance.test.ts 2>&1 | tail -40") as result
    |<> loop(Fixer, "context.data.result.exitCode != 0", max: 3)
    |> System.Value(context.data.report)
```

The fixer runs the tests, reads files, edits them, and runs the tests again, choosing each step itself. The policy keeps it inside the project's files, away from the tests, and limits the shell to `bun test`. Both `DenyArgs` rules here use the three-argument form, which checks one named argument (`path`, `command`); `DenyArgs(tool, regex)` checks every argument value, each on its own. The pipeline then runs the tests itself and sends the fixer back if they still fail. This is `FixUntilGreen` in the repository's `examples/engineering/software-team.halo`.

## Giving an agent a computer

The fixer above runs commands on your machine, fenced by policies. To have an agent run code somewhere it can't reach your files at all, give it a sandbox instead: `sandbox: "auto"` in its brackets gives it a fresh Docker container or cloud sandbox for each run, with its own `Remote` tool. See [Coding Agents That Run Their Code](./coding-agents.md).

## Choosing the tools

| Written | Offers |
|---|---|
| `Agent.task(tools: [A, B])` | The methods of `A` and `B` |
| `tools: auto` in the agent's brackets, or on a call | Every tool the agent `equips`, except `VectorStore` and `File` stores |
| `tools: none` on a call | No tools for that call |

Each tool must be declared and in the agent's `equips`. `halo validate` reports a name that isn't, and so does the runtime. Equipped `VectorStore` and `File` stores still add context to the prompt as before (see [Stores](../stdlib/stores.md)).

Without `tools:`, an agent call is one model request, as it always was. `tool: T` still means "call `T` first, then give the agent its result" (see [Core Concepts](./concepts.md)).

The model sees each method as a function named `Tool__method` (for example `Code__edit`), with the provider's description and the method's arguments as JSON Schema. Built-in providers describe their methods; `halo tools` lists them. An MCP tool's methods come from its server when the call starts. A provider registered with `registerToolProvider(name, provider)` and no third `info` argument can't be offered, and the call fails with `TOOL_CONFIG` (see [Custom Tools](./integrations/custom-tools.md)). Methods that a policy hides are not offered at all.

## The tool loop

1. Halo sends the conversation (system prompt, the call's prompt, and every turn so far) with the offered tools.
2. If the model answers without asking for tools, that answer is the call's result. Output policies, schemas and `@correct` apply to it as usual.
3. Otherwise Halo runs the calls it asked for, in order. Each is checked against the agent's policies, may wait for a person's approval, and then runs. Its result becomes a tool message in the conversation.
4. Halo asks the model again. After `max_steps` requests that asked for tools, the next request tells the model it has used its steps and asks for an answer with tools turned off.

| Setting | Where | Default |
|---|---|---|
| `max_steps` | The agent's brackets, or the call | 10 |
| `tool_result_chars` | The agent's brackets, or the call | 16000 |

A tool result is turned into text (JSON for anything that isn't a string) and cut at `tool_result_chars`. It then passes through the agent's input policies, because it is input to the model: `Redact` replaces what it matches, and a `Block` match replaces the whole result with a note saying it was withheld. The `tool` event (and so Studio's telemetry) gets the result with the agent's `Redact` and `Block` policies applied in the same way. [Recordings](./plan-and-replay.md#recordings) keep the result as the tool returned it, unredacted.

A tool call an agent chooses gets only the arguments the model gave. The pipeline's flowing value is never added to it.

### When something goes wrong

The run doesn't fail because one tool call did. The model gets a message instead and decides what to do next:

| What happened | The model sees |
|---|---|
| It named a function that doesn't exist | `Error: there is no tool named "…". You can call: …` |
| A policy refused the call | `Refused by policy "…": …. Don't try this call again.` |
| A person declined it | `A person declined this call: <reason>. Don't try it again; …` |
| The tool threw | `Error: <message>` |

Cancellation, timeouts on the run, and pauses still stop the call.

### Cost

Each step is a separate model request, counted in `context.meta.cost` and by `MaxSpend` like any other. Every request resends the whole conversation, so a long tool conversation costs more than its number of steps times one call. `halo plan` estimates the worst case as `max_steps + 1` requests that each grow by a full reply (see [Plan and Replay](./plan-and-replay.md)).

### With other directives

- `@correct(n)`: when a policy rejects the final answer, Halo adds a message saying why to the same conversation and asks again. The agent keeps what its tools told it.
- `|<> loop(Agent, ...)`: going back to the agent's stage starts a new conversation. The loop's feedback (the check that failed and the agent's previous answer) is in the new prompt.
- `@retry` and `@timeout` apply to each model request in the conversation.

## Model providers

| Provider | Tool calling |
|---|---|
| OpenAI, OpenRouter, Together | `tools` as functions, results as `tool` messages |
| Anthropic | `tool_use` and `tool_result` blocks |
| Google Gemini | `functionDeclarations`; signed parts are sent back unchanged |
| Ollama | `tools` on `/api/chat` |
| Replicate | Not supported. An agent with tools on a Replicate model fails with `TOOL_CONFIG` |

Whether a model can call tools also depends on the model. OpenRouter, Together and Ollama serve many that can't, and their API then returns an error. Ollama has no way to turn tools off for the last request, so a model there may still ask for tools after `max_steps`: those calls are ignored, and its text is the answer.

A custom adapter sets `supportsTools = false` if its API can't call tools; otherwise it must send `req.tools` and parse tool calls in `parseResponse` (see [Custom Tools](./integrations/custom-tools.md#model-providers)).

## Approvals

`ApproveTools(...)` and `ApproveEffects(...)` make a call wait for a person (see [tool rules](../stdlib/policies.md#tool-rules)):

```halo
policy Careful : AllowTools("Files.*") & ApproveEffects(write)

tool Files : Workspace("./notes", write: true)

agent Clerk [openai/gpt-4o]
  equips Files
  requires Careful

pipeline Tidy(task: String) -> Result:
  task |> Clerk.work(tools: [Files])
```

Before an approved call runs, Halo asks, in this order:

1. A mock for `"Files.write?"` or `"approval"`, in tests.
2. The `onInterrupt` handler. Its request has `channel: "approval"`, a `message` like `Allow Clerk to call Files.write with {...}? (policy Careful)`, and `named: { target, args, policy, agent }`.
3. With no handler, the run **pauses**: `status: "paused"`, waiting for `"approval"`. The conversation so far and the calls still to run are saved with the paused run.

These answers approve: `true`, the words `y`, `yes`, `approve`, `approved`, `allow`, `ok`, `okay`, and objects with `approved: true`, `action: "approve"`, or `status: "approved"`. Anything else declines, and the model is told so, with the reason if there is one: an object's `reason`, `comment`, or `text` (what the CLI and approval links make of typed text), or a plain string. A bare `no`, `reject`, `deny` or `decline` gives no reason. So typing `no, write to drafts/ instead` tells the model why.

Answering a paused run continues the same conversation: the approved call runs, then any other calls from that turn, and the model is not asked again for that turn. Calls that ran before the pause in the same turn don't run again.

```ts
const paused = await runtime.run("Tidy", { task: "merge the duplicate notes" });
// paused.status === "paused", paused.context.meta.paused.waitingFor === "approval"
const done = await runtime.signal(paused.runId, "approval", "approve");
```

| Where | How a person answers |
|---|---|
| `halo run` in a terminal | It asks `Allow? [y/N, or say why not]`. `y` approves; anything else declines, and pressing Enter alone declines |
| `halo run` without a terminal | The run pauses and prints `halo resume <file> <runId> --payload approve` |
| `halo run --auto-approve`, `halo test` | Every call is approved without asking |
| `halo serve` | A signed approval link, Studio, a Slack button, or `POST /api/runs/<id>/signal` (see [Serving pipelines](./production/serving.md#human-approval)) |
| The library | `onInterrupt`, or `runtime.signal(runId, "approval", answer)` |

**Only a top-level agent stage can pause.** If the call that needs approval is inside `|* { ... }`, `|* each`, a branch arm, or a pipeline called from another pipeline, there is no way to stop there and pick up later. Without an `onInterrupt` handler, the call fails with `APPROVAL_NEEDED`. `halo serve` and `halo mcp` register no handler, so use approvals only on top-level agent stages there.

## Testing with mocks

A mock for an agent with tools gets three more fields on its request: `tools` (the `"Tool.method"` names offered), `messages` (the conversation so far), and `step` (1 for the first request, then 2, ...). To call tools, return `useTool(target, args)`, or a list of them. Anything else is the answer.

```ts
import { test, expect } from "bun:test";
import { HaloRuntime, parse, useTool, type MockRequest } from "halo";

test("the clerk reads, then answers", async () => {
  const runtime = new HaloRuntime().load(parse(source)).mockAll({
    "Clerk.work": (req: MockRequest) =>
      req.step === 1 ? useTool("Files.read", { path: "notes.md" }) : "Merged 2 notes.",
    "Files.read": { path: "notes.md", content: "a\nb\n", lines: 2 },
    approval: "approve",
  });
  const result = await runtime.run("Tidy", { task: "merge duplicates" });
  expect(result.output).toBe("Merged 2 notes.");
});
```

- The tools themselves run for real unless you mock them too (`"Files.read"`, or `"Files"` for every method). Their calls are still checked against the agent's policies, so a test shows what a policy refuses.
- `"Files.write?"` answers approvals for that target, and `approval` answers every other one. The specific key wins.
- Under `halo test` (and `--mock`), every agent answers with text on its first request, so no tools are called.

`test/agent-tools.test.ts` in the repository has more: refusals, `DenyArgs`, pausing for approval and resuming, and requests on the wire for each provider.

## Events

Every call an agent asks for emits an `agent_tool` event:

| Field | Value |
|---|---|
| `agent`, `target` | Who asked, and the `"Tool.method"` it asked for |
| `args` | The arguments, with the agent's `Redact` policies applied (or withheld if a `Block` matches) |
| `decision` | `allowed`, `approved`, `declined`, `refused`, or `error` |
| `detail` | The refusal, the error, or the person's reason |

The event comes after the call finishes. A call that ran also emits the usual `tool` event (its output redacted by the agent's policies), and is recorded in `context.meta.calls` with `agent` set to the agent that chose it. Each model request emits an `llm` event. A refused call is a policy violation: it is in `context.meta.violations` with `phase: "tool"`, and emits a `violation` event. A declined call is not a violation.
