# Deploying to Serverless (AWS Lambda)

Agentic workflows are often long-running. A complex multi-agent swarm analyzing a 100-page document might take 45 seconds to complete. 

Standard serverless environments like AWS Lambda or Vercel Serverless Functions have strict timeouts (e.g., API Gateway has a 29-second hard limit).

## Handling Serverless Timeouts

If you deploy Halo to a Serverless environment, you must handle long-running executions asynchronously.

### 1. The Asynchronous Trigger Pattern

Instead of waiting for the Halo runtime to finish in the HTTP request cycle, you should invoke an asynchronous worker.

1. **Client Request**: Client hits an API endpoint `/api/start-run`.
2. **Dispatch**: The API endpoint places a message on an SQS queue (or triggers an EventBridge event) and immediately returns a `202 Accepted` with a `runId`.
3. **Background Worker**: An AWS Lambda function consumes the SQS message and runs the `HaloRuntime.execute()` logic in the background (where Lambda can be configured to run for up to 15 minutes).
4. **Database Write**: When the pipeline finishes, the Lambda writes the result to DynamoDB or Postgres.
5. **Polling/Webhooks**: The client polls an endpoint `/api/run-status?id=123` or receives a webhook when the execution completes.

## Edge Runtimes (Cloudflare Workers)

Because the Halo AST and `@halo-lang/runtime` are written in pure TypeScript and have zero Node.js native dependencies (they do not rely on `fs` or `child_process` natively during execution), Halo is compatible with V8 Edge runtimes like Cloudflare Workers and Deno Deploy.

However, you must parse the `.halo` file into an AST during the **build step**, not at runtime, because Edge runtimes cannot read local files.

```typescript
// 1. Build step (Webpack/Vite): 
// Read .halo file and compile to JSON AST, then bundle the JSON.
import myPipelineAst from './compiled_workflows/support.json';

// 2. Cloudflare Worker execution:
export default {
  async fetch(request, env, ctx) {
    const runtime = new HaloRuntime({ apiKey: env.OPENAI_API_KEY });
    
    // Load the pre-compiled AST!
    runtime.load(myPipelineAst);
    
    const result = await runtime.execute("Main", {});
    return new Response(JSON.stringify(result));
  }
};
```
