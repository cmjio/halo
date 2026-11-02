import { test, expect, describe } from "bun:test";
import { parse, validate } from "../src/parser/index";
import { compile } from "../src/index";
import type { CallStage, GateStage, ListenStage } from "../src/parser/types";

const messages = (src: string, severity?: "error" | "warning") =>
  validate(parse(src))
    .filter((d) => !severity || d.severity === severity)
    .map((d) => d.message);

describe("validate", () => {
  test("a clean program has no diagnostics", () => {
    expect(messages(`policy G : MaxWords(10)\nagent M [openai/gpt-4o]\n  requires G\npipeline S(x: String) -> Result:\n  x |> M.prompt("hi {{x}}") as y |? (context.data.y != null) |> System.Print()`)).toEqual([]);
  });

  test("undefined policies, tools, callees, and variables are errors", () => {
    const errs = messages(
      `agent M [openai/gpt-4o]
         equips Nope
         requires Missing
       pipeline S(x: String) -> Result:
         y |> Ghost.prompt() |> System.Teleport() |> Other()`,
      "error",
    );
    expect(errs).toEqual([
      'Agent "M" requires undefined policy "Missing"',
      'Agent "M" equips undefined tool "Nope"',
      'Pipeline "S": undefined variable "y"',
      'Pipeline "S": unknown callee "Ghost" in Ghost.prompt(...)',
      'Pipeline "S": unknown System method "Teleport"',
      'Pipeline "S": "Other(...)" is not a defined pipeline',
    ]);
  });

  test("using a tool a agent does not equip is an error", () => {
    expect(messages(`tool T : REST("x.com")\nagent M [openai/gpt-4o]\npipeline S(x: String) -> Result:\n  x |> M.fetch(tool: T)`, "error")).toEqual([
      'Pipeline "S": agent "M" is not equipped with tool "T" (add `equips T`)',
    ]);
  });

  test("duplicate and reserved names are errors", () => {
    expect(messages(`agent A [openai/gpt-4o]\ntool A : REST("x.com")\nagent System [openai/gpt-4o]`, "error")).toEqual([
      'Duplicate declaration "A" (already declared as tool)',
      '"System" is reserved and cannot be declared',
    ]);
  });

  test("reading context.data keys nobody writes is a warning, with the fix", () => {
    expect(messages(`agent M [openai/gpt-4o]\npipeline S(x: String) -> Result:\n  x |> M.prompt(context.data.summary) |> M.prompt() as summary`)).toEqual([
      'Pipeline "S": context.data.summary is never set before it is read (bind a result with `as summary`)',
    ]);
  });

  test("unenforceable policies and bad directives are reported", () => {
    expect(
      messages(`policy G : Tone("calm") & Block(Gossip) & Redact(PII) & Frobnicate()
        @shadow(Nobody)
        @timeout(soon)
        agent M [openai/gpt-4o]
        @retry(many)
        @fast
        pipeline S(x: String) -> Result:
          x |> M.prompt()`),
    ).toEqual([
      'Policy "G": Tone(...) is not enforced by the runtime yet',
      'Policy "G": Block(Gossip) is not a detectable category and is not enforced',
      'Policy "G": unknown rule Frobnicate(...) is ignored',
      '@shadow(Nobody) on "M": "Nobody" is not a defined agent or model, so it will never run',
      "@timeout needs one duration, e.g. @timeout(30s)",
      "@retry needs a count and optional delay, e.g. @retry(3, 2s)",
      "Unknown directive @fast is ignored",
    ]);
  });

  test("diagnostics carry source lines", () => {
    const [d] = validate(parse(`\n\nagent M [openai/gpt-4o]\n  requires Missing`));
    expect(d).toMatchObject({ severity: "error", line: 3, column: 0 });
  });

  test("compile() combines parse and validate", () => {
    expect(compile(`agent M [`).ok).toBe(false);
    expect(compile(`agent M [openai/gpt-4o]\n  requires X`).ok).toBe(false);
    expect(compile(`agent M [openai/gpt-4o]`).ok).toBe(true);
  });
});

describe("parser: syntax added for the runtime", () => {
  test("keywords work as named-arg keys and context segments", () => {
    const ast = parse(`pipeline S(x: String) -> Result:\n  x |> T.fetch(tool: A, context: context.data.tool, store: 1, pipeline: true)`);
    expect(ast.errors).toEqual([]);
    expect((ast.pipelines[0]!.pipeline[1] as CallStage).namedArgs).toEqual({ tool: "A", context: "context.data.tool", store: "1", pipeline: "true" });
  });

  test("`as` bindings on calls, fan-out items, yields, and listens", () => {
    const ast = parse(`pipeline S(x: String) -> Result:\n  x |> A.b() as one |* { A.c() as two, B } as both |! yield("ok?") as answer ~> listen(UI.Click) as click`);
    expect(ast.errors).toEqual([]);
    const [, call, fan, intr, listen] = ast.pipelines[0]!.pipeline as any[];
    expect([call.bind, fan.stages[0].bind, fan.bind, intr.bind, (listen as ListenStage).bind]).toEqual(["one", "two", "both", "answer", "click"]);
    expect(fan.stages[1]).toMatchObject({ callee: "B", method: "prompt", implicit: true });
  });

  test("conditions support && || ! null and grouping", () => {
    const ast = parse(`pipeline S(x: String) -> Result:\n  x |? (!(a == null) && (b > 1 || c <= -2.5))`);
    expect(ast.errors).toEqual([]);
    const gate = ast.pipelines[0]!.pipeline[1] as GateStage;
    expect(gate.condition).toBe("!(a == null) && (b > 1 || c <= -2.5)");
    expect(gate.expr.kind).toBe("and");
  });

  test("typed values keep literals distinct from references", () => {
    const ast = parse(`pipeline S(x: String) -> Result:\n  x |> M.p("lang", lang, 2s, [1, "a"], null, openai/gpt-4o)`);
    const call = ast.pipelines[0]!.pipeline[1] as CallStage;
    expect(call.argList.map((a) => a.value.kind)).toEqual(["string", "ref", "duration", "list", "null", "model"]);
    expect(call.args).toEqual(["lang", "lang", "2s", "[1, a]", "null", "openai/gpt-4o"]);
  });

  test("strings support escapes; block comments and trailing commas are allowed", () => {
    const ast = parse(`/* header\n comment */\nagent M [openai/gpt-4o, temp: 0.1,]\npipeline S(x: String,) -> Result:\n  x |> M.p("a\\"b\\nc", k: 1,)`);
    expect(ast.errors).toEqual([]);
    expect((ast.pipelines[0]!.pipeline[1] as CallStage).args).toEqual(['a"b\nc']);
  });

  test("model ids with dots and nested slashes; return type is optional", () => {
    const ast = parse(`agent A [together/meta-llama/Llama-3.1-8B-Instruct]\nagent B [gpt4]\npipeline S(x: String):\n  x |> A.p()`);
    expect(ast.errors).toEqual([]);
    expect(ast.agents.map((m) => m.modelId)).toEqual(["together/meta-llama/Llama-3.1-8B-Instruct", "gpt4"]);
    expect(ast.pipelines[0]!.returnType).toBe("");
  });

  test("lexer errors are reported, not silently dropped", () => {
    expect(parse(`agent M [openai/gpt-4o] #`).errors[0]).toContain("token recognition error");
  });

  test("branch and each: else must come last, loop variables must be new, options are checked", () => {
    const src = `agent M [openai/gpt-4o]
       pipeline S(xs: List, n: Number) -> Result:
         xs
           |? { else => M.a(), (n > 1) => M.b() }
           |* each(n in xs) => M.c(n)
           |* each(M in xs, parallel: true) => M.d()`;
    expect(messages(src, "error")).toEqual([
      `Pipeline "S": the else arm must come last in a branch`,
      `Pipeline "S": each(n in ...) reuses the name "n"; pick a new loop variable`,
      `Pipeline "S": each(M in ...) reuses the name "M"; pick a new loop variable`,
    ]);
    expect(messages(src, "warning")).toEqual([`Pipeline "S": each(...) has no option "parallel" (use concurrency: n or limit: n)`]);
  });

  test("the loop variable is in scope inside the loop only; branch and each results are tracked", () => {
    const warnings = messages(
      `agent M [openai/gpt-4o]
       pipeline S(xs: List) -> Result:
         xs
           |* each(item in xs) => M.c(context.data.item, "{{item.id}} {{index}}") as cs
           |? { (context.data.cs != null) => M.d() } as ds
           |> M.e(context.data.ds, context.data.M, context.data.item)`,
      "warning",
    );
    expect(warnings).toEqual([`Pipeline "S": context.data.item is never set before it is read (bind a result with \`as item\`)`]);
  });

  test("parses branch arms and each loops into typed stages", () => {
    const ast = parse(`agent M [openai/gpt-4o]
      pipeline S(xs: List) -> Result:
        xs
          |? { (context.data.x == 1) => M.a(), else => M.b(), } as picked
          |* each(item in context.data.list, concurrency: 3) => M.c(item) as cs`);
    expect(ast.errors).toEqual([]);
    const [, branch, each] = ast.pipelines[0]!.pipeline;
    expect(branch).toMatchObject({
      kind: "branch",
      bind: "picked",
      arms: [
        { condition: "context.data.x == 1", call: { callee: "M", method: "a" } },
        { call: { callee: "M", method: "b" } },
      ],
    });
    expect(each).toMatchObject({
      kind: "each",
      item: "item",
      list: { kind: "context", path: ["data", "list"] },
      options: [{ name: "concurrency", value: { kind: "number", value: 3 } }],
      call: { callee: "M", method: "c", argList: [{ value: { kind: "ref", path: ["item"] } }] },
      bind: "cs",
    });
    // An `as` inside an arm is a syntax error: bind the whole branch instead
    expect(parse(`pipeline S(x: String) -> R:\n  x |? { else => System.Log() as nope }`).errors).not.toEqual([]);
  });
});

