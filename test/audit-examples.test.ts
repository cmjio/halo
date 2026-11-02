import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { type ProviderAdapter } from "../src/runtime/adapter.js";

// A mock adapter that doesn't actually call the network
class AuditAdapter implements ProviderAdapter {
  id = "audit";
  canHandle() { return true; }
  getUrl() { return "http://localhost/mock"; }
  getHeaders() { return {}; }
  transformRequest(req: any) { return req; }
  parseResponse() { 
    return { text: "Mock response", usage: { promptTokens: 10, completionTokens: 10 } }; 
  }
  estimateCost() { return 0.01; }
}

async function auditExamples() {
  const examplesDir = import.meta.dir + "/../examples";
  const files = readdirSync(examplesDir).filter(f => f.endsWith(".halo")).sort();
  
  const results = [];

  // Disable console.log and console.error temporarily to keep output clean
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};

  for (const file of files) {
    const filePath = join(examplesDir, file);
    const content = readFileSync(filePath, "utf-8");
    
    let parseError = null;
    let runtimeError = null;
    let ast = null;

    // 1. Test Parser
    try {
      ast = parse(content);
    } catch (e) {
      parseError = (e as Error).message;
    }

    // 2. Test Runtime initialization (if parse succeeded)
    if (ast) {
      try {
        const runtime = new LanglyRuntime({ apiKey: "test" })
          .registerAdapter(new AuditAdapter())
          .load(ast);
          
        for (const agent of ast.agents) {
          if (agent.equips) {
            for (const item of agent.equips) {
              const isTool = ast.tools.find(t => t.name === item);
              const isMemory = ast.stores.find(m => m.name === item);
              if (!isTool && !isMemory) {
                runtimeError = `Agent ${agent.name} equips undefined tool or store: ${item}`;
              }
            }
          }
          if (agent.requires) {
            for (const policy of agent.requires) {
              if (!ast.policies.find(g => g.name === policy)) {
                runtimeError = `Agent ${agent.name} requires undefined policy: ${policy}`;
              }
            }
          }
        }
      } catch (e) {
        runtimeError = (e as Error).message;
      }
    }

    if (parseError || runtimeError) {
      results.push({ file, parseError, runtimeError });
    }
  }

  // Restore console
  console.log = originalLog;
  console.error = originalError;

  console.log(JSON.stringify(results, null, 2));
}

auditExamples().catch(console.error);
