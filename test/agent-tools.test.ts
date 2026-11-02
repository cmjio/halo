import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, MemoryRunStore, useTool, type MockRequest, type RuntimeConfig, type RuntimeEvent } from "../src/runtime/runtime";
import { AnthropicAdapter, GoogleAdapter, OpenAIAdapter, type LLMRequest } from "../src/runtime/adapter";

const tmp = mkdtempSync(join(tmpdir(), "halo-agent-tools-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function rt(src: string, mocks: Record<string, unknown> = {}, config: RuntimeConfig = {}) {
  const ast = parse(src);
  expect(ast.errors).toEqual([]);
  return new HaloRuntime({ env: {}, vectorPath: ":memory:", checkpointDir: tmp, logger: { log() {}, warn() {} }, ...config }).load(ast).mockAll(mocks);
}

/** A mock model that plays a script: each step returns the next item (a value, or useTool(...) calls). */
function script(...steps: unknown[]) {
  const seen: MockRequest[] = [];
  const mock = (req: MockRequest) => {
    seen.push(structuredClone({ ...req, messages: req.messages }));
    return steps[Math.min((req.step ?? 1) - 1, steps.length - 1)];
  };
  return { mock, seen };
}

function workspace() {
  const dir = mkdtempSync(join(tmp, "ws-"));
  writeFileSync(join(dir, "notes.md"), "alpha\nbeta\n");
  return dir;
}

describe("agents that choose their own tools", () => {
  test("the agent calls tools, sees their results, and answers", async () => {
    const dir = workspace();
    const { mock, seen } = script([useTool("Files.read", { path: "notes.md" })], [useTool("Files.write", { path: "out.md", content: "done" })], "Copied it.");
    const r = rt(
      `tool Files : Workspace("${dir}", write: true)
       agent Clerk [openai/gpt-4o] equips Files
       pipeline Copy(task: String) -> Result:
         task |> Clerk.work(tools: [Files])`,
      { "Clerk.work": mock },
    );
    const result = await r.run("Copy", { task: "copy notes" });
    expect(result.output).toBe("Copied it.");
    expect(readFileSync(join(dir, "out.md"), "utf8")).toBe("done");
    // The model was offered the tools, and saw the read's result on its second step.
    expect(seen[0]!.tools).toContain("Files.read");
    const tool = seen[1]!.messages!.find((m) => m.role === "tool");
    expect(tool?.content).toContain("alpha");
    // Tool calls it chose are recorded with the agent that chose them.
    expect(result.context.meta.calls.filter((c) => c.agent === "Clerk").map((c) => c.target)).toEqual(["Files.read", "Files.write"]);
  });

  test("tools: auto on the agent offers what it equips, except stores", async () => {
    const { mock, seen } = script("ok");
    const r = rt(
      `tool Files : Workspace("${workspace()}")
       tool Memory : VectorStore()
       agent A [openai/gpt-4o, tools: auto] equips Files, Memory
       pipeline P(x: String) -> Result:
         x |> A.go()`,
      { "A.go": mock },
    );
    await r.run("P", { x: "hi" });
    expect(seen[0]!.tools!.every((t) => t.startsWith("Files."))).toBe(true);
  });

  test("a tool error goes back to the model instead of failing the run", async () => {
    const { mock, seen } = script([useTool("Files.read", { path: "../etc/passwd" })], "I couldn't read it.");
    const r = rt(`tool Files : Workspace("${workspace()}")\nagent A [openai/gpt-4o] equips Files\npipeline P(x: String) -> Result:\n  x |> A.go(tools: [Files])`, { "A.go": mock });
    expect((await r.run("P", { x: "hi" })).output).toBe("I couldn't read it.");
    expect(seen[1]!.messages!.at(-1)!.content).toMatch(/^Error: /);
  });

  test("after max_steps the model is asked to answer without tools", async () => {
    const { mock, seen } = script([useTool("Files.list", {})], [useTool("Files.list", {})], [useTool("Files.list", {})], "final");
    const r = rt(`tool Files : Workspace("${workspace()}")\nagent A [openai/gpt-4o] equips Files\npipeline P(x: String) -> Result:\n  x |> A.go(tools: [Files], max_steps: 2)`, { "A.go": mock });
    await r.run("P", { x: "hi" });
    expect(seen).toHaveLength(3);
    expect(seen[2]!.messages!.at(-1)!.content).toContain("used all 2 tool steps");
  });

  test("tool results pass through the agent's input policies", async () => {
    const dir = workspace();
    writeFileSync(join(dir, "contacts.md"), "Ana: ana@example.com");
    const { mock, seen } = script([useTool("Files.read", { path: "contacts.md" })], "ok");
    const r = rt(
      `policy Private : Redact(Email)
       tool Files : Workspace("${dir}")
       agent A [openai/gpt-4o] equips Files requires Private
       pipeline P(x: String) -> Result:
         x |> A.go(tools: [Files])`,
      { "A.go": mock },
    );
    await r.run("P", { x: "hi" });
    const result = seen[1]!.messages!.find((m) => m.role === "tool")!.content;
    expect(result).not.toContain("ana@example.com");
  });
});

describe("tool policies", () => {
  const src = (policy: string, dir: string) => `
    policy Guard : ${policy}
    tool Files : Workspace("${dir}", write: true)
    agent A [openai/gpt-4o] equips Files requires Guard
    pipeline P(x: String) -> Result:
      x |> A.go(tools: [Files])`;

  test("AllowTools and AllowEffects hide everything else from the model", async () => {
    for (const policy of [`AllowTools("Files.read", "Files.list")`, `AllowEffects(read)`]) {
      const { mock, seen } = script("ok");
      await rt(src(policy, workspace()), { "A.go": mock }).run("P", { x: "hi" });
      expect(seen[0]!.tools).not.toContain("Files.write");
      expect(seen[0]!.tools).toContain("Files.read");
    }
  });

  test("a call to a denied tool is refused, recorded, and the model told", async () => {
    const dir = workspace();
    const { mock, seen } = script([useTool("Files.delete", { path: "notes.md" })], "ok");
    const result = await rt(src(`DenyTools("Files.delete")`, dir), { "A.go": mock }).run("P", { x: "hi" });
    expect(existsSync(join(dir, "notes.md"))).toBe(true);
    expect(seen[1]!.messages!.at(-1)!.content).toMatch(/^Refused by policy "Guard"/);
    expect(result.context.meta.violations[0]).toMatchObject({ policy: "Guard", rule: "DenyTools", phase: "tool" });
  });

  test("DenyArgs refuses calls whose arguments match", async () => {
    const dir = workspace();
    const { mock } = script([useTool("Files.write", { path: "x.sh", content: "rm -rf /" })], "ok");
    await rt(src(`DenyArgs("Files.write", "rm\\\\s+-rf")`, dir), { "A.go": mock }).run("P", { x: "hi" });
    expect(existsSync(join(dir, "x.sh"))).toBe(false);
  });

  test("DenyArgs can check one argument, and an allow-list pattern can't be dodged with a newline", async () => {
    const shell = (command: string) => {
      const ws = workspace();
      const { mock, seen } = script([useTool("Sh.run", { command })], "ok");
      const r = rt(
        `policy G : DenyArgs("Sh.run", "command", "^(?!echo [a-z]+$)")
         tool Sh : Bash(cwd: "${ws}")
         agent A [openai/gpt-4o] equips Sh requires G
         pipeline P(x: String) -> Result:
           x |> A.go(tools: [Sh])`,
        { "A.go": mock },
      );
      return r.run("P", { x: "hi" }).then(() => seen[1]!.messages!.at(-1)!.content);
    };
    expect(await shell("echo hello")).toContain('"stdout":"hello"');
    expect(await shell("echo hello\ntouch pwned")).toMatch(/^Refused by policy "G"/);
    expect(await shell("echo hi; rm -rf .")).toMatch(/^Refused/);
  });

  test("ApproveTools asks first: a yes runs the call, a no tells the model", async () => {
    for (const [answer, written] of [["approve", true], ["no", false]] as const) {
      const dir = workspace();
      const asked: string[] = [];
      const { mock, seen } = script([useTool("Files.write", { path: "a.md", content: "x" })], "ok");
      const r = rt(src(`ApproveTools("Files.write")`, dir), { "A.go": mock, approval: (q: MockRequest) => (asked.push(q.prompt!), answer) });
      await r.run("P", { x: "hi" });
      expect(asked[0]).toContain("Allow A to call Files.write");
      expect(existsSync(join(dir, "a.md"))).toBe(written);
      if (!written) expect(seen[1]!.messages!.at(-1)!.content).toContain("declined");
    }
  });

  test("with no one to ask, an approval pauses the run; answering it continues the same conversation", async () => {
    const dir = workspace();
    const store = new MemoryRunStore();
    const { mock, seen } = script([useTool("Files.read", { path: "notes.md" }), useTool("Files.write", { path: "a.md", content: "x" })], "wrote it");
    const r = rt(src(`ApproveEffects(write)`, dir), { "A.go": mock }, { runStore: store });
    const paused = await r.run("P", { x: "hi" });
    expect(paused.status).toBe("paused");
    expect(paused.context.meta.paused).toMatchObject({ waitingFor: "approval" });
    expect(paused.context.meta.paused!.message).toContain("Files.write");
    expect(existsSync(join(dir, "a.md"))).toBe(false);

    const done = await r.signal(paused.runId, "approval", "approve");
    expect(done.status).toBe("completed");
    expect(done.output).toBe("wrote it");
    expect(readFileSync(join(dir, "a.md"), "utf8")).toBe("x");
    // The model wasn't asked again for the first step: it saw both results on its second.
    expect(seen).toHaveLength(2);
    expect(seen[1]!.messages!.filter((m) => m.role === "tool")).toHaveLength(2);
  });

  test("the validator checks tool rules and tools: lists", () => {
    const diags = validate(
      parse(`policy G : AllowEffects(delete) & DenyArgs("Files.write", "(") & DenyTools(Nope)
       tool Files : Workspace(".")
       agent A [openai/gpt-4o] requires G
       pipeline P(x: String) -> Result:
         x |> A.go(tools: [Files, Ghost])`),
    ).map((d) => d.message);
    expect(diags.some((m) => m.includes("AllowEffects(delete)"))).toBe(true);
    expect(diags.some((m) => m.includes("not a valid regular expression"))).toBe(true);
    expect(diags.some((m) => m.includes(`"Nope", which is not a declared tool`))).toBe(true);
    expect(diags.some((m) => m.includes(`not equipped with tool "Files"`))).toBe(true);
    expect(diags.some((m) => m.includes(`"Ghost", which is not a declared tool`))).toBe(true);
  });
});

describe("tool calling on the wire", () => {
  const tools = [{ name: "Files__read", description: "Files: read a file", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }];
  const conversation: LLMRequest["messages"] = [
    { role: "system", content: "Be brief." },
    { role: "user", content: "Read a.md" },
    { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "Files__read", args: { path: "a.md" } }] },
    { role: "tool", toolCallId: "c1", name: "Files__read", content: "hello" },
  ];

  test("OpenAI: tools as functions, calls as tool_calls, results as tool messages", () => {
    const a = new OpenAIAdapter();
    const body = a.transformRequest({ model: "gpt-4o", messages: conversation, tools }) as any;
    expect(body.tools[0].function.name).toBe("Files__read");
    expect(body.messages[2].tool_calls[0].function.arguments).toBe('{"path":"a.md"}');
    expect(body.messages[3]).toEqual({ role: "tool", tool_call_id: "c1", content: "hello" });
    const parsed = a.parseResponse({ choices: [{ message: { content: null, tool_calls: [{ id: "x", function: { name: "Files__read", arguments: '{"path":"b"}' } }] } }] });
    expect(parsed.toolCalls).toEqual([{ id: "x", name: "Files__read", args: { path: "b" } }]);
  });

  test("Anthropic: tool_use blocks back, tool_result in a user turn, notes merged into it", () => {
    const a = new AnthropicAdapter();
    const body = a.transformRequest({ model: "claude-x", messages: [...conversation, { role: "user", content: "Now answer." }], tools, toolChoice: "none" }) as any;
    expect(body.tools[0].input_schema.required).toEqual(["path"]);
    expect(body.tool_choice).toEqual({ type: "none" });
    expect(body.messages[1].content[0]).toMatchObject({ type: "tool_use", id: "c1", input: { path: "a.md" } });
    expect(body.messages[2].role).toBe("user");
    expect(body.messages[2].content).toEqual([{ type: "tool_result", tool_use_id: "c1", content: "hello" }, { type: "text", text: "Now answer." }]);
    const parsed = a.parseResponse({ content: [{ type: "text", text: "Let me look." }, { type: "tool_use", id: "t", name: "Files__read", input: { path: "c" } }] });
    expect(parsed.text).toBe("Let me look.");
    expect(parsed.toolCalls).toEqual([{ id: "t", name: "Files__read", args: { path: "c" } }]);
  });

  test("Gemini: function declarations, signed parts sent back unchanged", () => {
    const a = new GoogleAdapter();
    const signed = [{ functionCall: { name: "Files__read", args: { path: "a.md" } }, thoughtSignature: "sig" }];
    const parsed = a.parseResponse({ candidates: [{ content: { parts: signed } }] });
    expect(parsed.toolCalls![0]!.name).toBe("Files__read");
    const msgs = [...conversation];
    msgs[2] = { role: "assistant", content: "", toolCalls: parsed.toolCalls, raw: parsed.rawMessage };
    const body = a.transformRequest({ model: "gemini-x", messages: msgs, tools }) as any;
    expect(body.tools[0].functionDeclarations[0].parameters.properties.path.type).toBe("string");
    expect(body.contents[1]).toEqual({ role: "model", parts: signed });
    expect(body.contents[2].parts[0].functionResponse).toMatchObject({ name: "Files__read", response: { result: "hello" } });
  });

  test("a real tool conversation through the runtime (fake Anthropic API)", async () => {
    const dir = workspace();
    const bodies: any[] = [];
    const fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      const content =
        bodies.length === 1
          ? [{ type: "tool_use", id: "u1", name: "Files__read", input: { path: "notes.md" } }]
          : [{ type: "text", text: `The file says ${body.messages.at(-1).content[0].content.split("\n")[0]}` }];
      return Response.json({ content, usage: { input_tokens: 10, output_tokens: 5 } });
    }) as unknown as typeof globalThis.fetch;
    const events: RuntimeEvent[] = [];
    const r = new HaloRuntime({ env: { ANTHROPIC_API_KEY: "k" }, fetch, logger: { log() {}, warn() {} }, onEvent: (e) => events.push(e) }).load(
      parse(`tool Files : Workspace("${dir}")\nagent A [anthropic/claude-sonnet-4-5] equips Files\npipeline P(x: String) -> Result:\n  x |> A.go(tools: [Files])`),
    );
    const result = await r.run("P", { x: "what's in notes.md?" });
    expect(String(result.output)).toContain("alpha");
    expect(bodies[0].tools.map((t: any) => t.name)).toContain("Files__read");
    expect(result.context.meta.calls.filter((c) => c.kind === "agent")).toHaveLength(2);
    expect(events.some((e) => e.type === "agent_tool" && e.decision === "allowed" && e.target === "Files.read")).toBe(true);
  });
});

describe("recording and replay", () => {
  test("a recorded tool conversation replays exactly, without calling anything", async () => {
    const { Recorder, readRecording, replayMocks } = await import("../src/runtime/replay");
    const dir = workspace();
    const recordings = mkdtempSync(join(tmp, "rec-"));
    const src = `tool Files : Workspace("${dir}", write: true)\nagent A [openai/gpt-4o] equips Files\npipeline P(x: String) -> Result:\n  x |> A.go(tools: [Files])`;
    const recorder = new Recorder(recordings, "run-1");
    const { mock } = script([useTool("Files.read", { path: "notes.md" })], [useTool("Files.write", { path: "copy.md", content: "alpha" })], "copied");
    recorder.start("P", { x: "copy" });
    const first = await rt(src, { "A.go": mock }, { recorder: recorder.record }).run("P", { x: "copy" });
    recorder.finish({ status: first.status, output: first.output });

    rmSync(join(dir, "copy.md"));
    const rec = readRecording(recordings, "run-1");
    expect(rec.calls.map((c) => `${c.kind}:${c.target}`)).toEqual(["agent:A.go", "tool:Files.read", "agent:A.go", "tool:Files.write", "agent:A.go"]);
    const again = await rt(src, replayMocks(rec)).run("P", { x: "copy" });
    expect(again.output).toBe("copied");
    // The write came from the recording: nothing touched the folder.
    expect(existsSync(join(dir, "copy.md"))).toBe(false);
    expect(again.context.meta.calls.every((c) => c.mocked)).toBe(true);

    // A changed pipeline asks for something the recording doesn't have.
    const changed = src.replace("A.go(tools: [Files])", "A.go(tools: [Files]) |> A.check()");
    await expect(rt(changed, replayMocks(rec)).run("P", { x: "copy" })).rejects.toThrow(/no model answers for A.check/);
  });
});
