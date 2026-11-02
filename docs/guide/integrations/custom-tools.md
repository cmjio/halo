# Custom Tools

Agents are useless without hands. While Halo provides built-in tools for generic HTTP REST calls and File System operations, enterprise workflows almost always require custom business logic.

Halo makes it trivial to bind any TypeScript class to an agent as a Tool.

## 1. Write the TypeScript Class

A Halo Tool is just a TypeScript class that implements a `name`, a `description` (which the LLM reads to understand how to use it), and an `execute` method.

```typescript
// my-tools.ts
export class JiraTicketCreator {
  // 1. The name used in the .halo file
  name = "Jira";
  
  // 2. The description injected into the LLM's system prompt
  description = "Creates a new Jira ticket. Requires a title and description.";
  
  // 3. The execution logic
  async execute(args: { title: string, desc: string }): Promise<string> {
    const res = await fetch("https://api.atlassian.com/ex/jira/.../rest/api/2/issue", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.JIRA_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          project: { key: "ENG" },
          summary: args.title,
          description: args.desc,
          issuetype: { name: "Task" }
        }
      })
    });
    
    const data = await res.json();
    return `Ticket Created: ${data.key}`;
  }
}
```

## 2. Register the Tool in the Runtime

Before executing your `.halo` script, you must register the tool with the runtime.

```typescript
import { HaloRuntime, parse } from '@halo-lang/runtime';
import { JiraTicketCreator } from './my-tools';

const runtime = new HaloRuntime({ apiKey: process.env.OPENAI_API_KEY });

// Register the tool!
runtime.toolRegistry.register(new JiraTicketCreator());

// Load and execute...
const ast = parse(source);
runtime.load(ast);
await runtime.execute("MyPipeline", {});
```

## 3. Equip the Tool in Halo

Now, your custom TypeScript logic is natively available in the DSL.

```halo
// Bind the tool
tool JiraTicket : Jira()

agent ProductManager [openai/gpt-4o]
  equips JiraTicket

pipeline CreateEpic(spec: String) -> Result:
  spec 
    |> ProductManager.prompt("Break this spec down and create Jira tickets.")
```

When the `ProductManager` decides to create a ticket, the Halo Runtime intercepts the LLM's JSON tool-call request, safely executes your TypeScript `execute` method, and feeds the `Ticket Created: ENG-123` string back into the LLM context automatically.
