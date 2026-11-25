import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, validate } from "../src/parser/index";
import { HaloError, HaloRuntime, PolicyViolation, SchemaValidationError, useTool, type MockRequest, type RuntimeConfig, type RuntimeEvent } from "../src/runtime/runtime";

const tmp = mkdtempSync(join(tmpdir(), "halo-cascade-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function rt(src: string, mocks: Record<string, unknown> = {}, config: RuntimeConfig = {}) {
  const ast = parse(src);
  expect(ast.errors).toEqual([]);
  return new HaloRuntime({ env: {}, vectorPath: ":memory:", checkpointDir: tmp, logger: { log() {}, warn() {} }, ...config }).load(ast).mockAll(mocks);
}

const messages = (src: string) => validate(parse(src)).map((d) => `${d.severity}: ${d.message}`);

const fail = (msg: string) => () => {
  throw new HaloError(msg);
};

const HAIKU = "anthropic/claude-haiku-4-5";
const SONNET = "anthropic/claude-sonnet-4-5";
const OPUS = "anthropic/claude-opus-4-5";

describe("@cascade", () => {
  const flow = (extra = "", ret = "Result") => `
    ${extra}
    @cascade(${SONNET}, ${OPUS})
    agent W [${HAIKU}]
      requires Short
    policy Short : MaxWords(5)
    pipeline P(x: String) -> ${ret}:
      x |> W.write()`;

  test("an answer from the agent's own model is used without trying the others", async () => {
    const r = rt(flow(), { "W.write": "fine", [`W@${SONNET}`]: fail("should not run") });
    const result = await r.run("P", { x: "t" });
    expect(result.output).toBe("fine");
    expect(result.context.meta.calls.map((c) => c.model)).toEqual([HAIKU]);
    expect(result.context.meta.escalations).toBeUndefined();
  });

  test("a failed call moves up to the next model, and the run records it", async () => {
    const events: RuntimeEvent[] = [];
    const r = rt(flow(), { "W.write": fail("provider is down"), [`W@${SONNET}`]: "from sonnet" }, { onEvent: (e) => e.type === "escalate" && events.push(e) });
    const result = await r.run("P", { x: "t" });
    expect(result.output).toBe("from sonnet");
    expect(result.context.meta.calls.map((c) => c.model)).toEqual([SONNET]);
    expect(result.context.meta.escalations).toEqual([{ target: "W.write", from: HAIKU, to: SONNET, error: "provider is down" }]);
    expect(events).toEqual([{ type: "escalate", pipeline: "P", runId: expect.any(String), target: "W.write", from: HAIKU, to: SONNET, error: "provider is down" }]);
  });

  test("it climbs through every model in order, and fails with the last error when none answers", async () => {
    const seen: string[] = [];
    const mock = (name: string) => (req: MockRequest) => {
      seen.push(req.model!);
      throw new HaloError(`${name} failed`);
    };
    const r = rt(flow(), { "W.write": mock("haiku"), [`W.write@${SONNET}`]: mock("sonnet"), [`W@${OPUS}`]: mock("opus") });
    await expect(r.execute("P", { x: "t" })).rejects.toThrow("opus failed");
    expect(seen).toEqual([HAIKU, SONNET, OPUS]);
  });

  test("an answer an output policy rejects moves up, after @correct's tries, and the violation is marked escalated", async () => {
    const prompts: string[] = [];
    const long = "one two three four five six seven";
    const r = rt(flow("@correct(1)"), {
      "W.write": (req: MockRequest) => (prompts.push(req.prompt!), long),
      [`W@${SONNET}`]: (req: MockRequest) => (prompts.push(req.prompt!), "short answer"),
    });
    const result = await r.run("P", { x: "topic" });
    expect(result.output).toBe("short answer");
    expect(prompts).toHaveLength(3);
    // The bigger model gets the original task, not the smaller one's correction prompt.
    expect(prompts[2]).not.toContain("rejected by policy");
    const v = result.context.meta.violations;
    expect(v.map((x) => [x.corrected ?? false, x.escalated ?? false])).toEqual([
      [true, false],
      [false, true],
    ]);
  });

  test("a policy rejection on the last model still fails the run", async () => {
    const long = "one two three four five six seven";
    const r = rt(flow(), { "W.write": long, [`W@${SONNET}`]: long, [`W@${OPUS}`]: long });
    await expect(r.execute("P", { x: "t" })).rejects.toBeInstanceOf(PolicyViolation);
  });

  test("an answer that misses the pipeline's schema moves up when it is the pipeline's output", async () => {
    const r = rt(flow("schema Out { label: String }", "Out"), { "W.write": "not json", [`W@${SONNET}`]: { label: "bug" } });
    const result = await r.run("P", { x: "t" });
    expect(result.output).toEqual({ label: "bug" });
    expect(result.context.meta.escalations?.[0]?.error).toContain("Schema validation failed");
  });

  test("the last model's schema miss is the pipeline's usual SchemaValidationError", async () => {
    const r = rt(flow("schema Out { label: String }", "Out"), { "W.write": "a", [`W@${SONNET}`]: "b", [`W@${OPUS}`]: "c" });
    await expect(r.execute("P", { x: "t" })).rejects.toBeInstanceOf(SchemaValidationError);
  });

  test("an agent stage that isn't the pipeline's output isn't held to its schema", async () => {
    const src = `
      schema Out { label: String }
      @cascade(${SONNET})
      agent W [${HAIKU}]
      agent F [${HAIKU}]
      pipeline P(x: String) -> Out:
        x |> W.write() |> F.format()`;
    const r = rt(src, { "W.write": "plain text", [`W@${SONNET}`]: fail("should not run"), "F.format": { label: "ok" } });
    expect(await r.execute("P", { x: "t" })).toEqual({ label: "ok" });
  });

  test("an agent name in the cascade uses that agent's model", async () => {
    const src = `
      agent Big [${OPUS}]
      @cascade(Big)
      agent W [${HAIKU}]
      pipeline P(x: String) -> Result:
        x |> W.write()`;
    const r = rt(src, { "W.write": fail("down"), [`W@${OPUS}`]: "from opus" });
    const result = await r.run("P", { x: "t" });
    expect(result.output).toBe("from opus");
    expect(result.context.meta.escalations).toEqual([{ target: "W.write", from: HAIKU, to: OPUS, error: "down" }]);
  });

  test("an agent with tools starts the conversation over on the bigger model", async () => {
    const src = `
      tool Files : Workspace("${tmp}")
      @cascade(${SONNET})
      agent W [${HAIKU}, tools: auto]
        equips Files
      pipeline P(x: String) -> Result:
        x |> W.solve()`;
    const sonnet: MockRequest[] = [];
    const r = rt(src, {
      "W.solve": (req: MockRequest) => (req.step === 1 ? useTool("Files.list", {}) : (() => { throw new HaloError("haiku broke"); })()),
      [`W@${SONNET}`]: (req: MockRequest) => (sonnet.push(req), "4"),
    });
    expect(await r.execute("P", { x: "2+2?" })).toBe("4");
    expect(sonnet).toHaveLength(1);
    expect(sonnet[0]!.step).toBe(1);
    expect(sonnet[0]!.messages!.some((m) => m.role === "tool")).toBe(false);
  });
});

describe("@cascade validation", () => {
  test("a well-formed cascade has no diagnostics", () => {
    expect(messages(`@cascade(${SONNET}, ${OPUS})\nagent W [${HAIKU}]\npipeline P(x: String) -> Result:\n  x |> W.write()`)).toEqual([]);
  });

  test("needs a model, accepts agents, and flags names that are neither", () => {
    expect(messages(`@cascade()\nagent W [${HAIKU}]`)).toContain("error: @cascade needs at least one model to move up to, e.g. @cascade(anthropic/claude-opus-4-5)");
    expect(messages(`@cascade(Nobody)\nagent W [${HAIKU}]`)).toContain(`error: @cascade(Nobody) on "W": "Nobody" is not a model id or a defined agent`);
    expect(messages(`agent Big [${OPUS}]\n@cascade(Big)\nagent W [${HAIKU}]`).filter((m) => m.includes("cascade"))).toEqual([]);
  });

  test("warns about a model that repeats the agent's own or an earlier one", () => {
    expect(messages(`@cascade(${HAIKU})\nagent W [${HAIKU}]`)).toContain(`warning: @cascade on "W": "${HAIKU}" is already the agent's own model, so it adds nothing`);
    expect(messages(`@cascade(${OPUS}, ${OPUS})\nagent W [${HAIKU}]`)).toContain(`warning: @cascade on "W": "${OPUS}" is already earlier in the cascade, so it adds nothing`);
  });

  test("on a pipeline it is ignored, with a warning", () => {
    expect(messages(`@cascade(${OPUS})\npipeline P(x: String) -> Result:\n  x`)).toContain("warning: @cascade only applies to agents");
  });
});
