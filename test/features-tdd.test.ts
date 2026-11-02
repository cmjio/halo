import { parse } from "../src/parser/index.js";
import { LanglyRuntime, InMemoryExecutionStore } from "../src/runtime/runtime.js";
import { readFileSync } from "fs";

import { type ProviderAdapter } from "../src/runtime/adapter.js";

// Mock adapter to fulfill LLM calls
class MockAdapter implements ProviderAdapter {
  id = "mock";
  canHandle() { return true; }
  provider = "openai";
  getUrl() { return "http://localhost/mock"; }
  getHeaders() { return {}; }
  transformRequest(req: any) { return req; }
  parseResponse() { 
    return { text: "Mock response", usage: { promptTokens: 10, completionTokens: 10 } }; 
  }
  estimateCost() { return 1.50; } // Cost to trigger MaxSpend
}

async function runTests() {
  console.log("=== Testing 15-shadow-agents.halo ===");
  const shadowAst = parse(readFileSync("./examples/15-shadow-agents.halo", "utf-8"));
  const shadowRuntime = new LanglyRuntime().load(shadowAst).registerAdapter(new MockAdapter());
  
  // Provide mock response for the primary agent to avoid network
  shadowRuntime.mockAll({ "Baseline.prompt": "Primary result" });
  await shadowRuntime.execute("CompareGreetings", { name: "Alice" });
  console.log("Shadow test complete (check for [Shadow] logs above).");

  Bun.env.LANGLY_API_KEY = "test_key";

  console.log("\n=== Testing 30-control-moderation.halo (Redact) ===");
  const modAst = parse(readFileSync("./examples/30-control-moderation.halo", "utf-8"));
  // Inject PIIProtection into TriageAgent for the test
  const triage = modAst.agents.find(m => m.name === "TriageAgent");
  if (triage && !triage.requires?.includes("PIIProtection")) {
    triage.requires = [...(triage.requires || []), "PIIProtection"];
  }
  
  const modRuntime = new LanglyRuntime().load(modAst).registerAdapter(new MockAdapter());
  modRuntime.mockAll({ "TriageAgent.screen": "Here is the SSN: 123-45-6789 and CreditCard: 1234-5678-9012-3456" });
  
  try {
    const result = await modRuntime.execute("ModerateContent", { submission: { body: "test", user_flags: 0 } });
    console.log("Moderation Result (Should be redacted):", result);
  } catch (err) {
    console.error("Moderation error:", err);
  }

  console.log("\n=== Testing 16-retry-checkpoint.halo ===");
  const chkAst = parse(readFileSync("./examples/16-retry-checkpoint.halo", "utf-8"));
  const store = new InMemoryExecutionStore();
  const chkRuntime = new LanglyRuntime().setExecutionStore(store).load(chkAst).registerAdapter(new MockAdapter());
  chkRuntime.mockAll({ "Resilient.prompt": "Mocked resilience response" });
  
  await chkRuntime.execute("RobustCall", { data: "test data" });
  // We can't easily mock a mid-pipeline failure without throwing, but we can check the store
  const runId = chkRuntime.lastContext?.runId;
  const savedContext = await store.load(runId!);
  console.log("Checkpoint saved context stageIndex:", savedContext?.stageIndex);
  console.log("\n=== Testing New Guardrails (Require JSON, Redact APIKeys, MaxLatency) ===");
  // Create a mock AST manually for this test to avoid needing to parse a full file
  const testAst = {
    agents: [{
      name: "TestMind",
      modelId: "mock/model",
      params: {},
      requires: ["TestGuardrail"]
    }],
    policies: [{
      name: "TestGuardrail",
      rules: [
        { name: "Require", args: ["JSON"] },
        { name: "Redact", args: ["APIKeys"] },
        { name: "MaxLatency", args: ["10s"] } // should pass
      ]
    }],
    pipelines: [{
      name: "TestStream",
      params: [],
      returnType: "",
      pipeline: [{ kind: "call", callee: "TestMind", method: "prompt", args: ["test"] }],
      directives: []
    }],
    tools: [], stores: [], schemas: [], errors: []
  };

  const testRuntime = new LanglyRuntime().load(testAst as any).registerAdapter(new MockAdapter());
  
  // Provide a mock response that is valid JSON but contains an AWS key
  testRuntime.mockAll({ 
    "TestMind.prompt": '{"status": "ok", "key": "AKIAIOSFODNN7EXAMPLE", "message": "hello"}' 
  });
  
  try {
    const result = await testRuntime.execute("TestStream", {});
    console.log("Result passed JSON check and redacted key:");
    console.log(result);
  } catch (err) {
    console.error("New policies test failed:", err);
  }

  // Test MaxLatency failure
  const testAstLatency = {
    agents: [{
      name: "SlowMind",
      modelId: "mock/model",
      params: {},
      requires: ["StrictLatency"]
    }],
    policies: [{
      name: "StrictLatency",
      rules: [{ name: "MaxLatency", args: ["1ms"] }] // 1ms will always fail
    }],
    pipelines: [{
      name: "SlowStream",
      params: [],
      returnType: "",
      pipeline: [{ kind: "call", callee: "SlowMind", method: "prompt", args: ["test"] }],
      directives: []
    }],
    tools: [], stores: [], schemas: [], errors: []
  };

  const slowRuntime = new LanglyRuntime().load(testAstLatency as any).registerAdapter(new MockAdapter());
  slowRuntime.mockAll({ "SlowMind.prompt": "Response" });
  try {
    // Wait for a few ms to ensure the LLM call takes longer than 1ms
    const originalCallLLM = slowRuntime["callLLM"].bind(slowRuntime);
    slowRuntime["callLLM"] = async (...args) => {
      await new Promise(r => setTimeout(r, 10));
      return await originalCallLLM(...args);
    };
    await slowRuntime.execute("SlowStream", {});
  } catch (err) {
    console.log("MaxLatency correctly caught slow execution:", (err as Error).message);
  }
}

runTests().catch(console.error);
