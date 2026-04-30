import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser/index";
import type {
  CallStage,
  ExpressionStage,
  GuardrailDeclaration,
  ToolDeclaration,
  MemoryDeclaration,
  Mind,
  StreamDeclaration,
  PipelineStage,
  GateStage,
  InterruptStage,
  FanOutStage,
  ListenStage,
} from "../src/parser/types";

// ============================================================
// GUARDRAIL tests
// ============================================================
describe("Guardrail declarations", () => {
  test("parses a simple guardrail", () => {
    const ast = parse(`guardrail Privacy : Redact(PII)`);
    expect(ast.errors).toEqual([]);
    expect(ast.guardrails).toHaveLength(1);
    const g = ast.guardrails[0] as GuardrailDeclaration;
    expect(g.name).toBe("Privacy");
    expect(g.rules).toEqual([{ name: "Redact", args: ["PII"] }]);
  });

  test("parses guardrail with multiple rules", () => {
    const ast = parse(`guardrail Privacy : Redact(PII) & Block(PromptInjection)`);
    expect(ast.errors).toEqual([]);
    const g = ast.guardrails[0] as GuardrailDeclaration;
    expect(g.rules).toEqual([
      { name: "Redact", args: ["PII"] },
      { name: "Block", args: ["PromptInjection"] },
    ]);
  });

  test("parses guardrail with string argument", () => {
    const ast = parse(`guardrail BrandSafe : Tone("Professional")`);
    expect(ast.errors).toEqual([]);
    const g = ast.guardrails[0] as GuardrailDeclaration;
    expect(g.name).toBe("BrandSafe");
    expect(g.rules).toEqual([{ name: "Tone", args: ["Professional"] }]);
  });

  test("parses guardrail with numeric argument", () => {
    const ast = parse(`guardrail Budget : MaxSpend(50.00)`);
    expect(ast.errors).toEqual([]);
    const g = ast.guardrails[0] as GuardrailDeclaration;
    expect(g.rules).toEqual([{ name: "MaxSpend", args: ["50.00"] }]);
  });

  test("multiple guardrails", () => {
    const ast = parse(`
guardrail BudgetCap : MaxSpend(5.00)
guardrail BrandSafe : Enforce(BrandGuide.JSON)
`);
    expect(ast.errors).toEqual([]);
    expect(ast.guardrails).toHaveLength(2);
    expect(ast.guardrails[0]!.name).toBe("BudgetCap");
    expect(ast.guardrails[1]!.name).toBe("BrandSafe");
  });
});

// ============================================================
// TOOL tests
// ============================================================
describe("Tool declarations", () => {
  test("parses a tool with dotted identifier argument", () => {
    const ast = parse(`tool CoreDB : PostgreSQL(Env.DB_URI)`);
    expect(ast.errors).toEqual([]);
    expect(ast.tools).toHaveLength(1);
    const t = ast.tools[0] as ToolDeclaration;
    expect(t.name).toBe("CoreDB");
    expect(t.provider).toBe("PostgreSQL");
    expect(t.args).toEqual(["Env.DB_URI"]);
  });

  test("parses a tool with string argument", () => {
    const ast = parse(`tool Figma : POST("api.figma.com/v1/render")`);
    expect(ast.errors).toEqual([]);
    const t = ast.tools[0] as ToolDeclaration;
    expect(t.name).toBe("Figma");
    expect(t.provider).toBe("POST");
    expect(t.args).toEqual(["api.figma.com/v1/render"]);
  });

  test("parses a tool with multiple args", () => {
    const ast = parse(`tool Search : VectorQuery(Env.PINECONE, "docs", 25)`);
    expect(ast.errors).toEqual([]);
    const t = ast.tools[0] as ToolDeclaration;
    expect(t.args).toEqual(["Env.PINECONE", "docs", "25"]);
  });
});

// ============================================================
// MEMORY tests
// ============================================================
describe("Memory declarations", () => {
  test("parses a memory with dotted idents and named param", () => {
    const ast = parse(`memory KnowledgeBase : VectorStore(Env.PINECONE_KEY, namespace: "engineering")`);
    expect(ast.errors).toEqual([]);
    expect(ast.memories).toHaveLength(1);
    const m = ast.memories[0] as MemoryDeclaration;
    expect(m.name).toBe("KnowledgeBase");
    expect(m.provider).toBe("VectorStore");
  });

  test("parses multiple memories", () => {
    const ast = parse(`
memory DocStore : VectorStore(Env.DB1)
memory LogStore : VectorStore(Env.DB2)`);
    expect(ast.errors).toEqual([]);
    expect(ast.memories).toHaveLength(2);
  });
});

// ============================================================
// MIND with modifiers (equips, requires)
// ============================================================
describe("Mind with equips and requires", () => {
  test("parses mind with equips", () => {
    const ast = parse(`
mind DataAnalyst [gemini-3-1-pro, temp: 0.1]
  equips Snowflake, PastTests`);
    expect(ast.errors).toEqual([]);
    const m = ast.minds[0] as Mind;
    expect(m.equips).toEqual(["Snowflake", "PastTests"]);
  });

  test("parses mind with requires", () => {
    const ast = parse(`
mind DataAnalyst [gemini-3-1-pro, temp: 0.1]
  requires BudgetCap`);
    expect(ast.errors).toEqual([]);
    const m = ast.minds[0] as Mind;
    expect(m.requires).toEqual(["BudgetCap"]);
  });

  test("parses mind with both equips and requires", () => {
    const ast = parse(`
mind DataAnalyst [gemini-3-1-pro]
  equips Snowflake, PastTests
  requires BudgetCap, BrandSafe`);
    expect(ast.errors).toEqual([]);
    const m = ast.minds[0] as Mind;
    expect(m.equips).toEqual(["Snowflake", "PastTests"]);
    expect(m.requires).toEqual(["BudgetCap", "BrandSafe"]);
  });

  test("multiple minds with modifiers", () => {
    const ast = parse(`
mind A [openai/gpt-4]
  equips Tool1
mind B [anthropic/claude-sonnet-4]
  equips Tool2, Tool3
  requires Guard1`);
    expect(ast.errors).toEqual([]);
    expect(ast.minds).toHaveLength(2);
    expect(ast.minds[0]!.equips).toEqual(["Tool1"]);
    expect(ast.minds[1]!.equips).toEqual(["Tool2", "Tool3"]);
    expect(ast.minds[1]!.requires).toEqual(["Guard1"]);
  });
});

// ============================================================
// COMPILER DIRECTIVES
// ============================================================
describe("Compiler directives", () => {
  test("parses @timeout on stream", () => {
    const ast = parse(`
mind M [openai/gpt-4]
@timeout(5m)
stream Fast(event: String) -> Result:
  event |> M.prompt("reply")`);
    expect(ast.errors).toEqual([]);
    const s = ast.streams[0] as StreamDeclaration;
    expect(s.directives).toContainEqual({ name: "timeout", value: "5m" });
  });

  test("parses @shadow on mind", () => {
    const ast = parse(`
@shadow(Designer_V2_Experimental)
mind UXDesigner [gemini-3-1-flash, temp: 0.7]
  equips Figma`);
    expect(ast.errors).toEqual([]);
    const m = ast.minds[0] as Mind;
    expect(m.directives).toContainEqual({ name: "shadow", value: "Designer_V2_Experimental" });
  });

  test("parses @retry directive", () => {
    const ast = parse(`
mind M [openai/gpt-4]
@retry(3, 2s)
stream Resilient(x: String) -> Result:
  x |> M.prompt("try")`);
    expect(ast.errors).toEqual([]);
    const s = ast.streams[0] as StreamDeclaration;
    expect(s.directives).toContainEqual({ name: "retry", value: "3, 2s" });
  });

  test("parses @checkpoint directive", () => {
    const ast = parse(`
mind M [openai/gpt-4]
@checkpoint
stream Check(x: String) -> Result:
  x |> M.prompt("go")`);
    expect(ast.errors).toEqual([]);
    const s = ast.streams[0] as StreamDeclaration;
    expect(s.directives).toContainEqual({ name: "checkpoint", value: "" });
  });

  test("multiple directives on stream", () => {
    const ast = parse(`
mind M [openai/gpt-4]
@timeout(5m)
@checkpoint
@retry(3, 1s)
stream Multi(x: String) -> Result:
  x |> M.prompt("go")`);
    expect(ast.errors).toEqual([]);
    const s = ast.streams[0] as StreamDeclaration;
    expect(s.directives).toHaveLength(3);
  });
});

// ============================================================
// PIPE OPERATORS: |? (Gate), |! (Interrupt), |* (Fan-Out), ~> (Listen)
// ============================================================
describe("Pipe operators", () => {
  // --- |? Gate (conditional) ---
  test("parses |? conditional gate with comparison", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream Gate(x: String) -> Result:
  x
    |> M.prompt("assess risk")
    |? (context.data.risk_score > 90)
    |> System.Print()`);
    expect(ast.errors).toEqual([]);
    const stages = ast.streams[0]!.pipeline;
    const gate = stages.find(s => s.kind === "gate") as GateStage | undefined;
    expect(gate).toBeDefined();
    const cond = gate!.condition.replace(/\s+/g, "");
    expect(cond).toBe("context.data.risk_score>90");
  });

  test("parses |? gate with boolean comparison", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream GateBool(x: String) -> Result:
  x
    |? (context.data.found == true) =>
    |> System.Print()`);
    // This may fail due to '=>' not being a token; test just checks parsing works
    expect(ast.errors).toEqual([]);
    const stages = ast.streams[0]!.pipeline;
    const gate = stages.find(s => s.kind === "gate") as GateStage | undefined;
    expect(gate).toBeDefined();
  });

  // --- |! Interrupt ---
  test("parses |! interrupt with yield", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream Interrupt(x: String) -> Result:
  x
    |> M.prompt("process")
    |! yield(channel: Slack, msg: "approve?")
    ~> listen(Slack.Interaction)`);
    expect(ast.errors).toEqual([]);
    const stages = ast.streams[0]!.pipeline;
    const intr = stages.find(s => s.kind === "interrupt") as InterruptStage | undefined;
    expect(intr).toBeDefined();
    expect(intr!.callee).toBe("yield");
  });

  // --- |* Fan-Out ---
  test("parses |* fan-out with block", () => {
    const ast = parse(`
mind A [openai/gpt-4]
mind B [openai/gpt-4]
stream FanOut(x: String) -> Result:
  x
    |* { A.prompt("task1"), B.prompt("task2") }
    |> System.Print()`);
    expect(ast.errors).toEqual([]);
    const stages = ast.streams[0]!.pipeline;
    const fanout = stages.find(s => s.kind === "fanout") as FanOutStage | undefined;
    expect(fanout).toBeDefined();
    expect(fanout!.stages).toHaveLength(2);
  });

  test("parses |* fan-out with mind names only", () => {
    const ast = parse(`
mind A [openai/gpt-4]
mind B [openai/gpt-4]
mind C [openai/gpt-4]
stream FanNames(x: String) -> Result:
  x
    |* { A, B, C }
    |> System.Print()`);
    expect(ast.errors).toEqual([]);
    const stages = ast.streams[0]!.pipeline;
    const fanout = stages.find(s => s.kind === "fanout") as FanOutStage | undefined;
    expect(fanout).toBeDefined();
    expect(fanout!.stages).toHaveLength(3);
  });

  // --- ~> Listen ---
  test("parses ~> listen operator with dotted id", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream Listen(x: String) -> Result:
  x
    |> M.prompt("wait")
    ~> listen(UI.Button_Click)`);
    expect(ast.errors).toEqual([]);
    const stages = ast.streams[0]!.pipeline;
    const listen = stages.find(s => s.kind === "listen") as ListenStage | undefined;
    expect(listen).toBeDefined();
    expect(listen!.target).toBe("UI.Button_Click");
  });
});

// ============================================================
// CONTEXT REFERENCES
// ============================================================
describe("Context references", () => {
  test("parses context.data in call arg", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream CtxData(x: String) -> Result:
  x
    |> Figma.execute(context.data.ui_layout)`);
    expect(ast.errors).toEqual([]);
  });

  test("parses context.meta in condition", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream CtxMeta(x: String) -> Result:
  x
    |> M.prompt("analyze")
    |? (context.meta.error != null)`);
    expect(ast.errors).toEqual([]);
  });

  test("parses context.trace reference", () => {
    const ast = parse(`
mind M [openai/gpt-4]
stream CtxTrace(x: String) -> Result:
  x
    |> M.prompt(context.trace)`);
    expect(ast.errors).toEqual([]);
  });
});

// ============================================================
// FULL INTEGRATION — the spec's omni-workflow example
// ============================================================
describe("Full spec example (omni-workflow)", () => {
  test("parses the complete omni-workflow from spec", () => {
    const src = `
guardrail BudgetCap : MaxSpend(5.00)
guardrail BrandSafe : Tone("Professional") & Enforce(BrandGuide.JSON)
memory PastTests : VectorStore(Env.MILVUS_KEY)
tool Snowflake : SQL(Env.SNOWFLAKE_KEY)
tool Figma : POST("api.figma.com/render")

mind DataScientist [gemini-3-1-pro, temp: 0.0]
  equips Snowflake, PastTests
  requires BudgetCap

@shadow(Designer_V2)
mind UXDesigner [gemini-3-1-flash, temp: 0.7]
  equips Figma
  requires BrandSafe

@timeout(5m)
stream ResolveSalesDrop(event: String) -> Result:
  event
    |* { DataScientist.prompt("query data"), DataScientist.prompt("query memory") }
    |? (context.data.found_root_cause == true)
    |> UXDesigner.prompt("Design new UI")
    |! yield(channel: Slack, msg: "Approve?")
    ~> listen(Slack.Interaction)
    |? (context.data.slack_response == "approve")
    |> System.TriggerWebhook("CI/CD_Deploy")
`;
    const ast = parse(src);
    expect(ast.errors).toEqual([]);
    expect(ast.guardrails).toHaveLength(2);
    expect(ast.tools).toHaveLength(2);
    expect(ast.memories).toHaveLength(1);
    expect(ast.minds).toHaveLength(2);
    expect(ast.streams).toHaveLength(1);

    // Check minds have modifiers
    expect(ast.minds[0]!.equips).toEqual(["Snowflake", "PastTests"]);
    expect(ast.minds[0]!.requires).toEqual(["BudgetCap"]);
    expect(ast.minds[1]!.directives).toContainEqual({ name: "shadow", value: "Designer_V2" });

    // Check stream has directives and all pipe types
    const stream = ast.streams[0]!;
    expect(stream.directives).toContainEqual({ name: "timeout", value: "5m" });
    expect(stream.pipeline.some(s => s.kind === "fanout")).toBe(true);
    expect(stream.pipeline.some(s => s.kind === "gate")).toBe(true);
    expect(stream.pipeline.some(s => s.kind === "interrupt")).toBe(true);
    expect(stream.pipeline.some(s => s.kind === "listen")).toBe(true);
  });
});
