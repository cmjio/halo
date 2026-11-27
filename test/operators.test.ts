import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime } from "../src/runtime/runtime";
import type { GateStage, LoopStage } from "../src/parser/types";

const quiet = { log() {}, warn() {} };
const HEAD = `agent C [openai/gpt-4o]\npipeline P(x: String) -> Result:\n  x\n    |> C.prompt("a") as tests\n`;
const last = (src: string) => parse(src).pipelines[0]!.pipeline.at(-1)!;
const messages = (src: string, severity: "error" | "warning") => validate(parse(src)).filter((d) => d.severity === severity).map((d) => d.message);

describe("a mistyped operator", () => {
  test("is one error that names it and what was probably meant, not a cascade", () => {
    const errors = (line: string) => parse(HEAD + line + "\n    |> C.prompt()\n").errors;
    expect(errors("    |< loop(C, (x == \"a\"))")).toEqual(['[5:4] "|<" is not a stage operator; did you mean |<> loop(...)? A stage starts with one of: |> call, |? gate or branch, |* fan-out or each, |! yield, |<> loop, ~> listen']);
    expect(errors("    |- C.prompt()")[0]).toContain('"|-" is not a stage operator; did you mean |>?');
    expect(errors("    |map C.prompt()")[0]).toContain('"|map" is not a stage operator; did you mean |> map(...)?');
    expect(errors("    |map C.prompt()")).toHaveLength(1);
  });

  test("a bare | (a union type, say) is explained", () => {
    expect(parse(`schema S { a: String | Number }`).errors[0]).toContain(`"|" on its own isn't an operator`);
  });

  test("|| in a condition and every real operator still lex as before", () => {
    const src = HEAD + `    |? (x == "a" || !(x == "b"))\n    |* { C.a(), C.b() }\n    |! yield("ok?")\n    ~> listen(Slack.Reaction)\n    |<> loop(C, (x != "a"))\n`;
    expect(parse(src).errors).toEqual([]);
  });
});

describe("loop's condition", () => {
  test("is written in parentheses like a gate's, and the quoted form still works", () => {
    const paren = last(HEAD + `    |<> loop(C, (context.data.tests.exitCode != 0 && x == "y"), max: 2) as n`) as LoopStage;
    expect(paren).toMatchObject({ kind: "loop", target: "C", condition: 'context.data.tests.exitCode != 0 && x == "y"', bind: "n" });
    expect(paren.quoted).toBeUndefined();
    expect(paren.expr).toBeDefined();
    const quoted = last(HEAD + `    |<> loop(C, "context.data.tests.exitCode != 0")`) as LoopStage;
    expect(quoted).toMatchObject({ condition: "context.data.tests.exitCode != 0", quoted: true });
  });

  test("an option other than max is an error, with max suggested for a near miss", () => {
    expect(messages(HEAD + `    |<> loop(C, (x != "a"), mx: 2)`, "error")).toEqual(['Pipeline "P": loop(...) has no option "mx"; did you mean max?']);
  });

  test("runs the same either way", async () => {
    for (const cond of [`(context.data.tests != "ok")`, `"context.data.tests != 'ok'"`]) {
      let n = 0;
      const rt = new HaloRuntime({ logger: quiet, threadPath: ":memory:" }).load(parse(HEAD + `    |<> loop(C, ${cond}, max: 3) as tries`));
      rt.mockAll({ "C.prompt": () => (++n < 3 ? "no" : "ok") });
      const r = await rt.run("P", { x: "1" });
      expect(r.status).toBe("completed");
      expect(r.context.data.tries).toBe(2);
    }
  });
});

test("a => after a gate's condition is a warning: it does nothing", () => {
  const stage = parse(HEAD + `    |? (x == "a") =>\n    |> C.prompt()`).pipelines[0]!.pipeline.find((s) => s.kind === "gate") as GateStage;
  expect(stage.arrow).toBe(true);
  expect(messages(HEAD + `    |? (x == "a") =>\n    |> C.prompt()`, "warning")[0]).toContain("the => after |? (x == \"a\") does nothing");
  expect(messages(HEAD + `    |? (x == "a")\n    |> C.prompt()`, "warning")).toEqual([]);
});

describe("Result<T>", () => {
  const src = `schema Reply {\n  text: String\n}\nagent A [openai/gpt-4o]\npipeline P(x: String) -> Result<Reply>:\n  x |> A.prompt("hi")\npipeline L(x: String) -> Array<Result<Reply>>:\n  x |> A.prompt("hi")\npipeline U(x: String) -> Result:\n  x |> A.prompt("hi")\n`;
  const run = async (pipeline: string, answer: string) => {
    const rt = new HaloRuntime({ logger: quiet, threadPath: ":memory:" }).load(parse(src));
    rt.mockAll({ "A.prompt": answer });
    return rt.run(pipeline, { x: "1" });
  };

  test("checks the output as T, nested too; bare Result checks nothing", async () => {
    expect((await run("P", '{"text": "ok"}')).output).toEqual({ text: "ok" });
    await expect(run("P", '{"txt": "ok"}')).rejects.toThrow('missing field "text"');
    await expect(run("L", '[{"text": "a"}, {"text": 2}]')).rejects.toThrow("output[1].text should be a String");
    expect((await run("U", "anything at all")).output).toBe("anything at all");
  });

  test("takes exactly one type, and has no error type", () => {
    expect(messages(src, "error")).toEqual([]);
    expect(messages(`agent A [openai/gpt-4o]\npipeline P(x: String) -> Result<String, String>:\n  x |> A.prompt("hi")`, "error")).toEqual([
      'Pipeline "P": return type: Result<...> takes one type, the output\'s (Result<Reply>); it has no error type, because a failed run is an error, not a value',
    ]);
  });
});
