import { test, expect, describe, afterAll } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, validate } from "../src/parser/index";
import type { LoopStage } from "../src/parser/types";
import {
  FileRunStore,
  HaloRuntime,
  LoopLimitError,
  PolicyViolation,
  SchemaValidationError,
  type MockRequest,
  type RuntimeConfig,
  type RuntimeEvent,
} from "../src/runtime/runtime";
import { SqliteTelemetry, toTelemetryRow } from "../src/runtime/telemetry";
import { getDiagnostics } from "../src/lsp/diagnostics";
import { getHover } from "../src/lsp/hover";
import { getCompletions } from "../src/lsp/completions";

const tmp = mkdtempSync(join(tmpdir(), "halo-features-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function rt(src: string, mocks: Record<string, unknown> = {}, config: RuntimeConfig = {}) {
  const ast = parse(src);
  expect(ast.errors).toEqual([]);
  return new HaloRuntime({ env: {}, vectorPath: ":memory:", checkpointDir: tmp, logger: { log() {}, warn() {} }, ...config }).load(ast).mockAll(mocks);
}

const messages = (src: string, severity?: "error" | "warning") =>
  validate(parse(src))
    .filter((d) => !severity || d.severity === severity)
    .map((d) => d.message);

/** A fake fetch that records requests and answers from a handler. */
function fakeFetch(handler: (url: URL, init: RequestInit, body: any) => unknown) {
  const calls: Array<{ url: URL; init: RequestInit; body: any }> = [];
  const fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const body = typeof init.body === "string" ? (() => { try { return JSON.parse(init.body as string); } catch { return init.body; } })() : undefined;
    calls.push({ url, init, body });
    const out = handler(url, init, body);
    return out instanceof Response ? out : Response.json(out);
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("parser: Halo declarations", () => {
  test("schemas, agent system prompts, generic types, and loops parse into typed AST nodes", () => {
    const ast = parse(`
      schema Team {
        users: Array<String>,
        lead: Person
        scores: Map<String, Number>
      }
      schema Person { name: String }
      agent SWE [openai/gpt-4o, temp: 0.1]
        system """
          You write careful code.
          Prefer small diffs.
        """
      agent Short [openai/gpt-4o-mini]
        system "Be brief."
      tool Shell : Bash()
      pipeline AutoDev(spec: String, tags: List<String>) -> Team:
        spec
          |> SWE.prompt("Draft code")
          |> Shell.run(command: "bun check")
          |<> loop(SWE, "context.data.Shell.run.exitCode != 0", max: 5) as tries
    `);
    expect(ast.errors).toEqual([]);
    expect(ast.schemas.map((s) => s.name)).toEqual(["Team", "Person"]);
    expect(ast.schemas[0]!.fields).toEqual([
      { name: "users", type: "Array<String>" },
      { name: "lead", type: "Person" },
      { name: "scores", type: "Map<String, Number>" },
    ]);
    expect(ast.agents[0]!.system).toBe("You write careful code.\nPrefer small diffs.");
    expect(ast.agents[1]!.system).toBe("Be brief.");
    expect(ast.pipelines[0]!.params).toEqual([{ name: "spec", type: "String" }, { name: "tags", type: "List<String>" }]);
    expect(ast.pipelines[0]!.returnType).toBe("Team");
    const loop = ast.pipelines[0]!.pipeline[3] as LoopStage;
    expect(loop).toMatchObject({ kind: "loop", target: "SWE", condition: "context.data.Shell.run.exitCode != 0", bind: "tries" });
    expect(loop.expr).toMatchObject({ kind: "compare", op: "!=" });
    expect(loop.options).toEqual([{ name: "max", value: { kind: "number", value: 5, raw: "5" } }]);
  });

  test("the system-prompt example's agents carry their prompts", async () => {
    const ast = parse(await Bun.file(`${import.meta.dir}/../examples/learn/19-system-prompts.halo`).text());
    expect(ast.errors).toEqual([]);
    const system = Object.fromEntries(ast.agents.map((a) => [a.name, a.system]));
    expect(system.Generic).toBeUndefined();
    expect(system.Translator).toStartWith("You are a professional translator.");
    expect(system.Analyst).toContain("\n");
  });
});

describe("validator: Halo checks", () => {
  test("schema fields need known types; loops need an earlier agent stage and a valid condition", () => {
    const src = `
      schema S { a: String, b: Strng, c: Array<Widget> }
      agent A [openai/gpt-4o]
      tool T : Bash()
      pipeline P(x: String) -> S:
        x
          |> A.go()
          |<> loop(T, "x == 1")
          |<> loop(A, "x ==", tries: 2)`;
    expect(messages(src, "error").slice(1)).toEqual([
      `Pipeline "P": loop(T, ...) needs an agent to retry with, but "T" is not an agent`,
      expect.stringContaining(`Pipeline "P": loop condition "x ==" is not valid:`),
    ]);
    expect(messages(src, "error")[0]).toBe(`Schema "S": field "b": "Strng" is not a type; did you mean "String"?`);
    expect(messages(src, "warning")).toEqual([
      `Schema "S": field "c": "Widget" is not a declared schema, so it isn't checked (declare \`schema Widget { ... }\`, or use String, Number, Integer, Boolean, Array, List, Object, Map, JSON, Any, Result)`,
      `Pipeline "P": loop(...) has no option "tries" (only max: n)`,
    ]);
  });

  test("Require() checks JSON/XML/Citation only; Validate needs three arguments", () => {
    expect(messages(`policy P : Require(JSON) & Require(Approver) & Validate("amount", "<=")`)).toEqual([
      `Policy "P": Require(Approver) is not enforced; only Require(JSON | XML | Citation) is checked`,
      `Policy "P": Validate needs a field, an operator, and a value, e.g. Validate("amount", "<=", "context.data.limit")`,
    ]);
  });
});

describe("schemas: a pipeline's output must match its -> Schema", () => {
  const src = `
    schema Profile { name: String, age: Number, active: Boolean, tags: Array<String>, address: Address }
    schema Address { city: String }
    agent X [openai/gpt-4o]
    pipeline Extract(bio: String) -> Profile:
      bio |> X.extract()`;
  const run = (answer: unknown) => rt(src, { "X.extract": answer }).execute("Extract", { bio: "..." });

  test("a matching JSON answer is returned parsed", async () => {
    const profile = { name: "Ana", age: 31, active: true, tags: ["a"], address: { city: "Porto" } };
    expect(await run(JSON.stringify(profile))).toEqual(profile);
    expect(await run("```json\n" + JSON.stringify(profile) + "\n```")).toEqual(profile);
  });

  for (const [label, answer, problem] of [
    ["not JSON", "Ana is 31", `output is not JSON: "Ana is 31"`],
    ["a missing field", { name: "Ana", age: 31, active: true, tags: [] }, `missing field "address"`],
    ["a wrong type", { name: "Ana", age: "31", active: true, tags: [], address: { city: "P" } }, `age should be a Number, got a string ("31")`],
    ["a wrong list item", { name: "Ana", age: 31, active: true, tags: ["a", 2], address: { city: "P" } }, `tags[1] should be a String, got a number (2)`],
    ["a wrong nested field", { name: "Ana", age: 31, active: true, tags: [], address: { city: 7 } }, `address.city should be a String, got a number (7)`],
  ] as const) {
    test(`${label} is a SchemaValidationError`, async () => {
      const err = await run(typeof answer === "string" ? answer : JSON.stringify(answer)).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SchemaValidationError);
      expect((err as Error).message).toBe(`Schema validation failed for "Profile": ${problem}`);
    });
  }
});

describe("types: names, fields and arguments are checked", () => {
  const head = `
    schema Address { city: String }
    schema Profile { name: String, age: Integer, address: Address }
    agent W [openai/gpt-4o]
    pipeline Double(n: Number, label: String) -> Number:
      n |> System.Value(n)`;

  test("a near miss of a type is an error; other undeclared names are warnings", () => {
    const src = `${head}
    pipeline A(n: Numbr, p: Profil) -> Strng:
      n |> System.Print()
    pipeline B(issue: GitHub.Issue) -> Report:
      issue |> System.Print()`;
    expect(messages(src, "error")).toEqual([
      `Pipeline "A": parameter "n": "Numbr" is not a type; did you mean "Number"?`,
      `Pipeline "A": parameter "p": "Profil" is not a type; did you mean "Profile"?`,
      `Pipeline "A": return type: "Strng" is not a type; did you mean "String"?`,
    ]);
    expect(messages(src, "warning").map((m) => m.split(" is not")[0])).toEqual([`Pipeline "B": parameter "issue": "GitHub.Issue"`, `Pipeline "B": return type: "Report"`]);
  });

  test("Result, Any and nested built-ins are known types", () => {
    expect(messages(`${head}
    pipeline C(xs: Array<Map<String, Profile>>, y: Any) -> Result:
      xs |> System.Print()`)).toEqual([]);
  });

  test("a field a schema doesn't have is an error, however it's read", () => {
    const src = `${head}
    pipeline C(p: Profile) -> Result:
      p.height
        |> W.write("{{p.address.zip}} {{p.name}}", about: p.address.city)
        |? (p.nickname != null)
        |> System.Value(context.input.p.age)
        |> System.Print(context.input.p.address.country)`;
    expect(messages(src, "error")).toEqual([
      `Pipeline "C": p.height: "height" is not a field of Profile (it has name, age, address)`,
      `Pipeline "C": p.address.zip: "zip" is not a field of Address (it has city)`,
      `Pipeline "C": p.nickname: "nickname" is not a field of Profile (it has name, age, address)`,
      `Pipeline "C": p.address.country: "country" is not a field of Address (it has city)`,
    ]);
  });

  test("a literal or parameter passed to a pipeline must match the parameter's type", () => {
    const src = `${head}
    pipeline C(name: String, p: Profile, o: Object, k: Integer) -> Result:
      name
        |> Double(n: name, label: "ok")
        |> Double("three", 4)
        |> Double(n: p.age, label: p.address)
        |> Double(n: k, label: p.name)
        |> Double(n: 1.5, label: true)
        |> Pick(p: o, q: [1, 2], k: 2.5)
    pipeline Pick(p: Profile, q: List, k: Integer) -> Result:
      p |> System.Print()`;
    expect(messages(src, "error")).toEqual([
      `Pipeline "C": Double(...) passes a String to "n", which is a Number`,
      `Pipeline "C": Double(...) passes a String to "n", which is a Number`,
      `Pipeline "C": Double(...) passes an Integer to "label", which is a String`,
      `Pipeline "C": Double(...) passes an Address to "label", which is a String`,
      `Pipeline "C": Double(...) passes a Boolean to "label", which is a String`,
      `Pipeline "C": Pick(...) passes a Number to "k", which is an Integer`,
    ]);
  });
});

describe("return types: built-in types are checked at runtime too", () => {
  const run = (type: string, answer: unknown) =>
    rt(`agent X [openai/gpt-4o]\npipeline P(q: String) -> ${type}:\n  q |> X.answer()`, { "X.answer": answer }).execute("P", { q: "?" });

  test("a model's text is read as the declared type", async () => {
    expect(await run("Number", " 42 ")).toBe(42);
    expect(await run("Integer", "7")).toBe(7);
    expect(await run("Boolean", "True")).toBe(true);
    expect(await run("Array<String>", `["a", "b"]`)).toEqual(["a", "b"]);
    expect(await run("String", "hi")).toBe("hi");
    expect(await run("Result", { any: "thing" })).toEqual({ any: "thing" });
    expect(await run("Report", "unchecked")).toBe("unchecked");
  });

  for (const [type, answer, problem] of [
    ["Number", "about forty", `output should be a Number, got a string ("about forty")`],
    ["Integer", "4.5", `output should be an Integer, got a number (4.5)`],
    ["Boolean", "yes", `output should be a Boolean, got a string ("yes")`],
    ["Array<Number>", "[1, \"2\"]", `output[1] should be a Number, got a string ("2")`],
    ["String", { a: 1 }, `output should be a String, got an object`],
  ] as const) {
    test(`-> ${type} rejects ${JSON.stringify(answer)}`, async () => {
      const err = await run(type, answer).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SchemaValidationError);
      expect((err as Error).message).toBe(`Schema validation failed for "${type}": ${problem}`);
    });
  }
});

describe("|<> loop", () => {
  const src = `
    agent SWE [openai/gpt-4o]
    tool Shell : Bash()
    pipeline Fix(task: String) -> Result:
      task
        |> SWE.write_code()
        |> Shell.run(command: "bun test")
        |<> loop(SWE, "context.data.Shell.run.exitCode != 0", max: 3) as retries
        |> SWE.summarize()`;

  test("goes back to the agent with the failing output until the check passes", async () => {
    const seen: unknown[] = [];
    let builds = 0;
    const r = rt(src, {
      "SWE.write_code": (req: MockRequest) => (seen.push(req.input), `code v${seen.length}`),
      Shell: () => ({ exitCode: ++builds < 3 ? 1 : 0, stderr: `fail ${builds}` }),
      "SWE.summarize": "shipped",
    });
    const result = await r.run("Fix", { task: "add login" });
    expect(result.output).toBe("shipped");
    expect(result.context.data.retries).toBe(2);
    // First the task, then the failing build output each time
    expect(seen).toEqual(["add login", { exitCode: 1, stderr: "fail 1" }, { exitCode: 1, stderr: "fail 2" }]);
    expect(result.context.trace.filter((t) => t.stage === "loop")).toHaveLength(3);
  });

  test("a retried agent with templated instructions still sees what the check found", async () => {
    const prompts: string[] = [];
    let attempt = 0;
    const r = rt(
      `agent Chef [openai/gpt-4o]
       tool Check : Bash()
       pipeline Plan(diet: String) -> Result:
         diet
           |> Chef.plan("Plan meals for a {{diet}} diet.") as plan
           |> Check.run(command: "x")
           |<> loop(Chef, "context.data.Check.run.exitCode == 0")`,
      {
        "Chef.plan": (req: MockRequest) => (prompts.push(req.prompt!), `plan ${++attempt}`),
        Check: () => ({ exitCode: attempt === 1 ? 0 : 1, stdout: attempt === 1 ? "peanut" : "" }),
      },
    );
    await r.run("Plan", { diet: "vegan" });
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).not.toContain("sent back");
    expect(prompts[1]).toContain(`Attempt 1 was sent back because "context.data.Check.run.exitCode == 0" held (from the check):`);
    expect(prompts[1]).toContain(`"stdout": "peanut"`);
    // It also sees what it answered last time, so it doesn't just repeat it.
    expect(prompts[1]).toContain("Your answer on attempt 1, which didn't pass the check (it may be cut short) (from your previous attempt):\nplan 1");
  });

  test("gives up after max tries", async () => {
    const r = rt(src, { "SWE.write_code": "code", Shell: { exitCode: 1 }, "SWE.summarize": "x" });
    const err = await r.execute("Fix", { task: "t" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LoopLimitError);
    expect((err as Error).message).toBe(`loop(SWE) gave up after 3 tries: "context.data.Shell.run.exitCode != 0" is still true`);
  });

  test("a max that isn't a whole number of at least 1 is an error, not an endless loop", async () => {
    for (const max of ["n", "0"]) {
      const r = rt(
        `agent A [openai/gpt-4o]
         pipeline P(n: String) -> Result:
           n |> A.go() |<> loop(A, "context.data.A.go != null", max: ${max})`,
        { "A.go": "again" },
      );
      await expect(r.execute("P", { n: "lots" })).rejects.toThrow("max must be a whole number of at least 1");
    }
  });
});

describe("@correct", () => {
  const src = (directive: string) => `
    policy Short : MaxWords(5)
    ${directive}
    agent W [openai/gpt-4o]
      requires Short
    pipeline P(x: String) -> Result:
      x |> W.write()`;

  test("asks the agent again with the policy's complaint, then accepts a compliant answer", async () => {
    const prompts: string[] = [];
    const events: RuntimeEvent[] = [];
    const r = rt(src("@correct(2)"), { "W.write": (req: MockRequest) => (prompts.push(req.prompt!), prompts.length === 1 ? "one two three four five six seven" : "short answer") }, {
      onEvent: (e) => e.type === "correction" && events.push(e),
    });
    expect(await r.execute("P", { x: "topic" })).toBe("short answer");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain(`Your previous answer was rejected by policy "Short": Content exceeds max words: 7 > 5`);
    expect(prompts[1]).toContain("Previous answer:\none two three four five six seven");
    expect(events).toEqual([{ type: "correction", pipeline: "P", runId: expect.any(String), target: "W.write", attempt: 1, error: "Content exceeds max words: 7 > 5" }]);
  });

  test("without @correct (or after its tries run out) the violation fails the run", async () => {
    const long = { "W.write": "one two three four five six seven" };
    await expect(rt(src(""), long).execute("P", { x: "t" })).rejects.toBeInstanceOf(PolicyViolation);
    await expect(rt(src("@correct(1)"), long).execute("P", { x: "t" })).rejects.toThrow("Content exceeds max words");
  });
});

describe("agents: system prompts, equipped stores, and chat history", () => {
  test("an agent's system prompt is sent to the provider", async () => {
    const { fetch, calls } = fakeFetch(() => ({ content: [{ type: "text", text: "hi" }], usage: { input_tokens: 1, output_tokens: 1 } }));
    const r = rt(`agent A [anthropic/claude-haiku-4-5]\n  system """\n    You are terse.\n  """\npipeline P(x: String) -> Result:\n  x |> A.prompt()`, {}, { env: { ANTHROPIC_API_KEY: "k" }, fetch });
    expect(await r.execute("P", { x: "hello" })).toBe("hi");
    expect(calls[0]!.body.system).toBe("You are terse.");
  });

  test("an equipped VectorStore adds the closest entries to the prompt", async () => {
    const prompts: string[] = [];
    const r = rt(
      `tool KB : VectorStore(namespace: "faq")
       agent A [openai/gpt-4o]
         equips KB
       pipeline Seed(text: String) -> Result:
         text |> KB.log(content: text)
       pipeline Ask(q: String) -> Result:
         q |> A.answer()`,
      { "A.answer": (req: MockRequest) => (prompts.push(req.prompt!), "ok") },
    );
    await r.execute("Ask", { q: "How long does shipping take?" });
    expect(prompts[0]).not.toContain("Relevant context");
    await r.execute("Seed", { text: "Shipping takes 3-5 business days." });
    await r.execute("Seed", { text: "Our office cat is named Pixel." });
    await r.execute("Ask", { q: "How long does shipping take?" });
    expect(prompts[1]).toContain("Relevant context (from KB):\n- Shipping takes 3-5 business days.");
    await r.close();
  });

  test("an equipped File store keeps the conversation across calls", async () => {
    const path = join(tmp, "history.json");
    const prompts: string[] = [];
    const r = rt(
      `tool History : File("${path}", keep: 4)
       agent Bot [openai/gpt-4o]
         equips History
       pipeline Chat(msg: String) -> Result:
         msg |> Bot.reply()`,
      { "Bot.reply": (req: MockRequest) => (prompts.push(req.prompt!), `echo ${req.input}`) },
    );
    await r.execute("Chat", { msg: "Hello" });
    await r.execute("Chat", { msg: "Again" });
    expect(prompts[0]).not.toContain("Conversation so far");
    expect(prompts[1]).toContain("Conversation so far (from History):\nUser: Hello\nAssistant: echo Hello");
    expect(await Bun.file(path).json()).toEqual(["User: Hello\nAssistant: echo Hello", "User: Again\nAssistant: echo Again"]);
  });
});

describe("policies", () => {
  const run = (rule: string, answer: string, extra = "") =>
    rt(
      `policy P : ${rule}
       agent Check [openai/gpt-4o]
       agent A [openai/gpt-4o]
         requires P
       pipeline Go(x: String) -> Result:
         x ${extra} |> A.answer()`,
      { "Check.coverage": JSON.stringify({ max_payout: 5000 }), "A.answer": answer },
    ).execute("Go", { x: "claim" });

  test("Validate compares an output field with a context value", async () => {
    const rule = `Validate("payout", "<=", "context.data.coverage.max_payout")`;
    expect(await run(rule, JSON.stringify({ payout: 4000 }), "|> Check.coverage()")).toEqual({ payout: 4000 });
    await expect(run(rule, JSON.stringify({ payout: 7500 }), "|> Check.coverage()")).rejects.toThrow(
      `Validate failed: payout (7500) <= context.data.coverage.max_payout (5000) is false`,
    );
    await expect(run(rule, JSON.stringify({ total: 1 }), "|> Check.coverage()")).rejects.toThrow(`Validate: output has no field "payout"`);
    await expect(run(rule, JSON.stringify({ payout: 1 }))).rejects.toThrow(`"context.data.coverage.max_payout" is not set`);
  });

  test("Validate compares numbers only with numbers: true, [], and \"\" aren't 1 or 0", async () => {
    const rule = `Validate("approved", "==", "1")`;
    await expect(run(rule, JSON.stringify({ approved: true }))).rejects.toThrow("Validate failed");
    await expect(run(`Validate("payout", "<=", "5")`, JSON.stringify({ payout: [] }))).rejects.toThrow("Validate failed");
    await expect(run(`Validate("payout", "<=", "5")`, JSON.stringify({ payout: "" }))).rejects.toThrow("Validate failed");
    expect(await run(`Validate("payout", "<=", "5")`, JSON.stringify({ payout: "4" }))).toEqual({ payout: "4" });
  });

  test("Require(XML), Require(Citation), MatchRegex, and Block(Markdown)", async () => {
    expect(await run("Require(XML)", "<a><b>x</b></a>")).toBe("<a><b>x</b></a>");
    await expect(run("Require(XML)", "<a><b>x</a>")).rejects.toThrow("Output is not valid XML");
    expect(await run("Require(Citation)", "Paris is the capital [1].")).toBe("Paris is the capital [1].");
    await expect(run("Require(Citation)", "Paris is the capital.")).rejects.toThrow("no citations");
    expect(await run(`MatchRegex("^TICKET-\\\\d+$")`, "TICKET-42")).toBe("TICKET-42");
    await expect(run(`MatchRegex("^TICKET-\\\\d+$")`, "ticket 42")).rejects.toThrow("does not match the pattern");
    await expect(run("Block(Markdown)", "## Title\n**bold**")).rejects.toThrow("Markdown formatting not allowed");
  });

  test("MaxTokens uses the provider's reported completion tokens", async () => {
    const { fetch } = fakeFetch(() => ({ choices: [{ message: { content: "a long answer" } }], usage: { prompt_tokens: 5, completion_tokens: 900 } }));
    const r = rt(`policy P : MaxTokens(500)\nagent A [openai/gpt-4o]\n  requires P\npipeline Go(x: String) -> Result:\n  x |> A.answer()`, {}, { env: { OPENAI_API_KEY: "k" }, fetch });
    await expect(r.execute("Go", { x: "q" })).rejects.toThrow("Output used 900 tokens, more than the limit of 500");
  });
});

describe("untrusted values", () => {
  test("can't reach Object.prototype through listen targets, stores, or paths", async () => {
    const r = rt(`pipeline P(ev: String) -> Result:\n  ev ~> listen(context.input.ev) |> System.Value(context.data.x)`);
    await expect(r.run("P", { ev: "__proto__.polluted" })).rejects.toThrow("not a valid event name");
    await expect(r.run("P", { ev: "" })).rejects.toThrow("not a valid event name");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    const looked = rt(`pipeline P(x: JSON) -> Result:\n  x |> System.Value(context.input.x.constructor)`);
    expect((await looked.run("P", { x: {} })).output).toBeUndefined();
  });

  test("a REST call stays under the tool's URL, and placeholder values are encoded", async () => {
    const { fetch, calls } = fakeFetch(() => ({ ok: true }));
    const r = rt(
      `tool U : REST("api.example.com/users/{{id}}/profile")
       tool Api : REST("api.example.com/v1/repos")
       pipeline ById(id: String) -> Result:
         id |> U.get(id: id)
       pipeline ByPath(p: String) -> Result:
         p |> Api.get(path: p)`,
      {},
      { fetch },
    );
    await r.execute("ById", { id: "../../admin?all=1#" });
    expect(String(calls[0]!.url)).toBe("https://api.example.com/users/..%2F..%2Fadmin%3Fall%3D1%23/profile");
    await expect(r.execute("ByPath", { p: "/../../admin" })).rejects.toThrow("is outside the tool's URL https://api.example.com/v1/repos");
    await expect(r.execute("ByPath", { p: "/x?admin=1" })).rejects.toThrow("can't contain ? or #");
    await r.execute("ByPath", { p: "/halo/issues" });
    expect(String(calls.at(-1)!.url)).toBe("https://api.example.com/v1/repos/halo/issues");
  });

  test("a File path filled from data stays in its folder", async () => {
    const dir = join(tmp, "files");
    const r = rt(`tool H : File("${dir}/history-{{user}}.json")\npipeline P(user: String) -> Result:\n  user |> H.append(content: "hi", user: user)`);
    await expect(r.execute("P", { user: "/../../escaped" })).rejects.toThrow("is outside");
    expect(existsSync(join(tmp, "escaped.json"))).toBe(false);
    await r.execute("P", { user: "ana" });
    expect(existsSync(join(dir, "history-ana.json"))).toBe(true);
    // Staying in the folder isn't enough: one user's value can't name another user's file.
    for (const user of ["x/../history-ana", "x\\..\\history-ana"]) {
      await expect(r.execute("P", { user })).rejects.toThrow("can't contain / or \\ or be . or ..");
    }
    expect(await Bun.file(join(dir, "history-ana.json")).json()).toEqual(["hi"]);
  });
});

describe("tools", () => {
  test("Bash runs commands, reports exit codes, and shell-quotes inserted values", async () => {
    const marker = join(tmp, "pwned");
    const r = rt(`tool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: "echo {{x}}; exit 3")`);
    const out = (await r.execute("P", { x: `hi; touch ${marker}` })) as { stdout: string; exitCode: number };
    expect(out.stdout).toBe(`hi; touch ${marker}`);
    expect(out.exitCode).toBe(3);
    expect(existsSync(marker)).toBe(false);
    await expect(rt(`tool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run()`).execute("P", { x: "ls" })).rejects.toThrow(`Sh.run needs command: "..."`);
  });

  test("an agent using Bash through tool: also gets quoted values", async () => {
    const marker = join(tmp, "pwned2");
    const r = rt(`tool Sh : Bash()\nagent A [openai/gpt-4o]\n  equips Sh\npipeline P(x: String) -> Result:\n  x |> A.check(tool: Sh, command: "echo {{x}}")`, { "A.check": (req: MockRequest) => req.prompt });
    const prompt = String(await r.execute("P", { x: `$(touch ${marker})` }));
    expect(prompt).toContain(`"stdout": "$(touch ${marker})"`);
    expect(existsSync(marker)).toBe(false);
  });

  test("Browser fetches a page and returns its readable text", async () => {
    const { fetch, calls } = fakeFetch(() => new Response(`<html><head><title>Example</title><style>x{}</style></head><body><h1>Hello</h1><p>World &amp; more</p><script>evil()</script></body></html>`, { headers: { "content-type": "text/html" } }));
    const r = rt(`tool Web : Browser()\npipeline P(u: String) -> Result:\n  u |> Web.fetch()`, {}, { fetch });
    expect(await r.execute("P", { u: "example.com" })).toEqual({ url: "https://example.com/", title: "Example", content: "Hello\nWorld & more" });
    expect(calls[0]!.url.href).toBe("https://example.com/");
  });

  test("Slack, GitHub, Email, Linear, and Figma send real API requests with their tokens", async () => {
    const { fetch, calls } = fakeFetch((url, _init, body) => {
      if (url.host === "slack.com") return { ok: true, channel: "C1", ts: "1.2" };
      if (url.host === "api.github.com") return { number: 12, html_url: "https://github.com/o/r/issues/12" };
      if (url.host === "api.resend.com") return { id: "em_1" };
      if (url.host === "api.linear.app") return body.query.includes("teams") ? { data: { teams: { nodes: [{ id: "team-1" }] } } } : { data: { issueCreate: { success: true, issue: { identifier: "ENG-7", url: "https://linear.app/x/ENG-7" } } } };
      if (url.host === "api.figma.com") return { nodes: { "1:2": { document: { name: "Button" } } } };
      return new Response("nope", { status: 404 });
    });
    const r = rt(
      `tool Chat : Slack(Env.SLACK)
       tool Repo : GitHub("Env.GH")
       tool Mail : Email(Env.RESEND, from: "bot@example.com")
       tool Tickets : Linear(Env.LINEAR)
       tool Design : Figma(Env.FIGMA)
       pipeline P(x: String) -> Result:
         x
           |> Chat.post(channel: "#ops", text: "Deploy?", buttons: ["Approve", "Reject"]) as slack
           |> Repo.create_issue(repo: "o/r", title: "Bug", labels: ["bug"]) as issue
           |> Mail.send(to: "a@example.com", subject: "Hi", body: "Body") as mail
           |> Tickets.create_issue(team: "ENG", title: "Ship", description: "Now") as ticket
           |> Design.get_node(file: "F1", node: "1:2") as node`,
      {},
      { env: { SLACK: "xoxb-1", GH: "ghp_1", RESEND: "re_1", LINEAR: "lin_1", FIGMA: "fig_1" }, fetch },
    );
    const result = await r.run("P", { x: "go" });
    expect(result.context.data).toMatchObject({
      slack: { ok: true, channel: "C1", ts: "1.2" },
      issue: { number: 12, url: "https://github.com/o/r/issues/12" },
      mail: { sent: true, id: "em_1", to: ["a@example.com"] },
      ticket: { id: "ENG-7", url: "https://linear.app/x/ENG-7" },
      node: { document: { name: "Button" } },
    });
    const byHost = (h: string) => calls.filter((c) => c.url.host === h);
    expect(byHost("slack.com")[0]!.body).toMatchObject({ channel: "#ops", text: "Deploy?", blocks: [{}, { type: "actions" }] });
    expect(new Headers(byHost("slack.com")[0]!.init.headers).get("authorization")).toBe("Bearer xoxb-1");
    expect(byHost("api.github.com")[0]!.url.pathname).toBe("/repos/o/r/issues");
    expect(new Headers(byHost("api.github.com")[0]!.init.headers).get("authorization")).toBe("Bearer ghp_1");
    expect(byHost("api.resend.com")[0]!.body).toEqual({ from: "bot@example.com", to: ["a@example.com"], subject: "Hi", text: "Body" });
    expect(byHost("api.linear.app")[1]!.body.variables.input).toEqual({ teamId: "team-1", title: "Ship", description: "Now" });
    expect(byHost("api.figma.com")[0]!.url.search).toBe("?ids=1%3A2");
    expect(new Headers(byHost("api.figma.com")[0]!.init.headers).get("x-figma-token")).toBe("fig_1");
  });

  test("a missing token is a clear error", async () => {
    const r = rt(`tool Chat : Slack(Env.SLACK)\npipeline P(x: String) -> Result:\n  x |> Chat.post(channel: "#a", text: "b")`);
    await expect(r.execute("P", { x: "a" })).rejects.toThrow(`Environment variable SLACK is not set (needed by "Chat")`);
  });
});

describe("pausing, streaming, and telemetry", () => {
  const src = `agent A [openai/gpt-4o]
pipeline P(x: String) -> Result:
  x |> A.draft() |! yield("Ship it?") as answer |> A.finish(context.data.answer.note)`;

  test("a run paused in one runtime can be resumed by another through a FileRunStore", async () => {
    const store = new FileRunStore(join(tmp, "runs"));
    const mocks = { "A.draft": "draft", "A.finish": (req: MockRequest) => `finished with ${req.args[0]}` };
    const paused = await rt(src, mocks, { runStore: store }).run("P", { x: "a" });
    expect(paused.status).toBe("paused");
    expect(existsSync(join(tmp, "runs", `${paused.runId}.json`))).toBe(true);
    const done = await rt(src, mocks, { runStore: store }).signal(paused.runId, "yield", { note: "ok" });
    expect(done.output).toBe("finished with ok");
    expect(existsSync(join(tmp, "runs", `${paused.runId}.json`))).toBe(false);
  });

  test("signals sent at the same moment resume a paused run once", async () => {
    for (const store of [undefined, new FileRunStore(join(tmp, "race"))]) {
      let finished = 0;
      const r = rt(src, { "A.draft": "draft", "A.finish": () => `finished ${++finished}` }, { runStore: store });
      const paused = await r.run("P", { x: "a" });
      const results = await Promise.allSettled([1, 2, 3].map(() => r.signal(paused.runId, "yield", { note: "ok" })));
      expect(results.map((x) => x.status).sort()).toEqual(["fulfilled", "rejected", "rejected"]);
      expect(finished).toBe(1);
    }
  });

  test("a loop's count survives a pause, so pausing can't reset max", async () => {
    let tries = 0;
    const r = rt(
      `agent A [openai/gpt-4o]
       pipeline P(x: String) -> Result:
         x |> A.go() as r |! yield("ok?") |<> loop(A, "context.data.r.bad == true", max: 2)`,
      { "A.go": () => (tries++, { bad: true }) },
    );
    let run = await r.run("P", { x: "a" });
    let resumes = 0;
    const err = await (async () => {
      while (run.status === "paused") (run = await r.signal(run.runId, "yield", {}), resumes++);
    })().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LoopLimitError);
    expect(tries).toBe(3);
    expect(resumes).toBe(2); // the third answer is the one that hits the limit
  });

  test("stream() yields events as they happen and ends with done", async () => {
    const r = rt(src, { "A.draft": "draft", "A.finish": "final" }, { onInterrupt: () => ({ note: "ok" }) });
    const types: string[] = [];
    let done: unknown;
    for await (const e of r.stream("P", { x: "a" })) {
      types.push(e.type === "stage" ? `stage:${e.status}:${e.index}` : e.type);
      if (e.type === "done") done = e.result.output;
    }
    expect(done).toBe("final");
    expect(types[0]).toBe("run");
    expect(types.at(-1)).toBe("done");
    expect(types.filter((t) => t === "token")).toHaveLength(2);
    expect(types).toContain("stage:end:3");
  });

  test("concurrent streams on one runtime only see their own run's events", async () => {
    const r = rt(`agent A [openai/gpt-4o]\npipeline P(x: String) -> Result:\n  x |> A.echo()`, {
      "A.echo": async (req: MockRequest) => (await Bun.sleep(req.input === "slow" ? 20 : 1), `echo ${req.input}`),
    });
    const collect = async (x: string) => {
      const tokens: string[] = [];
      const runIds = new Set<string>();
      for await (const e of r.stream("P", { x })) {
        if (e.type === "token") tokens.push(e.text);
        if ("runId" in e) runIds.add(e.runId);
      }
      return { tokens, runIds };
    };
    const [slow, fast] = await Promise.all([collect("slow"), collect("fast")]);
    expect(slow.tokens).toEqual(["echo slow"]);
    expect(fast.tokens).toEqual(["echo fast"]);
    expect(slow.runIds.size).toBe(1);
    expect(fast.runIds.size).toBe(1);
  });

  test("stream() reports a failure as an error event", async () => {
    const r = rt(src, { "A.draft": () => { throw new Error("model down"); } });
    const events = [];
    for await (const e of r.stream("P", { x: "a" })) events.push(e);
    expect(events.at(-1)).toMatchObject({ type: "error", error: { message: "model down" } });
  });

  test("telemetry records each run for Studio", async () => {
    const telemetry = new SqliteTelemetry(":memory:");
    const r = rt(src, { "A.draft": "draft", "A.finish": "final" }, { onInterrupt: () => ({ note: "ok" }), onEvent: telemetry.handler });
    const { runId } = await r.run("P", { x: "a" });
    const rows = telemetry.run(runId);
    expect(rows.map((row) => row.type)).toEqual([
      "stream_start", "node_start", "node_end", "node_start", "llm_call", "node_end", "node_start", "node_end", "node_start", "llm_call", "node_end", "stream_end",
    ]);
    expect(JSON.parse(String(rows.at(-1)!.payload))).toMatchObject({ status: "completed", output: "final" });
    telemetry.close();
    expect(toTelemetryRow({ type: "retry", runId: "r", target: "x", attempt: 1, error: "e", delayMs: 0 })).toBeUndefined();
  });
});

describe("language server", () => {
  const src = `agent A [openai/gpt-4o]
  system "Be kind."
  equips Missing
pipeline P(x: String) -> Result:
  x |> A.go() |> System.Pirnt()`;

  test("diagnostics include validator errors at their source position", () => {
    const d = getDiagnostics(src);
    expect(d.map((x) => [x.severity, x.message, x.range.start.line])).toEqual([
      [1, `Agent "A" equips undefined tool "Missing"`, 0],
      [1, `Pipeline "P": unknown System method "Pirnt"`, 4],
    ]);
  });

  test("a syntax error is reported on its token", () => {
    const [d] = getDiagnostics("tool Shell Bash()");
    expect(d!.message).toContain("missing ':'");
    expect(d!.range).toEqual({ start: { line: 0, character: 11 }, end: { line: 0, character: 15 } });
  });

  test("hover describes declarations and operators; completion knows the file's names", () => {
    const hover = getHover(src, { line: 4, character: 8 });
    expect((hover!.contents as { value: string }).value).toContain("**agent A** — `openai/gpt-4o`");
    expect((hover!.contents as { value: string }).value).toContain("> Be kind.");
    expect((getHover(src, { line: 4, character: 3 })!.contents as { value: string }).value).toContain("**Pipe**");
    expect(getCompletions(src, { line: 4, character: 24 }).map((c) => c.label)).toContain("Print");
    const all = getCompletions(src, { line: 5, character: 0 }).map((c) => c.label);
    expect(all).toEqual(expect.arrayContaining(["pipeline", "agent", "loop", "A", "P"]));
  });

  describe("types", () => {
    const typed = `schema Address { city: String }
schema Profile {
  name: Strng,
  home: Address
}
pipeline Greet(p: Profile, n: Numbr) -> Profil:
  p.home.zip |> Greet(p: "x")`;
    const at = (src: string, line: number, character: number) => getCompletions(src, { line, character }).map((c) => c.label);

    test("type and field problems are underlined where they're written", () => {
      const lines = typed.split("\n");
      const shown = getDiagnostics(typed).filter((d) => d.severity === 1).map((d) => [d.range.start.line, lines[d.range.start.line]!.slice(d.range.start.character, d.range.end.character)]);
      expect(shown).toEqual([
        [2, "Strng"],
        [5, "Numbr"],
        [5, "Profil"],
        [6, "p.home.zip"],
        [6, "p:"],
      ]);
    });

    test("type names complete in signatures, schema fields and type arguments, not elsewhere", () => {
      expect(at("pipeline P(x: ", 0, 14)).toEqual(expect.arrayContaining(["String", "Result", "Integer"]));
      expect(at(`${typed}\npipeline Q(a: String, b: Pro`, 7, 27)).toEqual(expect.arrayContaining(["Profile", "Address", "String"]));
      expect(at("pipeline P(x: String) -> ", 0, 25)).toContain("Result");
      expect(at("schema S {\n  a: ", 1, 5)).toContain("Number");
      expect(at("schema S { a: String, b: ", 0, 25)).toContain("Boolean");
      expect(at("pipeline P(xs: Array<", 0, 21)).toContain("String");
      expect(at("schema S { a: String }\nagent A [openai/gpt-4o, temp: ", 1, 30)).not.toContain("String");
      expect(at("tool T : ", 0, 9)).not.toContain("String");
    });

    test("hover describes built-in types", () => {
      const hover = getHover("pipeline P(x: Integer) -> Result:\n  x", { line: 0, character: 16 });
      expect((hover!.contents as { value: string }).value).toBe("**Integer** (built-in type): a whole number");
    });
  });
});

describe("paths, System.Value, memory filters, and corrected violations", () => {
  test("a path on a list maps over its items; numbers pick an item; length counts", async () => {
    const r = rt(
      `agent A [openai/gpt-4o]
       pipeline P(items: List) -> Result:
         items
           |? (items.length > 1 && context.data.items.0.title == "a" && items.1.tags.0 == "y")
           |> A.say("titles {{items.title}} / first {{items.0.title}} / count {{items.length}}", context.data.items.title)`,
      { "A.say": (r: MockRequest) => `${r.args[0]} | ${JSON.stringify(r.args[1])}` },
    );
    const out = await r.execute("P", { items: [{ title: "a", tags: ["x"] }, { title: "b", tags: ["y"] }] });
    expect(out).toBe('titles [\n  "a",\n  "b"\n] / first a / count 2 | ["a","b"]');
  });

  test("System.Value makes a value the flowing value", async () => {
    const r = rt(`agent A [openai/gpt-4o]\npipeline P(x: String) -> Result:\n  x |> A.draft() as draft |> A.save() |> System.Value(context.data.draft)`, { "A.draft": "the draft", "A.save": { saved: true } });
    expect(await r.execute("P", { x: "a" })).toBe("the draft");
    expect(messages(`pipeline P(x: String) -> Result:\n  x |> System.Value(x)`)).toEqual([]);
    await expect(rt(`pipeline P(x: String) -> Result:\n  x |> System.Value(x, x)`).execute("P", { x: "a" })).rejects.toThrow("System.Value takes exactly one value");
  });

  test("memory search can leave out tags and return the newest first", async () => {
    const r = rt(
      `store M : VectorStore(namespace: "m")
       pipeline Add(text: String, tag: String) -> Result:
         text |> M.log(content: text, tags: ["review", tag])
       pipeline Find(skip: String) -> Result:
         skip |> M.search(query: "zzz", tags: ["review"], exclude_tags: [skip], order: "recent", limit: 5)`,
    );
    for (const [text, tag] of [["first", "m1"], ["second", "m2"], ["third", "m1"]]) await r.execute("Add", { text, tag });
    const hits = (await r.execute("Find", { skip: "m2" })) as Array<{ content: string }>;
    expect(hits.map((h) => h.content)).toEqual(["third", "first"]);
    await expect(rt(`store M : VectorStore()\npipeline F(x: String) -> Result:\n  x |> M.search(query: x, order: "oldest")`).execute("F", { x: "a" })).rejects.toThrow(`order must be "score" or "recent"`);
    await r.close();
  });

  test("a violation fixed by @correct stays in the audit trail, marked corrected", async () => {
    let n = 0;
    const r = rt(`policy Short : MaxWords(3)\n@correct(1)\nagent W [openai/gpt-4o]\n  requires Short\npipeline P(x: String) -> Result:\n  x |> W.write()`, {
      "W.write": () => (++n === 1 ? "one two three four" : "short"),
    });
    const result = await r.run("P", { x: "a" });
    expect(result.output).toBe("short");
    expect(result.context.meta.violations).toEqual([{ policy: "Short", rule: "MaxWords", message: "Content exceeds max words: 4 > 3", phase: "output", corrected: true }]);
  });
});


describe("limits found by fuzzing and scale runs", () => {
  test("a pipeline calling itself from a fan-out stops at its @timeout instead of running forever", async () => {
    const r = rt(`@timeout(300ms)\npipeline P(x: String) -> Result:\n  x\n    |* { P, P, P }`);
    const t0 = performance.now();
    await expect(r.execute("P", { x: "a" })).rejects.toThrow('Pipeline "P" timed out after 300ms');
    expect(performance.now() - t0).toBeLessThan(5000);
  });

  test("calls don't pile up abort listeners on the run's signal", async () => {
    const proto = EventTarget.prototype;
    const [add, remove] = [proto.addEventListener, proto.removeEventListener];
    // Listeners still attached, per signal (a leak piles them all onto the run's one signal).
    const attached = new Map<EventTarget, number>();
    const bump = (t: EventTarget, d: number) => attached.set(t, (attached.get(t) ?? 0) + d);
    proto.addEventListener = function (this: EventTarget, type: string, ...rest: any[]) {
      if (type === "abort") bump(this, 1);
      return (add as any).call(this, type, ...rest);
    } as typeof add;
    proto.removeEventListener = function (this: EventTarget, type: string, ...rest: any[]) {
      if (type === "abort") bump(this, -1);
      return (remove as any).call(this, type, ...rest);
    } as typeof remove;
    try {
      const r = rt(`agent M [openai/gpt-4o]\npipeline P(items: List) -> Result:\n  items |* each(x in items, concurrency: 10) => M.work()`, { "M.work": 1 });
      await r.execute("P", { items: Array.from({ length: 2000 }, (_, i) => i) });
    } finally {
      [proto.addEventListener, proto.removeEventListener] = [add, remove];
    }
    // A leak would leave about 2000 on one signal.
    expect(Math.max(...attached.values())).toBeLessThan(50);
  });

  test("JSON with toString or valueOf keys compares like any other value", async () => {
    const r = rt(`agent A [openai/gpt-4o]\npipeline S(x: String) -> Result:\n  x |> A.score() as r |? (context.data.r == 1) |> System.Fail(context.data.r)`, { "A.score": '{"toString": 1, "valueOf": 2}' });
    expect((await r.run("S", { x: "a" })).status).toBe("halted");
    const fail = rt(`agent A [openai/gpt-4o]\npipeline S(x: String) -> Result:\n  x |> A.score() as r |> System.Fail(context.data.r)`, { "A.score": '{"toString": 1}' });
    await expect(fail.execute("S", { x: "a" })).rejects.toThrow('"toString": 1');
  });

  test("a whole context container can flow back into context.data without containing itself", async () => {
    const r = rt(`pipeline S(x: String) -> Result:\n  context.data\n    |> System.Print() as y\n    |> System.Value("{{y}}")`);
    const realLog = console.log;
    console.log = () => {};
    try {
      expect(await r.execute("S", { x: "a" })).toContain('"x": "a"');
    } finally {
      console.log = realLog;
    }
  });

  test("values nested too deeply fail with a clear error", async () => {
    let v: unknown = "x";
    for (let i = 0; i < 100_000; i++) v = { a: v };
    const r = rt(`policy G : Redact(PII)\nagent M [openai/gpt-4o]\n  requires G\npipeline P(x: JSON) -> Result:\n  x |> M.go()`, { "M.go": "ok" });
    await expect(r.execute("P", { x: v })).rejects.toThrow("nested too deeply");
  }, 30_000);

  test("parallel appends to one File store all land", async () => {
    const file = join(tmp, "parallel-history.json");
    const r = rt(`store H : File("${file}", keep: 1000)\nagent M [openai/gpt-4o]\n  equips H\npipeline P(items: List) -> Result:\n  items |* each(x in items, concurrency: 10) => M.reply()`, {
      "M.reply": async (q: MockRequest) => (await Bun.sleep(Math.random() * 3), `ok ${q.input}`),
    });
    await r.execute("P", { items: Array.from({ length: 100 }, (_, i) => i) });
    expect((await Bun.file(file).json()) as string[]).toHaveLength(100);
  });

  test("telemetry never prunes a run that is still going, and cuts huge fields to a preview", () => {
    const telemetry = new SqliteTelemetry(":memory:", 2);
    const event = (runId: string, e: Record<string, unknown>) => telemetry.handler({ runId, pipeline: "P", ...e } as RuntimeEvent);
    event("long", { type: "run", status: "start" });
    for (let i = 0; i < 25; i++) {
      event(`r${i}`, { type: "run", status: "start" });
      event(`r${i}`, { type: "run", status: "completed", output: "x".repeat(i === 24 ? 200_000 : 1), cost: 0.5 });
    }
    event("long", { type: "run", status: "completed", output: "done", cost: 0 });
    const ids = telemetry.listRuns(100).map((r) => r.run_id);
    expect(ids).toContain("long");
    expect(ids.length).toBeLessThan(25);
    const last = JSON.parse(String(telemetry.run("r24").at(-1)!.payload));
    expect(last.cost).toBe(0.5);
    expect(last.output).toMatchObject({ truncated: true, length: 200_002 });
    expect(telemetry.listRuns(Number("abc")).length).toBeGreaterThan(0);
    telemetry.close();
  });

  test("validate catches what used to fail only at run time", () => {
    const errors = (body: string, extra = "") => messages(`agent A [openai/gpt-4o]\n${extra}pipeline S(x: String) -> Result:\n  x ${body}`, "error");
    expect(errors(`|<> loop(A, "true")`)).toContain('Pipeline "S": loop(A, ...) needs an earlier A stage to go back to');
    expect(errors(`|> System.Value()`)[0]).toContain("System.Value takes exactly one value");
    expect(errors(`|> System.Pick(context.data.x)`)[0]).toContain("System.Pick needs fields");
    expect(errors(`|> System.Sleep("soon")`)[0]).toContain("System.Sleep needs a duration");
    expect(errors(`|> A.go() as __proto__`)[0]).toContain('"__proto__" can\'t be used as a name');
    expect(errors(`|? (Env.MODE == "a")`)[0]).toContain("Env.MODE can only be used in tool declarations");
    expect(errors(`|> A.go()`, `policy P : MatchRegex("[")\n`)[0]).toContain("is not a valid regular expression");
    expect(messages(`pipeline T(a: String, b: String) -> Result:\n  a |> System.Value(b)\npipeline S(x: String) -> Result:\n  x |> T()`, "warning")).toContain('Pipeline "S": T(...) is called without "b"');
    expect(() => new HaloRuntime().load(parse(`pipeline S(x: String) -> Result:\n  x |> System.Value(x) as __proto__`))).toThrow("can't be used as a name");
  });

  test("an over-long dotted name is a parse error, not a long parse", () => {
    const t0 = performance.now();
    const r = parse(`pipeline P(x: String) -> Result:\n  x |> System.Value(context.data.${"a.".repeat(20_000)}a)`);
    expect(r.errors[0]).toContain("too long");
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe("long runs and big stores stay fast", () => {
  test("a snapshot saved again only appends to its log, and a crash mid-save leaves it readable", async () => {
    const { writeSnapshot, readSnapshot, logPathFor } = await import("../src/runtime/snapshots");
    const file = join(tmp, "snap", "run.json");
    const entry = (i: number) => ({ index: i, stage: "call" as const, label: `s${i}`, at: "t", outputHash: "h", prev: "p", hash: `x${i}` });
    const snap = (n: number) => ({ version: 1 as const, pipeline: "P", nextStage: n, input: {}, data: { n }, current: n, loops: {}, trace: Array.from({ length: n }, (_, i) => entry(i)), meta: { runId: "r", pipeline: "P", startedAt: "t", cost: 0, tokens: { prompt: 0, completion: 0 }, calls: [], violations: [], shadows: [] } });
    await writeSnapshot(file, snap(100) as any);
    const size = Bun.file(logPathFor(file)).size;
    await writeSnapshot(file, snap(101) as any);
    // One new entry, not the whole trace again.
    expect(Bun.file(logPathFor(file)).size - size).toBeLessThan(200);
    expect(Bun.file(file).size).toBeLessThan(500);
    const read = await readSnapshot(file);
    expect(read!.trace).toHaveLength(101);
    expect(read!.data).toEqual({ n: 101 });

    // A crash after appending but before the core was written: the extra lines are ignored, then cut off.
    const { appendFileSync } = await import("node:fs");
    appendFileSync(logPathFor(file), `${JSON.stringify({ t: entry(999) })}\n`);
    expect((await readSnapshot(file))!.trace).toHaveLength(101);
    await writeSnapshot(file, snap(102) as any);
    expect((await readSnapshot(file))!.trace.map((t) => t.index)).toEqual(Array.from({ length: 102 }, (_, i) => i));

    // Snapshots saved as one file (before logs) still load.
    const old = join(tmp, "snap", "old.json");
    await Bun.write(old, JSON.stringify(snap(3)));
    expect((await readSnapshot(old))!.trace).toHaveLength(3);
  });

  test("pausing and resuming one run many times stays fast, and a fresh store reads it back whole", async () => {
    const dir = join(tmp, "many-pauses");
    const looped = `agent A [openai/gpt-4o]\npipeline P(n: Number) -> Result:\n  n\n    |> A.step() as s\n    |! yield("again?")\n    |<> loop(A, "context.data.yield.action == 'more'", max: 400)`;
    const r = rt(looped, { "A.step": "ok" }, { runStore: new FileRunStore(dir) });
    let res = await r.run("P", { n: 1 });
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) res = await r.signal(res.runId, "yield", { action: "more" });
    expect(res.status).toBe("paused");
    expect(performance.now() - t0).toBeLessThan(5000);
    // Another process (no cache) sees the whole history.
    const other = rt(looped, { "A.step": "ok" }, { runStore: new FileRunStore(dir) });
    const done = await other.signal(res.runId, "yield", { action: "stop" });
    expect(done.status).toBe("completed");
    expect(done.context.trace.length).toBeGreaterThan(900);
    const { readdirSync } = await import("node:fs");
    expect(readdirSync(dir)).toEqual([]);
  });

  test("vector search keeps up with rows added or deleted elsewhere", async () => {
    const { LocalVectorStore } = await import("../src/runtime/vectors");
    const path = join(tmp, "vectors-sync.sqlite");
    const a = new LocalVectorStore(path);
    const b = new LocalVectorStore(path);
    a.insert("ns", "refund for a broken blender", ["billing"]);
    a.insert("ns", "the app crashes on login", ["bug"]);
    expect(b.search("ns", "blender refund")[0]!.content).toBe("refund for a broken blender");
    a.insert("ns", "login page shows a blank screen", ["bug"]);
    expect(b.search("ns", "blank login screen")[0]!.content).toBe("login page shows a blank screen");
    expect(a.delete("ns", { tags: ["bug"] })).toBe(2);
    a.insert("ns", "password reset email never arrives", ["bug"]);
    // Every entry left (any score), and none of the deleted ones.
    expect(b.search("ns", "login", { limit: 10, minScore: -1 }).map((h) => h.content).sort()).toEqual(["password reset email never arrives", "refund for a broken blender"]);
    expect(b.count("ns")).toBe(2);
    expect(b.search("ns", "refund", { tags: ["billing"] })).toHaveLength(1);
    expect(b.search("ns", "anything", { excludeTags: ["billing", "bug"] })).toEqual([]);
    a.close();
    b.close();
  });
});
