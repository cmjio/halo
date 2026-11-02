import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser/index";
import type { CallStage, ExpressionStage } from "../src/parser/types";

describe("Langly Parser", () => {
  // ── Helper ────

  async function readExample(name: string): Promise<string> {
    return await Bun.file(`${import.meta.dir}/../examples/${name}`).text();
  }

  // ── Build-Up Examples (01-18) ────

  test("parses 01-hello.halo without errors", async () => {
    const result = parse(await readExample("01-hello.halo"));
    expect(result.errors).toEqual([]);
  });

  test("01-hello.halo produces a agent declaration for Greeter", async () => {
    const ast = parse(await readExample("01-hello.halo"));
    expect(ast.agents).toHaveLength(1);
    expect(ast.pipelines).toHaveLength(1);
    const agent = ast.agents[0]!;
    expect(agent.name).toBe("Greeter");
    expect(agent.modelId).toBe("gemini-3-1-pro");
    expect(agent.params).toEqual({ temp: "0.7" });
  });

  test("01-hello.halo produces a pipeline declaration for HelloWorld", async () => {
    const ast = parse(await readExample("01-hello.halo"));
    const pipeline = ast.pipelines[0]!;
    expect(pipeline.name).toBe("HelloWorld");
    expect(pipeline.params).toEqual([{ name: "name", type: "String" }]);
    expect(pipeline.returnType).toBe("Result");
  });

  test("01-hello.halo pipeline has 3 stages", async () => {
    const ast = parse(await readExample("01-hello.halo"));
    const stages = ast.pipelines[0]!.pipeline;
    expect(stages).toHaveLength(3);
    expect((stages[0] as ExpressionStage).kind).toBe("expression");
    expect((stages[1] as CallStage).kind).toBe("call");
    expect((stages[2] as CallStage).kind).toBe("call");
  });

  test("parses 02-policies.halo without errors", async () => {
    const result = parse(await readExample("02-policies.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 03-tools.halo without errors", async () => {
    const result = parse(await readExample("03-tools.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 04-params-and-context.halo without errors", async () => {
    const result = parse(await readExample("04-params-and-context.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 05-fanout.halo without errors", async () => {
    const result = parse(await readExample("05-fanout.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 06-gates.halo without errors", async () => {
    const result = parse(await readExample("06-gates.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 07-interrupts-and-listeners.halo without errors", async () => {
    const result = parse(await readExample("07-interrupts-and-listeners.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 08-store.halo without errors", async () => {
    const result = parse(await readExample("08-store.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 09-directives.halo without errors", async () => {
    const result = parse(await readExample("09-directives.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 10-named-args.halo without errors", async () => {
    const result = parse(await readExample("10-named-args.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 11-context-flow.halo without errors", async () => {
    const result = parse(await readExample("11-context-flow.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 12-multiple-agents.halo without errors", async () => {
    const result = parse(await readExample("12-multiple-agents.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 13-deep-context.halo without errors", async () => {
    const result = parse(await readExample("13-deep-context.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 14-env-vars.halo without errors", async () => {
    const result = parse(await readExample("14-env-vars.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 15-shadow-agents.halo without errors", async () => {
    const result = parse(await readExample("15-shadow-agents.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 16-retry-checkpoint.halo without errors", async () => {
    const result = parse(await readExample("16-retry-checkpoint.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 17-rest-tool.halo without errors", async () => {
    const result = parse(await readExample("17-rest-tool.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 18-vectorstore.halo without errors", async () => {
    const result = parse(await readExample("18-vectorstore.halo"));
    expect(result.errors).toEqual([]);
  });

  // ── Advanced Examples (20-32) ────

  test("parses 20-role-founder.halo without errors", async () => {
    const result = parse(await readExample("20-role-founder.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 21-role-software-engineer.halo without errors", async () => {
    const result = parse(await readExample("21-role-software-engineer.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 22-role-ux-designer.halo without errors", async () => {
    const result = parse(await readExample("22-role-ux-designer.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 23-role-ux-researcher.halo without errors", async () => {
    const result = parse(await readExample("23-role-ux-researcher.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 24-role-qa-engineer.halo without errors", async () => {
    const result = parse(await readExample("24-role-qa-engineer.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 25-role-product-manager.halo without errors", async () => {
    const result = parse(await readExample("25-role-product-manager.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 30-control-moderation.halo without errors", async () => {
    const result = parse(await readExample("30-control-moderation.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 31-power-analyst-swarm.halo without errors", async () => {
    const result = parse(await readExample("31-power-analyst-swarm.halo"));
    expect(result.errors).toEqual([]);
  });

  test("parses 32-adapter-router-demo.halo without errors", async () => {
    const result = parse(await readExample("32-adapter-router-demo.halo"));
    expect(result.errors).toEqual([]);
  });

  // ── Grammar Review Fixes ────

  test("named arguments in callExpr (review fix #1)", () => {
    const ast = parse(`
agent M [openai/gpt-4]
pipeline Named(x: String) -> Result:
  x |> Tool.execute(action: "create", asset: "logo.svg", max: 12)`);
    expect(ast.errors).toEqual([]);
    const stage = ast.pipelines[0]!.pipeline.at(1) as CallStage;
    expect(stage.kind).toBe("call");
    expect(stage.callee).toBe("Tool");
    expect(stage.method).toBe("execute");
    expect(stage.namedArgs).toEqual({ action: "create", asset: "logo.svg", max: "12" });
    expect(stage.args).toEqual([]);
  });

  test("mixed positional and named args", () => {
    const ast = parse(`
agent M [openai/gpt-4]
pipeline Mixed(x: String) -> Result:
  x |> M.transform(context.data.input, target: "en")`);
    expect(ast.errors).toEqual([]);
    const stage = ast.pipelines[0]!.pipeline.at(1) as CallStage;
    expect(stage.kind).toBe("call");
    expect(stage.namedArgs).toEqual({ target: "en" });
  });

  test("phantom arrow => in gate is consumed (review fix #2)", () => {
    const ast = parse(`
agent M [openai/gpt-4]
pipeline Arrow(x: String) -> Result:
  x
    |? (context.data.ok == true) =>
    |> System.Print()`);
    expect(ast.errors).toEqual([]);
    const stages = ast.pipelines[0]!.pipeline;
    const gate = stages.find(s => s.kind === "gate");
    expect(gate).toBeDefined();
    expect((gate! as any).condition).toBeDefined();
    expect(stages.some(s => s.kind === "call")).toBe(true);
  });

  test("phantom arrow => is truly present in token pipeline", () => {
    const astWithout = parse(`
agent M [openai/gpt-4]
pipeline Arrow(x: String) -> Result:
  x
    |? (context.data.ok == true)
    |> System.Print()`);
    expect(astWithout.errors).toEqual([]);
    const astWith = parse(`
agent M [openai/gpt-4]
pipeline Arrow(x: String) -> Result:
  x
    |? (context.data.ok == true) =>
    |> System.Print()`);
    expect(astWith.errors).toEqual([]);
    expect(astWith.pipelines[0]!.pipeline.map(s => s.kind)).toEqual(
      astWithout.pipelines[0]!.pipeline.map(s => s.kind),
    );
  });

  test("deep context traversal works (review fix #3)", () => {
    const ast = parse(`
agent M [openai/gpt-4]
pipeline Deep(x: String) -> Result:
  x
    |? (context.data.user.profile.risk_score > 90)
    |> System.Print()`);
    expect(ast.errors).toEqual([]);
    const gate = ast.pipelines[0]!.pipeline.find(s => s.kind === "gate") as any;
    expect(gate).toBeDefined();
    expect(gate.condition).toContain("context.data.user.profile.risk_score");
  });
});
