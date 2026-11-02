# Language Reference

A `.halo` file is a list of declarations in any order. Comments are `//` and `/* … */`. Whitespace and newlines don't matter. The full grammar is `grammars/Halo.g4`.

```halo
policy Safe : Block(PromptInjection)
tool   Api  : REST("api.example.com/v1", apiKey: Env.API_KEY)
store  Docs : VectorStore(namespace: "docs")
schema Answer { text: String, sources: Array<String> }
agent  Bot [openai/gpt-4o-mini, temp: 0.3]
  equips Docs
  requires Safe
pipeline Ask(question: String) -> Answer:
  question |> Bot.answer("""Reply as {"text": ..., "sources": [...]}""")
```

## `agent`

```
@directive(...)*
agent Name [model, param: value, ...]
  system "..." | """..."""
  equips Tool, Store, ...
  requires Policy, ...
```

- **model**: a model id. Its prefix chooses the provider: `openai/`, `anthropic/`, `google/` or `gemini/`, `openrouter/`, `together/`, `replicate/`, `ollama/` or `local/`. Bare `gpt-*`, `claude-*`, and `gemini-*` ids also work. See [Quickstart](./quickstart.md#3-set-an-api-key) for each provider's key variable.
- **params**: `temp` / `temperature`, `max_tokens`, and `top_p` are sent to the model. `system:` or `role:` here sets the system prompt when there is no `system` modifier. `tools: auto`, `max_steps`, and `tool_result_chars` control [tool calls the agent chooses](./agents-with-tools.md).
- **system**: the system prompt.
- **equips**: tools and stores the agent may use with `tool:` or `tools:`. Equipped `VectorStore`s and `File` stores also add context automatically (see [Stores](../stdlib/stores.md)).
- **requires**: policies checked on every call (see [Policies](../stdlib/policies.md)).
- **directives**: `@timeout`, `@retry`, `@shadow`, `@correct` (see [Directives](../reference/compiler-directives.md)).

## `tool` and `store`

```
tool  Name : Provider(args...)
store Name : Provider(args...)
```

`tool` and `store` mean the same thing. Use `store` for things that hold data. The providers are `REST`/`GET`, `POST`, `PostgreSQL`/`SQL`, `VectorStore`, `File`, `Bash`, `Browser`, `Chrome`, `Workspace`, `KV`, `Code`, `Documents`, `MCP`, `Slack`, `Email`, `GitHub`, `Linear`, and `Figma` (see [Built-in Tools](../stdlib/tools.md)). You can add more with [tool packages](./tool-packages.md) or `runtime.registerToolProvider`.

`Env.NAME` reads an environment variable. It works **only in tool and store declarations**, written either bare (`Env.GITHUB_TOKEN`) or as a string (`"Env.GITHUB_TOKEN"`). In a pipeline it is an error, and `{{Env.X}}` is never filled in, so secrets can't reach prompts.

## `policy`

```
policy Name : Rule(args) & Rule(args) & ...
```

See [Policies](../stdlib/policies.md) for each rule and which ones are enforced.

## `schema`

```
schema Name { field: Type, other: Array<Type> }
```

Field types: `String`, `Number`, `Integer`, `Boolean`, `Array`/`List` (optionally `Array<T>`), `Object`/`JSON`/`Any`, or another schema. When a pipeline declares `-> SchemaName`, its output is checked against that schema. See [Types & Schemas](../reference/types.md).

## `pipeline`

```
@directive(...)*
pipeline Name(param: Type, ...) -> ReturnType:
  start-value
    |> Stage() as name
    ...
```

A pipeline starts with an expression (a parameter, a literal, or a `context.…` path) or directly with an operator. Parameter types are labels and are not checked at runtime. The return type is checked only when it names a declared `schema`. `Result` is a common placeholder.

### Calls

| Form | Meaning |
|---|---|
| `Agent.method(args)` | Prompt an agent. The method name becomes the task. |
| `Tool.method(args)` | Call a tool provider method. |
| `System.Method(args)` | A built-in (`Print`, `Log`, `Sleep`, `Fail`, `Pick`) or an event (`Publish`, `Notify`, …). |
| `Pipeline(args)` | Run another pipeline. Positional args bind to its parameters in order, named args by name. |

Arguments are positional or named (`key: value`). A value is a string (`"…"`, `'…'`, `"""…"""`), a number, a duration (`500ms`, `30s`, `5m`, `1h`, `2d`), `true`/`false`/`null`, a list `[a, b]`, a parameter or result name, a dotted path, or `context.…`.

On an agent call:

- positional strings are instructions
- other positional values are inputs
- named args are listed as parameters
- `tool: T` runs the equipped tool first
- `tools: [A, B]` (or `auto`, or `none`) lets the agent choose its own calls to those tools; `max_steps: n` limits the requests
- `temperature`, `max_tokens`, `top_p`, and `system` override the agent's settings

If an agent call passes no inputs and its instructions have no `{{…}}` placeholders, the flowing value is sent as the input.

### Operators

| Operator | Stage |
|---|---|
| `\|> Call() as x` | pipe |
| `\|? (cond)` | gate: halt if false |
| `\|? { (cond) => Call(), else => Call() } as x` | branch |
| `\|* { CallA(), CallB() as b } as all` | fan-out in parallel |
| `\|* each(item in list, concurrency: n) => Call() as xs` | map over a list |
| `\|! yield(msg, ...) as answer` | ask a human |
| `~> listen(Source.Event) as event` | wait for an event |
| `\|<> loop(Agent, "cond", max: n) as tries` | retry an earlier agent stage |

Conditions support `==`, `!=`, `>`, `>=`, `<`, `<=`, `&&`, `||`, `!`, and parentheses. Details are in [Pipe Operators](../reference/operators.md).

### Templates

`{{name}}`, `{{name.field}}`, `{{context.data.x}}`, and `{{current}}` are filled in inside strings. They resolve parameters, results, and bindings. If a placeholder doesn't resolve, it is left as written, and the validator warns.

## Keywords

`policy tool store schema agent pipeline equips requires system context yield listen loop each in else as`, plus `true false null`. The reserved names `System` and `Env` cannot be declared.
