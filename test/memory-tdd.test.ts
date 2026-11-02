import { LanglyRuntime } from "../src/runtime/runtime.js";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";

async function runTDD() {
  console.log("=== Testing Persistent Store ===");

  const testFilePath = ".langly_test_memory.txt";
  if (existsSync(testFilePath)) unlinkSync(testFilePath);

  const ast = {
    stores: [{
      name: "History",
      provider: "File",
      args: [testFilePath],
      namedArgs: {}
    }],
    agents: [{ 
      name: "MockMind", 
      modelId: "mock/model", 
      params: [], 
      requires: [],
      equips: ["History"] // Agent equips the store!
    }],
    pipelines: [{
      name: "Chat",
      params: [],
      returnType: "",
      pipeline: [{ kind: "call", callee: "MockMind", method: "prompt", args: ["{{context.input.msg}}"] }],
      directives: []
    }],
    schemas: [], policies: [], tools: [], errors: []
  };

  const runtime = new LanglyRuntime().load(ast as any);

  // Run 1
  runtime.mockAll({ "MockMind.prompt": "Hi there!" });
  await runtime.execute("Chat", { msg: "Hello" });

  // Run 2: The store file should now contain the first interaction
  runtime.mockAll({ "MockMind.prompt": "I remember you said Hello!" });
  await runtime.execute("Chat", { msg: "Do you remember me?" });

  // Check the file
  if (!existsSync(testFilePath)) {
    console.error("❌ [FAILED] Store file was not created.");
    process.exit(1);
  }

  const content = readFileSync(testFilePath, "utf-8");
  if (!content.includes("User: Hello") || !content.includes("Assistant: Hi there!")) {
    console.error("❌ [FAILED] Store file does not contain the first interaction.\nFile content:", content);
    process.exit(1);
  }

  if (!content.includes("User: Do you remember me?") || !content.includes("Assistant: I remember you said Hello!")) {
    console.error("❌ [FAILED] Store file does not contain the second interaction.\nFile content:", content);
    process.exit(1);
  }

  console.log("✅ [PASSED] Store context was correctly loaded and saved to the File provider!");
  unlinkSync(testFilePath);
}

runTDD().catch(console.error);
