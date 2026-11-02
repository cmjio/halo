import { LanglyRuntime } from "../src/runtime/runtime.js";

async function runTDD() {
  console.log("=== Testing Schema Schema Validation ===");

  const ast = {
    agents: [{ name: "MockMind", modelId: "mock/model", params: [], requires: [] }],
    pipelines: [{
      name: "GetProfile",
      params: [],
      returnType: "UserProfile",
      pipeline: [{ kind: "call", callee: "MockMind", method: "prompt", args: ["test"] }],
      directives: []
    }],
    schemas: [{
      name: "UserProfile",
      fields: [
        { name: "name", type: "String" },
        { name: "age", type: "Number" },
        { name: "isActive", type: "Boolean" },
        { name: "tags", type: "Array" }
      ]
    }],
    policies: [], tools: [], stores: [], errors: []
  };

  const runtime = new LanglyRuntime().load(ast as any);

  // Helper to run a test case
  async function testCase(name: string, mockResponse: string, expectedError?: string) {
    runtime.mockAll({ "MockMind.prompt": mockResponse });
    try {
      const result = await runtime.execute("GetProfile", {});
      if (expectedError) {
        console.error(`❌ [FAILED] ${name}: Expected error containing "${expectedError}", but it succeeded.`);
        return false;
      }
      console.log(`✅ [PASSED] ${name}`);
      // Ensure result is parsed into a real object
      if (typeof result !== "object" || result === null) {
        console.error(`❌ [FAILED] ${name}: Expected result to be an object, got ${typeof result}`);
        return false;
      }
      return true;
    } catch (err) {
      const e = err as Error;
      if (!expectedError) {
        console.error(`❌ [FAILED] ${name}: Expected success, but got error: ${e.message}`);
        return false;
      }
      if (!e.message.includes(expectedError)) {
        console.error(`❌ [FAILED] ${name}: Expected error to contain "${expectedError}", but got: ${e.message}`);
        return false;
      }
      console.log(`✅ [PASSED] ${name} (Correctly failed with: ${e.message})`);
      return true;
    }
  }

  const results = [];

  // Test 1: Valid JSON with correct types
  results.push(await testCase(
    "Valid JSON",
    '{"name": "Alice", "age": 30, "isActive": true, "tags": ["admin", "user"]}'
  ));

  // Test 2: Invalid JSON string
  results.push(await testCase(
    "Invalid JSON",
    'This is not json',
    "Output is not valid JSON"
  ));

  // Test 3: Missing field
  results.push(await testCase(
    "Missing field 'age'",
    '{"name": "Alice", "isActive": true, "tags": []}',
    "missing field 'age'"
  ));

  // Test 4: Incorrect type for String
  results.push(await testCase(
    "Incorrect type (name as Number)",
    '{"name": 123, "age": 30, "isActive": true, "tags": []}',
    "expected type 'String' for field 'name'"
  ));

  // Test 5: Incorrect type for Number
  results.push(await testCase(
    "Incorrect type (age as String)",
    '{"name": "Alice", "age": "30", "isActive": true, "tags": []}',
    "expected type 'Number' for field 'age'"
  ));

  // Test 6: Incorrect type for Boolean
  results.push(await testCase(
    "Incorrect type (isActive as String)",
    '{"name": "Alice", "age": 30, "isActive": "true", "tags": []}',
    "expected type 'Boolean' for field 'isActive'"
  ));

  // Test 7: Incorrect type for Array
  results.push(await testCase(
    "Incorrect type (tags as String)",
    '{"name": "Alice", "age": 30, "isActive": true, "tags": "admin"}',
    "expected type 'Array' for field 'tags'"
  ));

  const allPassed = results.every(r => r === true);
  if (!allPassed) {
    process.exit(1);
  } else {
    console.log("🎉 All TDD tests passed!");
  }
}

runTDD().catch(console.error);
