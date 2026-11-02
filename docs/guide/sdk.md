# The Escape Hatch (SDK)

Halo is not a walled garden. At its core, the Halo parser compiles your `.halo` files into an Abstract Syntax Tree (AST), and the `@halo-lang/runtime` executes that AST in pure TypeScript.

If you ever hit a limitation in the Halo DSL, you can drop down into standard Node.js or Bun code and execute the AST manually. This is known as "The Escape Hatch."

## Embedding Halo in Next.js or Express

You don't have to use the `halo run` CLI command to run your agents in production. You can embed the Halo Runtime directly into your API routes.

```typescript
import { parse, HaloRuntime } from '@halo-lang/runtime';
import { readFileSync } from 'fs';

// 1. Read and parse your Halo workflow
const source = readFileSync('./workflows/support.halo', 'utf-8');
const ast = parse(source);

if (ast.errors.length > 0) {
  throw new Error("Syntax errors in Halo file");
}

// 2. Initialize the Runtime
const runtime = new HaloRuntime({ 
  apiKey: process.env.OPENAI_API_KEY 
});

runtime.load(ast);

// 3. Execute a pipeline programmatically
export async function POST(req: Request) {
  const { customerMessage } = await req.json();
  
  // This executes the `SupportBot` pipeline defined in support.halo
  const result = await runtime.execute("SupportBot", { 
    message: customerMessage 
  });
  
  return Response.json({ response: result });
}
```

## Intercepting Telemetry

The `HaloRuntime` exposes a `telemetry` dispatcher that allows you to hook into every step of the agent's execution.

```typescript
runtime.telemetry.on("node_start", (event) => {
  console.log(`Agent ${event.stage} is starting...`);
});

runtime.telemetry.on("tool_call", (event) => {
  console.log(`Calling tool with arguments:`, event.payload);
});
```

## Adding Custom TypeScript Tools

If the built-in tools don't fit your needs, you can register standard TypeScript classes as tools in the runtime.

```typescript
// 1. Define your tool
class MyDatabaseTool {
  name = "MyDB";
  description = "Fetches user data from our internal database.";
  
  async execute(args: { userId: string }) {
    const user = await db.users.find(args.userId);
    return JSON.stringify(user);
  }
}

// 2. Register it with the runtime
runtime.toolRegistry.register(new MyDatabaseTool());
```

Then, in your `.halo` file, you simply equip it!

```halo
agent Assistant [openai/gpt-4o]
  @equips(MyDB)
```
