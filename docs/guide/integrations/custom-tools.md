# Custom Tools

When the [built-in providers](../../stdlib/tools.md) don't cover something, register your own in TypeScript. A provider is one async function. Every tool declared with that provider name calls it.

## 1. Register a provider

```ts
import { HaloRuntime, HaloError, parse, type ToolProvider } from "halo";

const jira: ToolProvider = async (call, { fetch }) => {
  // call.tool        the declaration (name, provider, args)
  // call.method      e.g. "create_issue"
  // call.positional  positional args (defaults to [flowing value])
  // call.named       named args
  // call.config(k)   a declaration arg by name or index, with Env.* resolved
  // call.viaAgent    true when called as Agent.task(tool: Jira, ...)
  // call.signal      abort signal (timeouts, cancellation)
  if (call.method !== "create_issue") throw new HaloError(`Jira has no method "${call.method}"`);
  const res = await fetch(`https://${call.config("site")}/rest/api/2/issue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${call.config(0)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: { project: { key: call.named.project }, summary: call.named.title, issuetype: { name: "Task" } },
    }),
    signal: call.signal,
  });
  return res.json(); // becomes the stage's value
};

const runtime = new HaloRuntime().registerToolProvider("Jira", jira).load(parse(source));
```

The second argument gives the provider access to the runtime's `fetch` (useful in tests), the local vector store, and a pooled `Bun.SQL` connection.

## 2. Declare and call it

```halo
tool Tickets : Jira(Env.JIRA_TOKEN, site: "acme.atlassian.net")

agent PM [openai/gpt-4o-mini]
  equips Tickets

pipeline FileTicket(spec: String) -> Result:
  spec
    |> PM.title("Write a one-line ticket title for this spec.") as title
    |> Tickets.create_issue(project: "ENG", title: context.data.title)
```

`halo validate` warns that `Jira` is an unknown provider (it knows built-ins and installed [packages](../tool-packages.md)). Pass `{ toolProviders: ["Jira"] }` to `validate()`/`compile()` to silence the warning in your own tooling.

A tool runs when the pipeline calls it, either directly as above or through an agent with `PM.create_issue(tool: Tickets, ...)`, which calls the tool first and gives the agent its result. For an agent to choose its own calls (`PM.plan(tools: [Tickets])`, see [Agents with Tools](../agents-with-tools.md)), register the provider with a description of its methods:

```ts
runtime.registerToolProvider("Jira", jira, {
  description: "Jira issues",
  methods: [
    {
      name: "create_issue",
      description: "Create a Task in a project.",
      params: { type: "object", properties: { project: { type: "string" }, title: { type: "string" } }, required: ["project", "title"] },
      effect: "external",
    },
  ],
});
```

The model reads each method's `description` and `params` (JSON Schema). `effect` (`read`, `write`, or `external`) is what [tool rules](../../stdlib/policies.md#tool-rules) and `halo plan` go by. `methods` can also be an async function of `({ tool, config, signal }, services)`, for a provider that asks a server what it offers. Without this third argument, an agent call that offers the tool fails with `TOOL_CONFIG`.

To share a provider with other projects, publish it in a [package](../tool-packages.md).

## System methods

For logic that isn't a tool, register a `System` method. If it returns a value other than `undefined`, that value replaces the flowing value.

```ts
runtime.registerSystem("Slugify", ({ current }) => String(current).toLowerCase().replace(/\W+/g, "-"));
```

`System.Slugify()` then works in pipelines. Pass `systemMethods: ["Slugify"]` to the validator. `onSystemEvent` receives `System.Publish`, `Distribute`, `ResolveIncident`, `TriggerWebhook`, and `Notify`.

## Model providers

`runtime.registerAdapter(adapter)` adds a model provider. An adapter implements `ProviderAdapter`: `id`, `envKeys`, `canHandle(modelId)`, `getUrl`, `getHeaders`, `transformRequest`, `parseResponse`, and optionally `estimateCost`. For an OpenAI-compatible API, extend the exported `OpenAICompatibleAdapter`:

```ts
import { OpenAICompatibleAdapter } from "halo";

runtime.registerAdapter(new OpenAICompatibleAdapter({
  id: "groq", prefixes: ["groq/"], baseUrl: "https://api.groq.com/openai/v1", envKeys: ["GROQ_API_KEY"],
}));
```

Adapters registered later take precedence. If your model ids need a new prefix, the CLI's validator flags those agents, because it only knows the built-in adapters.
