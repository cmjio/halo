# Deploying to Next.js

Halo is designed to be embedded directly into standard Node.js environments. Because the `@halo-lang/runtime` is a lightweight TypeScript execution engine, it pairs perfectly with Next.js App Router API Routes.

## The Architecture

1. You store your `.halo` files in a `/workflows` directory in your Next.js project.
2. A Next.js API Route (`app/api/halo/route.ts`) acts as the trigger.
3. The API route parses the `.halo` file, executes it using the `HaloRuntime`, and returns the JSON result to the client.

## Example API Route

```typescript
// app/api/halo/route.ts
import { NextResponse } from 'next/server';
import { parse, HaloRuntime } from '@halo-lang/runtime';
import { readFileSync } from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Resolve the path to your Halo script
    const scriptPath = path.join(process.cwd(), 'workflows', 'support.halo');
    const source = readFileSync(scriptPath, 'utf-8');
    
    // 2. Parse the AST
    const ast = parse(source);
    if (ast.errors.length > 0) {
      return NextResponse.json({ error: "Syntax error in Halo file", details: ast.errors }, { status: 500 });
    }

    // 3. Initialize Runtime
    const runtime = new HaloRuntime({ apiKey: process.env.OPENAI_API_KEY });
    runtime.load(ast);

    // 4. Execute the Pipeline
    const result = await runtime.execute("HandleSupportTicket", { 
      ticketData: body.ticket 
    });

    // 5. Return the result
    return NextResponse.json({ success: true, data: result });
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## Security Considerations

Always store your `OPENAI_API_KEY` (or other provider keys) in the `.env.local` file. The Next.js server-side API route ensures that your API keys and your `.halo` logic are completely hidden from the client browser.

Do not expose the `HaloRuntime` execution logic inside a React Client Component (`"use client"`). It must run on the server.
