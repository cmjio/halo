import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";

describe("Langly Runtime TDD - Bug Fixes", () => {
  test("Fan-Out Overwrites: duplicate agent calls should not overwrite each other", async () => {
    const src = `
      agent M [mock/model]
      pipeline FanOutDemo(x: String) -> Result:
        x |* { M.prompt("A"), M.prompt("B") }
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    rt.mockAll({
      "M.prompt": "Result from M", // Both calls will return this
    });

    const result = await rt.execute("FanOutDemo", { x: "start" });
    expect(result).toEqual(["Result from M", "Result from M"]);
    
    // Check ctx.data to ensure keys aren't overwritten. We should have distinct keys or an array.
    // Right now execute() doesn't return context, let's expose it for testing.
    const ctx = (rt as any).lastContext;
    expect(ctx.data["M.prompt_0"]).toBe("Result from M");
    expect(ctx.data["M.prompt_1"]).toBe("Result from M");
  });

  test("Gate Evaluation Fragility: strings with spaces and == should not break parser", async () => {
    const src = `
      pipeline GateDemo(x: String) -> Result:
        x
          |? (context.input.msg == "== true")
          |> System.Print()
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    const result = await rt.execute("GateDemo", { x: "x", msg: "== true" });
    expect(result).toBe("x");
  });

  test("Gate Evaluation Fragility: false conditions should halt pipeline", async () => {
    const src = `
      pipeline GateDemoFalse(x: String) -> Result:
        x
          |? (context.input.x == "valid")
          |> System.Print()
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    const result = await rt.execute("GateDemoFalse", { x: "invalid" });
    expect(result).toBe("invalid"); // Stops at the first stage
  });

  test("Guardrails Protect Output: should block if LLM output contains profanity", async () => {
    const src = `
      policy NoProfanity : Block(Profanity)
      agent M [mock/model]
        requires NoProfanity
      pipeline GuardrailDemo(x: String) -> Result:
        x |> M.prompt("innocent prompt")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    // The prompt is innocent, but the MOCK output contains Profanity!
    rt.mockAll({
      "M.prompt": "This is a damn good test",
    });

    // We expect it to throw an error since the output violates the policy
    expect(rt.execute("GuardrailDemo", { x: "innocent prompt" })).rejects.toThrow("Profanity detected");
  });

  test("Variable Interpolation: tool config and inline strings should interpolate", async () => {
    const src = `
      tool TestTool : GET("api.test.com?q={{context.input.query}}")
      agent M [mock/model]
        equips TestTool
      pipeline InterpolationDemo(query: String) -> Result:
        query |> TestTool.execute(q: "{{context.input.query}}", message: "Hello {{context.input.query}}")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    // Actually, we need a way to verify the tool was called with the interpolated arguments.
    // For now, let's just assert that a mock tool call returns what it received
    // Wait, tools aren't mockable in the same way, but let's test inline string interpolation in normal calls first.
  });

  test("String Interpolation in Arguments", async () => {
    const src = `
      agent M [mock/model]
      pipeline ArgDemo(name: String) -> Result:
        name |> M.prompt("Hello {{context.input.name}}")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    // Wait, the mock system doesn't dynamically echo the prompt, so how do we test this?
    // We can just rely on the LLM adapter throwing if the mock doesn't perfectly match the key, 
    // but the mock key doesn't include the arguments right now.
    // Let's modify LanglyRuntime to store the LAST PROMPT sent to M so we can assert on it.
    // Alternatively, we can patch `callLLM` dynamically in the test.
    let capturedPrompt = "";
    (rt as any).callLLM = async (agent: any, prompt: string) => {
      capturedPrompt = prompt;
      return "mocked";
    };

    await rt.execute("ArgDemo", { name: "Alice" });
    expect(capturedPrompt).toBe("Hello Alice");
  });

  test("Retry Directive: should retry on failure", async () => {
    const src = `
      @retry(3, 1s)
      pipeline RetryDemo(x: String) -> Result:
        x |> System.FlakyCall()
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    
    let calls = 0;
    (rt as any).executeSystemCall = (stage: any, ctx: any) => {
      if (stage.method === "FlakyCall") {
        calls++;
        if (calls < 3) throw new Error("Flaky error");
        return "Success!";
      }
      throw new Error("Unknown method");
    };

    const result = await rt.execute("RetryDemo", { x: "start" });
    expect(result).toBe("Success!");
    expect(calls).toBe(3);
  });
});
