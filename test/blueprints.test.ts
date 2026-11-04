import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse, validate } from "../src/parser/index";
import { HaloRuntime, PolicyViolation, type MockRequest } from "../src/runtime/runtime";
import { BLUEPRINTS } from "../src/blueprints/index";

const root = resolve(`${import.meta.dir}/..`);
const work = mkdtempSync(join(tmpdir(), "halo-blueprints-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

function cliIn(cwd: string, ...args: string[]) {
  const p = Bun.spawnSync(["bun", join(root, "index.ts"), ...args], { cwd, env: { ...Bun.env, NO_COLOR: "1", HALO_API_KEY: "", ANTHROPIC_API_KEY: "" } });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

/** Every file in a blueprint folder, except local state. */
function filesIn(dir: string): string[] {
  return [...new Bun.Glob("**/*").scanSync({ cwd: dir, dot: true })].filter((f) => !f.startsWith(".halo/")).sort();
}

describe("blueprints", () => {
  for (const bp of Object.values(BLUEPRINTS)) {
    test(`${bp.name}: the CLI bundles exactly the files in blueprints/${bp.name}`, async () => {
      const dir = join(root, "blueprints", bp.name);
      expect(Object.keys(bp.files).sort()).toEqual(filesIn(dir));
      for (const [path, content] of Object.entries(bp.files)) expect(content).toBe(await Bun.file(join(dir, path)).text());
    });

    test(`${bp.name}: every pipeline validates with --strict`, () => {
      const r = cliIn(join(root, "blueprints", bp.name), "validate", "--strict", "pipelines/");
      expect(r.code).toBe(0);
      expect(r.out).toContain("0 error(s), 0 warning(s)");
    });

    test(`${bp.name}: halo.json and every sample are valid JSON`, () => {
      for (const [path, content] of Object.entries(bp.files)) if (path.endsWith(".json")) expect(() => JSON.parse(content)).not.toThrow();
    });
  }
});

describe("support-inbox", () => {
  const dir = join(root, "blueprints/support-inbox");
  const sample = async (name: string) => (await Bun.file(join(dir, "samples", name)).json()) as Record<string, unknown>;
  const mocks = async () => (await Bun.file(join(dir, "samples/mocks.json")).json()) as Record<string, unknown>;

  /** A runtime over the blueprint, with the canned model answers and a recorded Mail.send. */
  async function setup(answer: unknown = "approve", overrides: Record<string, unknown> = {}) {
    const ast = parse(await Bun.file(join(dir, "pipelines/support.halo")).text());
    const sent: Record<string, unknown>[] = [];
    const calls: string[] = [];
    const rt = new HaloRuntime({
      env: {},
      vectorPath: ":memory:",
      threadPath: ":memory:",
      checkpointDir: work,
      logger: { log() {}, warn() {} },
      onInterrupt: () => (typeof answer === "string" ? { approved: answer === "approve", action: answer } : answer),
      onEvent: (e) => {
        if (e.type === "llm" || e.type === "tool") calls.push((e as { agent?: string; tool?: string }).agent ?? (e as { tool?: string }).tool ?? "");
      },
    }).load(ast);
    const { Articles, Reader, Knowledge, Replies, ...canned } = await mocks();
    rt.mockAll({
      ...canned,
      "Seen.get": null,
      "Seen.set": { set: true },
      "Mail.send": (r: MockRequest) => {
        sent.push(r.named);
        return { sent: true, id: "test", to: [r.named.to] };
      },
      ...overrides,
    });
    return { rt, sent, calls };
  }

  test("a new email is triaged, drafted, approved, and the draft is sent to the sender", async () => {
    const { rt, sent } = await setup();
    const email = await sample("email.json");
    const r = await rt.run("HandleEmail", { email });
    expect(r.status).toBe("completed");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("dana@example.com");
    expect(sent[0]!.subject).toBe("Re: Teammate never got the invite");
    expect(String(sent[0]!.body)).toStartWith("Hi Dana,");
    await rt.close();
  });

  test("a reviewer's own text is sent instead of the draft", async () => {
    const { rt, sent } = await setup({ approved: true, reply: "Resent it for you. The support team" });
    const r = await rt.run("HandleEmail", { email: await sample("email.json") });
    expect(r.status).toBe("completed");
    expect(sent.map((s) => s.body)).toEqual(["Resent it for you. The support team"]);
    await rt.close();
  });

  test("a rejected draft sends nothing", async () => {
    const { rt, sent } = await setup("reject");
    const r = await rt.run("HandleEmail", { email: await sample("email.json") });
    expect(r.status).toBe("halted");
    expect(sent).toEqual([]);
    await rt.close();
  });

  test("a retried webhook (message already seen) stops before any model call", async () => {
    const { rt, sent, calls } = await setup("approve", { "Seen.get": true });
    const r = await rt.run("HandleEmail", { email: await sample("email.json") });
    expect(r.status).toBe("halted");
    expect(calls.filter((c) => c === "Triager" || c === "Writer")).toEqual([]);
    expect(sent).toEqual([]);
    await rt.close();
  });

  test("spam is dropped without a draft or a reply", async () => {
    const triage = { ...((await mocks())["Triager.classify"] as object), category: "spam" };
    const { rt, sent } = await setup("approve", { "Triager.classify": triage });
    const r = await rt.run("HandleEmail", { email: await sample("email.json") });
    expect(r.status).toBe("halted");
    expect(r.context.data.draft).toBeUndefined();
    expect(sent).toEqual([]);
    await rt.close();
  });

  test("an injection attempt in the email is blocked before a model sees it", async () => {
    const { rt, sent } = await setup();
    const err = await rt.run("HandleEmail", { email: await sample("email-injection.json") }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PolicyViolation);
    expect(sent).toEqual([]);
    await rt.close();
  });

  test("without a person, the run pauses before sending", async () => {
    const sent: unknown[] = [];
    const rt = new HaloRuntime({ env: {}, vectorPath: ":memory:", threadPath: ":memory:", logger: { log() {}, warn() {} } }).load(parse(await Bun.file(join(dir, "pipelines/support.halo")).text()));
    const { Articles, Reader, Knowledge, Replies, ...canned } = await mocks();
    rt.mockAll({ ...canned, "Seen.get": null, "Seen.set": { set: true }, "Mail.send": (r: MockRequest) => sent.push(r.named) });
    const r = await rt.run("HandleEmail", { email: await sample("email.json") });
    expect(r.status).toBe("paused");
    expect(r.context.meta.paused?.message).toContain("dana@example.com");
    expect(sent).toEqual([]);
    await rt.close();
  });

  test("--mocks: a typo'd target warns, and \"live\" only applies to tools", async () => {
    const bad = join(work, "bad-mocks.json");
    await Bun.write(bad, JSON.stringify({ "Triagr.classify": {}, Writer: "live" }));
    const r = cliIn(dir, "test", "pipelines/support.halo", "-p", "IndexKnowledge", "--mocks", bad);
    expect(r.err).toContain(`mock "Triagr.classify"`);
    expect(r.err).toContain(`"live" in ${bad} needs a tool or store name, got "Writer"`);
    expect(r.code).toBe(1);
  });

  test("halo init --template writes the blueprint, and it runs offline with the sample mocks", () => {
    const r = cliIn(work, "init", "acme-help", "--template", "support-inbox");
    expect(r.code).toBe(0);
    const project = join(work, "acme-help");
    expect(filesIn(project)).toEqual(Object.keys(BLUEPRINTS["support-inbox"]!.files).sort());
    expect(readdirSync(join(project, "knowledge")).length).toBe(4);

    const index = cliIn(project, "test", "pipelines/support.halo", "-p", "IndexKnowledge", "--mocks", "samples/mocks.json");
    expect(index.code).toBe(0);
    expect(index.out).toContain("Indexed 4 articles");

    // The article index is real (the stores are "live" in mocks.json): the right article is found.
    const run = cliIn(project, "test", "pipelines/support.halo", "-p", "HandleEmail", "--body", "samples/email.json", "--mocks", "samples/mocks.json", "--json");
    expect(run.code).toBe(0);
    const result = JSON.parse(run.out);
    expect(result.status).toBe("completed");
    expect(result.context.data.articles[0].metadata.source).toBe("inviting-teammates.md");
    expect(result.output).toEqual({ sent: true, id: "mock-email-id", to: ["dana@example.com"] });
  });

  test("fly.toml and the Dockerfile are filled in for the new project", async () => {
    const project = join(work, "Acme_Help");
    expect(cliIn(work, "init", "Acme_Help", "--template", "support-inbox").code).toBe(0);
    const fly = await Bun.file(join(project, "fly.toml")).text();
    expect(fly).toContain(`app = "acme-help"`);
    expect(fly).toContain("https://acme-help.fly.dev");
    const pkg = await Bun.file(join(root, "package.json")).json();
    expect(await Bun.file(join(project, "Dockerfile")).text()).toContain(`ARG HALO_VERSION=${pkg.version}\n`);
  });

  test("an unknown template is refused, with the list of templates", () => {
    const r = cliIn(work, "init", "x", "--template", "nope");
    expect(r.code).toBe(1);
    expect(r.err).toContain(`no template "nope"`);
    expect(r.err).toContain("support-inbox");
  });
});
