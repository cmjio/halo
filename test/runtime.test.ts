import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser/index";
import { HaloRuntime } from "../src/runtime/runtime";

describe("Langly Runtime", () => {
  // ── Helper ────//

  async function readExample(name: string): Promise<string> {
    return await Bun.file(`${import.meta.dir}/../examples/${name}`).text();
  }

  // ── Basic Tests ────//

  test("loads 01-hello.halo AST", async () => {
    const savedKey = Bun.env.LANGLY_API_KEY;
    delete Bun.env.LANGLY_API_KEY;
    const ast = parse(await readExample("01-hello.halo"));
    const rt = new HaloRuntime({ env: {} });
    rt.load(ast);
    await expect(
      rt.execute("HelloWorld", { name: "Alice" }),
    ).rejects.toThrow("No API key");
    if (savedKey) Bun.env.LANGLY_API_KEY = savedKey;
  });

  test("executes HelloWorld pipeline (mocked)", async () => {
    const ast = parse(await readExample("01-hello.halo"));
    const rt = new HaloRuntime();
    rt.load(ast).mockAll({
      "Greeter.prompt": "Hello, Alice! Welcome to coding!",
    });

    const result = await rt.execute("HelloWorld", { name: "Alice" });
    expect(result).toBe("Hello, Alice! Welcome to coding!");
  });

  test("System.Print logs to stdout", async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: unknown) => logs.push(String(msg));

    try {
      const ast = parse(await readExample("01-hello.halo"));
      const rt = new HaloRuntime();
      rt.load(ast).mockAll({
        "Greeter.prompt": "Greetings, Bob!",
      });

      await rt.execute("HelloWorld", { name: "Bob" });
      expect(logs).toContain("Greetings, Bob!");
    } finally {
      console.log = originalLog;
    }
  });

  test("throws on unknown pipeline", async () => {
    const rt = new HaloRuntime();
    await expect(rt.execute("NonExistent", {})).rejects.toThrow(
      'Pipeline "NonExistent" not found',
    );
  });

  test("throws on undefined variable", async () => {
    const ast = parse(`
agent M [openai/gpt-4]
pipeline Test(x: String) -> Result:
  x |> M.prompt("greet them") |> System.Print()
`);
    const rt = new HaloRuntime().mockAll({ "M.prompt": "hi" });
    rt.load(ast);
    await expect(rt.execute("Test", {})).rejects.toThrow(
      'Undefined variable "x"',
    );
  });

  test("throws when no API key and no mock", async () => {
    const savedKey = Bun.env.LANGLY_API_KEY;
    delete Bun.env.LANGLY_API_KEY;
    const ast = parse(await readExample("01-hello.halo"));
    const rt = new HaloRuntime({ env: {} });
    rt.load(ast);
    await expect(rt.execute("HelloWorld", { name: "Alice" })).rejects.toThrow(
      "No API key set",
    );
    if (savedKey) Bun.env.LANGLY_API_KEY = savedKey;
  });

  test("end-to-end: parse + load + execute with mock", async () => {
    const src = `
agent Quick [openai/gpt-4o, temp: 0.5]
pipeline Greet(person: String) -> Result:
  person
    |> Quick.prompt("Give a short greeting for this person.")
    |> System.Print()
`;
    const ast = parse(src);
    expect(ast.errors).toEqual([]);

    const rt = new HaloRuntime();
    rt
      .load(ast)
      .mockAll({ "Quick.prompt": "Hey there, World!" });

    const output = await rt.execute("Greet", { person: "World" });
    expect(output).toBe("Hey there, World!");
  });

  test("chained pipeline stages pass output sequentially (mocked)", async () => {
    const logs: string[] = [];
    const save = console.log;
    console.log = (m: unknown) => logs.push(String(m));

    try {
      const src = `
agent Step1 [openai/gpt-4]
agent Step2 [openai/gpt-4]
pipeline Chain2(x: String) -> Result:
  x
    |> Step1.translate("first")
    |> Step2.translate("second")
    |> System.Print()
`;
      const ast = parse(src);
      expect(ast.errors).toEqual([]);

      const rt = new HaloRuntime();
      rt
        .load(ast)
        .mockAll({
          "Step1.translate": "STEP1_RESULT",
          "Step2.translate": "FINAL_RESULT",
        });

      const result = await rt.execute("Chain2", { x: "hello" });
      expect(result).toBe("FINAL_RESULT");
      expect(logs).toContain("FINAL_RESULT");

      // Verify pipeline structure
      const pipelineDecl = ast.pipelines[0]!;
      const stages = pipelineDecl.pipeline;
      expect(stages).toHaveLength(4);

      // Stage 0: expression "x"
      const s0 = stages[0] as any;
      expect(s0).toBeDefined();
      expect(s0.kind).toBe("expression");
      expect(s0.value).toBe("x");

      // Stage 1: Step1.translate
      const s1 = stages[1] as any;
      expect(s1).toBeDefined();
      expect(s1.kind).toBe("call");
      expect(s1.callee).toBe("Step1");
      expect(s1.method).toBe("translate");

      // Stage 2: Step2.translate
      const s2 = stages[2] as any;
      expect(s2).toBeDefined();
      expect(s2.kind).toBe("call");
      expect(s2.callee).toBe("Step2");
      expect(s2.method).toBe("translate");

      // Stage 3: System.Print
      const s3 = stages[3] as any;
      expect(s3).toBeDefined();
      expect(s3.kind).toBe("call");
      expect(s3.callee).toBe("System");
      expect(s3.method).toBe("Print");
    } finally {
      console.log = save;
    }
  });

  test("real LLM call with API key", async () => {
    // Use whichever real key is available, with a cheap model from that provider.
    const env = Bun.env;
    const fallback = env.HALO_API_KEY || env.LANGLY_API_KEY;
    const pick = env.ANTHROPIC_API_KEY || fallback?.startsWith("sk-ant-")
      ? { model: "anthropic/claude-haiku-4-5", key: env.ANTHROPIC_API_KEY || fallback }
      : env.OPENAI_API_KEY || (fallback && fallback !== "test_key")
        ? { model: "openai/gpt-4o-mini", key: env.OPENAI_API_KEY || fallback }
        : undefined;
    if (!pick) {
      console.log("[SKIP] No ANTHROPIC_API_KEY, OPENAI_API_KEY, or HALO_API_KEY set — skipping real LLM call test");
      return;
    }

    const src = `
agent Test [${pick.model}, temp: 0.0]
pipeline Ping(msg: String) -> Result:
  msg |> Test.prompt("Echo this back verbatim, with nothing else:")
`;
    const ast = parse(src);
    const rt = new HaloRuntime({ apiKey: pick.key });
    rt.load(ast);

    const output = await rt.execute("Ping", { msg: "hello world" });
    expect(String(output).toLowerCase()).toContain("hello world");
  });
});
