import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser/index";
import type { CallStage, ExpressionStage } from "../src/parser/types";

describe("Langly Parser", () => {
  // ── Helper ────

  async function readExample(name: string): Promise<string> {
    return await Bun.file(`${import.meta.dir}/../examples/${name}`).text();
  }

  // ── Build-Up Examples (01-18) ────

  test("parses 01-hello.ly without errors", async () => {
    const result = parse(await readExample("01-hello.ly"));
    expect(result.errors).toEqual([]);
  });

  test("01-hello.ly produces a mind declaration for Greeter", async () => {
    const ast = parse(await readExample("01-hello.ly"));
    expect(ast.minds).toHaveLength(1);
    expect(ast.streams).toHaveLength(1);
    const mind = ast.minds[0]!;
    expect(mind.name).toBe("Greeter");
    expect(mind.modelId).toBe("gemini-3-1-pro");
    expect(mind.params).toEqual({ temp: "0.7" });
  });

  test("01-hello.ly produces a stream declaration for HelloWorld", async () => {
    const ast = parse(await readExample("01-hello.ly"));
    const stream = ast.streams[0]!;
    expect(stream.name).toBe("HelloWorld");
    expect(stream.params).toEqual([{ name: "name", type: "String" }]);
    expect(stream.returnType).toBe("Result");
  });

  test("01-hello.ly pipeline has 3 stages", async () => {
    const ast = parse(await readExample("01-hello.ly"));
    const stages = ast.streams[0]!.pipeline;
    expect(stages).toHaveLength(3);
    expect((stages[0] as ExpressionStage).kind).toBe("expression");
    expect((stages[1] as CallStage).kind).toBe("call");
    expect((stages[2] as CallStage).kind).toBe("call");
  });

  test("parses 02-guardrails.ly without errors", async () => {
    const result = parse(await readExample("02-guardrails.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 03-tools.ly without errors", async () => {
    const result = parse(await readExample("03-tools.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 04-params-and-context.ly without errors", async () => {
    const result = parse(await readExample("04-params-and-context.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 05-fanout.ly without errors", async () => {
    const result = parse(await readExample("05-fanout.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 06-gates.ly without errors", async () => {
    const result = parse(await readExample("06-gates.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 07-interrupts-and-listeners.ly without errors", async () => {
    const result = parse(await readExample("07-interrupts-and-listeners.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 08-memory.ly without errors", async () => {
    const result = parse(await readExample("08-memory.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 09-directives.ly without errors", async () => {
    const result = parse(await readExample("09-directives.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 10-named-args.ly without errors", async () => {
    const result = parse(await readExample("10-named-args.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 11-context-flow.ly without errors", async () => {
    const result = parse(await readExample("11-context-flow.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 12-multiple-minds.ly without errors", async () => {
    const result = parse(await readExample("12-multiple-minds.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 13-deep-context.ly without errors", async () => {
    const result = parse(await readExample("13-deep-context.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 14-env-vars.ly without errors", async () => {
    const result = parse(await readExample("14-env-vars.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 15-shadow-minds.ly without errors", async () => {
    const result = parse(await readExample("15-shadow-minds.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 16-retry-checkpoint.ly without errors", async () => {
    const result = parse(await readExample("16-retry-checkpoint.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 17-rest-tool.ly without errors", async () => {
    const result = parse(await readExample("17-rest-tool.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 18-vectorstore.ly without errors", async () => {
    const result = parse(await readExample("18-vectorstore.ly"));
    expect(result.errors).toEqual([]);
  });

  // ── Advanced Examples (20-32) ────

  test("parses 20-role-founder.ly without errors", async () => {
    const result = parse(await readExample("20-role-founder.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 21-role-software-engineer.ly without errors", async () => {
    const result = parse(await readExample("21-role-software-engineer.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 22-role-ux-designer.ly without errors", async () => {
    const result = parse(await readExample("22-role-ux-designer.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 23-role-ux-researcher.ly without errors", async () => {
    const result = parse(await readExample("23-role-ux-researcher.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 24-role-qa-engineer.ly without errors", async () => {
    const result = parse(await readExample("24-role-qa-engineer.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 25-role-product-manager.ly without errors", async () => {
    const result = parse(await readExample("25-role-product-manager.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 30-control-moderation.ly without errors", async () => {
    const result = parse(await readExample("30-control-moderation.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 31-power-analyst-swarm.ly without errors", async () => {
    const result = parse(await readExample("31-power-analyst-swarm.ly"));
    expect(result.errors).toEqual([]);
  });

  test("parses 32-adapter-router-demo.ly without errors", async () => {
    const result = parse(await readExample("32-adapter-router-demo.ly"));
    expect(result.errors).toEqual([]);
  });

  // ── Grammar Review Fixes ────

  test("named arguments in callExpr (review fix #1)", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream Named(x: String) -> Result:
  x |> Tool.execute(action: "create", asset: "logo.svg", max: 12)`);
    expect(ast.errors).toEqual([]);
    const stage = ast.streams[0]!.pipeline.at(1) as CallStage;
    expect(stage.kind).toBe("call");
    expect(stage.callee).toBe("Tool");
    expect(stage.method).toBe("execute");
    expect(stage.namedArgs).toEqual({ action: "create", asset: "logo.svg", max: "12" });
    expect(stage.args).toEqual([]);
  });

  test("mixed positional and named args", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream Mixed(x: String) -> Result:
  x |> M.transform(context.data.input, target: "en")`);
    expect(ast.errors).toEqual([]);
    const stage = ast.streams[0]!.pipeline.at(1) as CallStage;
    expect(stage.kind).toBe("call");
    expect(stage.namedArgs).toEqual({ target: "en" });
  });

  test("phantom arrow => in gate is consumed (review fix #2)", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream Arrow(x: String) -> Result:
  x
    |? (context.data.ok == true) =>
    |> System.Print()`);
    expect(ast.errors).toEqual([]);
    const stages = ast.streams[0]!.pipeline;
    const gate = stages.find(s => s.kind === "gate");
    expect(gate).toBeDefined();
    expect((gate! as any).condition).toBeDefined();
    expect(stages.some(s => s.kind === "call")).toBe(true);
  });

  test("phantom arrow => is truly present in token stream", () => {
    const astWithout = parse(`
mind M [openai/gpt-4]
stream Arrow(x: String) -> Result:
  x
    |? (context.data.ok == true)
    |> System.Print()`);
    expect(astWithout.errors).toEqual([]);
    const astWith = parse(`
mind M [openai/gpt-4]
stream Arrow(x: String) -> Result:
  x
    |? (context.data.ok == true) =>
    |> System.Print()`);
    expect(astWith.errors).toEqual([]);
    expect(astWith.streams[0]!.pipeline.map(s => s.kind)).toEqual(
      astWithout.streams[0]!.pipeline.map(s => s.kind),
    );
  });

  test("deep context traversal works (review fix #3)", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream Deep(x: String) -> Result:
  x
    |? (context.data.user.profile.risk_score > 90)
    |> System.Print()`);
    expect(ast.errors).toEqual([]);
    const gate = ast.streams[0]!.pipeline.find(s => s.kind === "gate") as any;
    expect(gate).toBeDefined();
    expect(gate.condition).toContain("context.data.user.profile.risk_score");
  });
});
