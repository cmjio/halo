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
    const ast = parse(await Bun.file(`${import.meta.dir}/../examples/19-system-prompts.halo`).text());
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
    expect(messages(src, "error")).toEqual([
      `Pipeline "P": loop(T, ...) needs an agent to retry with, but "T" is not an agent`,
      expect.stringContaining(`Pipeline "P": loop condition "x ==" is not valid:`),
    ]);
    expect(messages(src, "warning")).toEqual([
      `Schema "S": field "b" has unknown type "Strng" (use String, Number, Integer, Boolean, Array, List, Object, Map, JSON, Any, or another schema)`,
      `Schema "S": field "c" has unknown type "Widget" (use String, Number, Integer, Boolean, Array, List, Object, Map, JSON, Any, or another schema)`,
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

  test("gives up after max tries", async () => {
    const r = rt(src, { "SWE.write_code": "code", Shell: { exitCode: 1 }, "SWE.summarize": "x" });
    const err = await r.execute("Fix", { task: "t" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LoopLimitError);
    expect((err as Error).message).toBe(`loop(SWE) gave up after 3 tries: "context.data.Shell.run.exitCode != 0" is still true`);
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
});
