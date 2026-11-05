/**
 * Halo CLI
 *
 *   halo run <file.halo> [--pipeline <name>] [--arg key=value ...] [--args '<json>']
 *   halo debug <file.halo> ...
 *   halo test <file.halo> ...          (run --mock)
 *   halo resume <file.halo> <runId> --payload '<json|word>'
 *   halo validate <file.halo | dir ...>
 *   halo parse <file.halo>
 *   halo init [name] [--template <blueprint>]
 *   halo serve [files or folders] [--port 8080]
 *   halo plan <file.halo>              (what a run could do, before it runs)
 *   halo mcp <files or folders>        (serve pipelines as MCP tools over stdio)
 *   halo add | remove | install | tools | search | pack | publish   (tool packages)
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parse } from "./parser/index.js";
import { validate, type Diagnostic } from "./parser/validate.js";
import type { CallStage, ParseResult, PipelineStage, PipelineDeclaration } from "./parser/types.js";
import { AdapterRegistry } from "./runtime/adapter.js";
import { FileRunStore, HaloRuntime, stageLabel, type InterruptRequest, type ListenRequest, type RunResult, type RuntimeEvent } from "./runtime/runtime.js";
import { SqliteTelemetry } from "./runtime/telemetry.js";
import { initProject } from "./init.js";
import { argsFromBody, loadServeConfig, startServer, ServeError } from "./serve/server.js";
import { nextRun, parseCron } from "./serve/cron.js";
import { APPROVED, answerToEvent, formatValue } from "./runtime/values.js";
import pkg from "../package.json" with { type: "json" };
import { TOOL_PROVIDERS } from "./parser/builtins.js";
import { AGENT_PRESETS } from "./runtime/presets.js";
import { findSkill, skillCatalog, skillFiles } from "./runtime/skills.js";
import { formatPlan, plan, type PlanOptions } from "./plan.js";
import { findSteps, readSteps, stateAt } from "./runtime/history.js";
import { ThreadStore } from "./runtime/threads.js";
import { pruneRecordings, readRecording, Recorder, replayMocks } from "./runtime/replay.js";
import { createMcpServer, serveMcpStdio } from "./serve/mcp-server.js";
import { describePermissions, permissionsOf } from "./registry/manifest.js";
import { DEFAULT_REGISTRY, install, installFromLock, loadInstalled, pack, publish, readLock, search, uninstall, type LoadedProvider } from "./registry/packages.js";

const HELP = `
Halo CLI - AI Workflow Language

USAGE:
  halo run <file.halo> [options]        Run a pipeline
  halo debug <file.halo> [options]      Run with stage-by-stage tracing
  halo test <file.halo> [options]       Run offline: --mock plus --auto-approve
  halo resume <file.halo> <runId>       Continue a paused run (--payload '<json or word>')
  halo replay <file.halo> <runId>       Rerun a recorded run with the answers it got: no model
                                        or tool calls (--live-models or --live-tools to redo one side)
  halo rewind <file.halo> <runId> --step N
                                        Go back to a step of a @checkpoint run and continue
                                        from there as a new run (--yes if stages after it
                                        write or call out; --mock to try it offline)
  halo threads [--json]                 List the threads @thread pipelines keep (.halo/threads.sqlite)
  halo thread <name> <key>              Show a thread's state and the runs that changed it
                                        (--reset --yes deletes its state; --json)
  halo history <runId|steps file>       List every step of a @checkpoint run (--step N: the
                                        state after step N; --json for the raw steps)
  halo validate <file.halo|dir ...>     Check syntax and semantics
  halo parse <file.halo>                Print the AST as JSON
  halo init [name] [--template <name>]  Create a new Halo project, or a deployable app from a
                                        blueprint (support-inbox)
  halo upgrade                          Update an installed halo to the latest release
  halo serve [files|dirs ...]           Serve pipelines: HTTP API, webhooks, schedules,
                                        approval links, MCP at /mcp, and Halo Studio at /
  halo plan <file.halo>                 Show what a run could do: model calls and worst-case
                                        cost, tool calls and their effects, approvals
  halo mcp [files|dirs ...]             Serve pipelines as MCP tools over stdio

TOOL PACKAGES:
  halo search [query]                   Find tool packages in the registry
  halo add <name[@version]|file|url|dir> Install a tool package (--trust if it runs code)
  halo remove <name>                    Uninstall a tool package
  halo install [--trust]                Install everything halo.lock pins (--trust: also the
                                        packages that run code; trust is never read from the lock)
  halo tools [--json]                   List every tool provider and its methods
  halo agents [--json]                  List the built-in agent presets (agent X [model, preset: Name])
  halo skills [name] [--dir skills]     List skills (yours and built-in), or print one
  halo pack <dir>                       Bundle a package folder into a .halotool file
  halo publish <file.halotool> --registry <index.json>   Add it to a registry index

RUN OPTIONS:
  --pipeline, -p <name>  Pipeline to run (default: the file's entry pipeline)
  --arg <key=value>      Input argument (repeatable; values parse as JSON when possible)
  --args '<json>'        Input arguments as a JSON object
  --mock                 Mock every agent and tool call (no network, no API keys)
  --mocks <file.json>    Canned answers by target ("Agent.method", "Tool", "yield", ...);
                         "live" on a tool runs it for real under --mock
  --body <file.json>     Arguments from a JSON body, the way a webhook maps it
  --auto-approve         Approve every |! yield and ~> listen automatically
  --checkpoint <file>    Resume from a @checkpoint snapshot
  --api-key <key>        API key for any provider without its own env var
  --router '<json>'      Router configuration, e.g. '{"strategy":"cost-optimized"}'
  --json                 Print the full run result (output, meta, trace) as JSON
  --no-telemetry         Don't record this run for Halo Studio (.halo/telemetry.db)
  --no-record            Don't keep a recording for halo replay (.halo/recordings)

  Without a terminal (and without --auto-approve), a run that reaches |! yield
  or ~> listen pauses and prints the command that continues it.

RESUME OPTIONS:
  --payload <value>      The response: JSON, or a word like approve/reject (default: approve)
  --event <name>         What the run is waiting for (default: whatever it is waiting for)

SERVE OPTIONS:
  --port <n>             Port (default 8080)
  --host <addr>          Interface (default 127.0.0.1; others need HALO_SERVE_TOKEN)
  --config <file>        Config file (default ./halo.json if present): schedules,
                         webhooks, notify.slack, publicUrl, files
  --no-studio            Don't serve Halo Studio

VALIDATE OPTIONS:
  --strict               Treat warnings as errors

ENVIRONMENT:
  OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY,
  TOGETHER_API_KEY, REPLICATE_API_TOKEN, HALO_API_KEY (fallback), OLLAMA_HOST

EXAMPLES:
  halo run examples/01-hello.halo --arg name=World --mock
  halo debug examples/06-gates.halo --arg name=Ana --arg lang=es --mock
  halo validate examples/
`;

// ── Output helpers ──

const useColor = process.stdout.isTTY && !Bun.env.NO_COLOR;
const paint = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint(31);
const yellow = paint(33);
const green = paint(32);
const dim = paint(2);
const bold = paint(1);

class CliError extends Error {}

function fail(message: string): never {
  throw new CliError(message);
}

// ── Argument parsing ──

interface Flags {
  positional: string[];
  values: Map<string, string[]>;
  bools: Set<string>;
}

const BOOL_FLAGS = new Set(["yes", "reset", "mock", "auto-approve", "json", "strict", "help", "version", "no-telemetry", "no-studio", "trust", "no-record", "live-models", "live-tools", "no-builtin"]);
const RECORDINGS = ".halo/recordings";
const CHECKPOINTS = ".halo/checkpoints";
const THREADS = ".halo/threads.sqlite";
const ALIASES: Record<string, string> = { p: "pipeline", s: "pipeline", stream: "pipeline", resume: "checkpoint", h: "help", v: "version" };

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { positional: [], values: new Map(), bools: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("-") || arg === "-") {
      flags.positional.push(arg);
      continue;
    }
    let [key, inline] = arg.replace(/^--?/, "").split(/=(.*)/s, 2) as [string, string | undefined];
    key = ALIASES[key] ?? key;
    if (BOOL_FLAGS.has(key)) {
      flags.bools.add(key);
      continue;
    }
    const value = inline ?? argv[++i];
    if (value === undefined) fail(`--${key} needs a value`);
    flags.values.set(key, [...(flags.values.get(key) ?? []), value]);
  }
  return flags;
}

const last = (flags: Flags, key: string) => flags.values.get(key)?.at(-1);

function parseJsonish(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function inputArgs(flags: Flags): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const json = last(flags, "args");
  if (json !== undefined) {
    const parsed = parseJsonish(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) Object.assign(args, parsed);
    // Legacy form: --args name:Alice,lang:en
    else if (/^\w+:/.test(json)) for (const pair of json.split(",")) {
      const [k, ...v] = pair.split(":");
      if (k) args[k.trim()] = v.join(":").trim();
    } else fail(`--args must be a JSON object, e.g. --args '{"name": "World"}'`);
  }
  for (const kv of flags.values.get("arg") ?? []) {
    const eq = kv.indexOf("=");
    if (eq <= 0) fail(`--arg expects key=value, got "${kv}"`);
    args[kv.slice(0, eq)] = parseJsonish(kv.slice(eq + 1));
  }
  return args;
}

// ── Loading ──

async function load(file: string | undefined): Promise<{ path: string; ast: ParseResult }> {
  if (!file) fail("No .halo file specified");
  const path = resolve(file);
  const f = Bun.file(path);
  if (!(await f.exists())) fail(`File not found: ${file}`);
  const ast = parse(await f.text());
  if (ast.errors.length) {
    fail(`Parse errors in ${relative(process.cwd(), path)}:\n${ast.errors.map((e) => "  " + e).join("\n")}`);
  }
  return { path, ast };
}

function formatDiag(d: Diagnostic, file: string): string {
  const where = d.line ? `${file}:${d.line}:${d.column ?? 0}` : file;
  const tag = d.severity === "error" ? red("error") : yellow("warning");
  return `${dim(where)} ${tag} ${d.message}`;
}

const registry = new AdapterRegistry();
const canHandleModel = (id: string) => !!registry.findAdapter(id);

/** Providers from the tool packages halo.lock (in the current folder) pins. */
let installedTools: Promise<LoadedProvider[]> | undefined;
async function installed(): Promise<LoadedProvider[]> {
  installedTools ??= loadInstalled(process.cwd());
  try {
    return await installedTools;
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

// Checking a file only needs the names of installed providers: no package code is loaded for it.
const validateOptions = async () => ({ canHandleModel, toolProviders: Object.values(readLock(process.cwd()).tools).flatMap((t) => t.providers) });

function registerInstalled(rt: HaloRuntime, providers: LoadedProvider[]) {
  for (const p of providers) rt.registerToolProvider(p.name, p.provider, p.info);
}

function collectFiles(targets: string[]): string[] {
  const files: string[] = [];
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) {
      for (const entry of readdirSync(p).sort()) if (!entry.startsWith(".") && entry !== "node_modules") walk(join(p, entry));
    } else if (p.endsWith(".halo")) files.push(p);
  };
  for (const t of targets) {
    try {
      walk(t);
    } catch {
      fail(`File not found: ${t}`);
    }
  }
  return files;
}

// ── Commands ──

async function cmdValidate(flags: Flags): Promise<number> {
  const files = collectFiles(flags.positional.length ? flags.positional : ["."]);
  if (!files.length) fail("No .halo files found");
  let errors = 0;
  let warnings = 0;
  for (const file of files) {
    const rel = relative(process.cwd(), file) || file;
    const ast = parse(await Bun.file(file).text());
    const diags: Diagnostic[] = ast.errors.length
      ? ast.errors.map((message) => {
          const m = message.match(/^\[(\d+):(\d+)\] (.*)$/s);
          return m ? { severity: "error", message: m[3]!, line: Number(m[1]), column: Number(m[2]) } : { severity: "error", message };
        })
      : validate(ast, await validateOptions());
    const e = diags.filter((d) => d.severity === "error").length;
    errors += e;
    warnings += diags.length - e;
    if (!diags.length) {
      console.log(`${green("✓")} ${rel}`);
      continue;
    }
    console.log(`${e ? red("✗") : yellow("!")} ${rel}`);
    for (const d of diags) console.log("  " + formatDiag(d, rel));
  }
  const summary = `${files.length} file(s), ${errors} error(s), ${warnings} warning(s)`;
  console.log(`\n${errors ? red(summary) : warnings ? yellow(summary) : green(summary)}`);
  return errors || (flags.bools.has("strict") && warnings) ? 1 : 0;
}

async function cmdParse(flags: Flags): Promise<number> {
  const { ast } = await load(flags.positional[0]);
  console.log(JSON.stringify(ast, null, 2));
  return 0;
}

function pickStream(ast: ParseResult, name: string | undefined): PipelineDeclaration {
  if (name) {
    const s = ast.pipelines.find((s) => s.name === name);
    if (!s) fail(`Pipeline "${name}" not found. Available: ${ast.pipelines.map((s) => s.name).join(", ")}`);
    return s;
  }
  if (ast.pipelines.length === 0) fail("No pipelines found in file");
  // Default to the entry point: the one pipeline no other pipeline calls.
  const called = new Set(ast.pipelines.flatMap((s) => s.pipeline.flatMap(calls)).filter((c) => !c.method).map((c) => c.callee));
  const entries = ast.pipelines.filter((s) => !called.has(s.name));
  if (entries.length === 1) return entries[0]!;
  fail(`File has ${ast.pipelines.length} pipelines; pick one with --pipeline (${ast.pipelines.map((s) => s.name).join(", ")})`);
}

/** Every call a stage makes, including those inside fan-out, branch, and each. */
function calls(stage: PipelineStage): CallStage[] {
  switch (stage.kind) {
    case "call": return [stage];
    case "fanout": return stage.stages;
    case "branch": return stage.arms.map((a) => a.call);
    case "each": return [stage.call];
    default: return [];
  }
}

const AUTO_EVENT = APPROVED;

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function promptInterrupt(req: InterruptRequest): Promise<unknown> {
  const lines = [bold(`\n⏸  ${req.pipeline} needs a human${req.channel ? ` (${req.channel})` : ""}`), req.message ?? formatValue(req.current)];
  for (const a of req.attachments) lines.push(dim(`  • ${formatValue(a)}`));
  console.error(lines.join("\n"));
  // Letting an agent act needs a typed yes: Enter alone declines it.
  if (req.channel === "approval") {
    const answer = await ask(`Allow? [y/N, or say why not]: `);
    return answer ? toEvent(answer) : "no";
  }
  const answer = await ask(`Response [approve/reject/...]: `);
  return answer ? toEvent(answer) : AUTO_EVENT;
}

const toEvent = answerToEvent;

async function promptListen(req: ListenRequest): Promise<unknown> {
  console.error(bold(`\n👂 ${req.pipeline} is waiting for ${req.target}`));
  const answer = await ask(`Event (JSON or a word like approve/reject) [approve]: `);
  return answer ? toEvent(answer) : AUTO_EVENT;
}

function mockRuntime(rt: HaloRuntime, ast: ParseResult, live: Set<string> = new Set()): void {
  const preview = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").slice(0, 80);
  const mocks: Record<string, unknown> = {
    "*": (req: { target: string; prompt?: string }) => `[mock ${req.target}] ${preview(req.prompt)}`,
  };
  for (const t of [...ast.tools, ...ast.stores]) {
    if (live.has(t.name)) continue;
    mocks[t.name] = (req: { target: string; args: unknown[]; named: Record<string, unknown> }) => ({ mock: true, tool: req.target, named: req.named });
  }
  rt.mockAll(mocks);
}

/**
 * `--mocks <file.json>`: canned answers, keyed like `runtime.mockAll` (`Agent.method`, `Agent`,
 * `Tool.method`, `Tool`, `*`, `yield`, a listen target). The value `"live"` on a tool's name runs
 * that tool for real under --mock (e.g. a local KV or VectorStore), so a test can use real state.
 */
async function readMocks(file: string, ast: ParseResult, source: string): Promise<{ mocks: Record<string, unknown>; live: Set<string> }> {
  const f = Bun.file(file);
  if (!(await f.exists())) fail(`Mocks file not found: ${file}`);
  let data: unknown;
  try {
    data = await f.json();
  } catch (e) {
    fail(`Mocks file ${file} is not valid JSON: ${e instanceof Error ? e.message : e}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail(`Mocks file ${file} must be a JSON object of target → answer`);
  const tools = new Set([...ast.tools, ...ast.stores].map((t) => t.name));
  const names = new Set([...tools, ...ast.agents.map((a) => a.name)]);
  const mocks: Record<string, unknown> = {};
  const live = new Set<string>();
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    // A listen target (Slack.Reaction) isn't declared, but it is written in the file.
    if (key !== "*" && key !== "yield" && !names.has(key.split(".")[0]!) && !source.includes(key)) {
      console.error(yellow(`Warning: mock "${key}" in ${file} matches no agent, tool, or listen target`));
    }
    if (value === "live") {
      if (!tools.has(key)) fail(`"live" in ${file} needs a tool or store name, got "${key}"`);
      live.add(key);
    } else mocks[key] = value;
  }
  return { mocks, live };
}

function tracer(debug: boolean): (e: RuntimeEvent) => void {
  // A violation that @correct sends back is shown as a correction, not as a failure,
  // so hold each violation until the next event says which it was.
  let pending: Extract<RuntimeEvent, { type: "violation" }> | undefined;
  return (e) => {
    if (pending && e.type !== "correction") console.error(red(`  ⛔ ${pending.policy}/${pending.rule}: ${pending.message}`));
    if (e.type !== "violation") pending = undefined;
    if (e.type === "violation") pending = e;
    if (e.type === "correction") console.error(yellow(`  ✎ ${e.target}: ${e.error}; asked to fix it (attempt ${e.attempt + 1})`));
    if (e.type === "retry") console.error(yellow(`  ↻ retry ${e.target} (attempt ${e.attempt}): ${e.error}`));
    if (!debug) return;
    if (e.type === "stage" && e.status === "start") console.error(dim(`▶ [${e.index}] ${e.label}`));
    if (e.type === "stage" && e.status === "end") console.error(dim(`  ✓ ${e.durationMs}ms → ${formatValue(e.value).replace(/\s+/g, " ").slice(0, 120)}`));
    if (e.type === "llm") {
      console.error(dim(`  ↳ ${e.agent} via ${e.model}${e.mocked ? " (mock)" : ""}, ${e.latencyMs}ms, $${e.cost.toFixed(5)}`));
      if (e.system) console.error(dim(`    system: ${e.system.replace(/\n/g, "\n            ")}`));
      console.error(dim(`    prompt: ${e.prompt.replace(/\n/g, "\n            ")}`));
    }
    if (e.type === "tool") console.error(dim(`  ↳ tool ${e.tool}.${e.method}${e.mocked ? " (mock)" : ""}, ${e.latencyMs}ms`));
    if (e.type === "halt") console.error(yellow(`  ⏹ gate closed: ${e.condition}`));
    if (e.type === "branch") console.error(dim(`  ⑂ ${e.arm < 0 ? "no arm matched; value passes through" : e.condition === undefined ? "else" : `(${e.condition})`}`));
    if (e.type === "loop") console.error(yellow(`  ↺ loop ${e.iteration}: ${e.condition} → back to stage ${e.to}`));
    if (e.type === "checkpoint") console.error(dim(`  💾 ${e.path}`));
  };
}

async function cmdRun(flags: Flags, debug: boolean, resumeRun?: string, replayRun?: string, rewind?: { runId: string; step: number }): Promise<number> {
  const { path, ast } = await load(flags.positional[0]);
  const rel = relative(process.cwd(), path);

  const diags = validate(ast, await validateOptions());
  for (const d of diags) console.error(formatDiag(d, rel));
  if (diags.some((d) => d.severity === "error")) return 1;

  const mock = flags.bools.has("mock");
  const mocksPath = last(flags, "mocks");
  const fileMocks = mocksPath ? await readMocks(mocksPath, ast, await Bun.file(path).text()) : undefined;
  const autoApprove = flags.bools.has("auto-approve");
  const routerJson = last(flags, "router");
  const telemetry = flags.bools.has("no-telemetry") ? undefined : new SqliteTelemetry(".halo/telemetry.db");
  const trace = tracer(debug);
  const replaying = replayRun ? readRecording(RECORDINGS, replayRun) : undefined;
  // Every real run keeps a recording, so it can be replayed (a resumed run adds to its own).
  const runId = resumeRun ?? crypto.randomUUID();
  // A rewound run's recording would miss what came before its step, so it couldn't be replayed.
  const recorder = mock || fileMocks || replaying || rewind || flags.bools.has("no-record") || last(flags, "checkpoint") ? undefined : new Recorder(RECORDINGS, runId);
  const rt = new HaloRuntime({
    recorder: recorder?.record,
    apiKey: last(flags, "api-key"),
    router: routerJson ? (parseJsonish(routerJson) as object) : undefined,
    // In a terminal, ask; otherwise pause the run (it is saved to .halo/runs) unless auto-approving.
    onInterrupt: autoApprove ? () => AUTO_EVENT : process.stdin.isTTY ? promptInterrupt : undefined,
    onListen: autoApprove ? () => AUTO_EVENT : process.stdin.isTTY ? promptListen : undefined,
    runStore: new FileRunStore(".halo/runs"),
    // Mock runs keep thread state in memory, so they never change a real thread.
    threadPath: mock ? ":memory:" : THREADS,
    onEvent: (e) => {
      trace(e);
      telemetry?.handler(e);
    },
  }).load(ast);
  registerInstalled(rt, await installed());
  if (mock) mockRuntime(rt, ast, fileMocks?.live);
  if (fileMocks) rt.mockAll(fileMocks.mocks);
  if (replaying) {
    const tools = [...ast.tools, ...ast.stores].map((t) => t.name);
    // Recordings from before yields were recorded approve them, as halo test does.
    rt.mockAll({ yield: AUTO_EVENT, ...replayMocks(replaying, { liveModels: flags.bools.has("live-models"), liveTools: flags.bools.has("live-tools"), tools }) });
  }

  let result: RunResult;
  const checkpoint = last(flags, "checkpoint");
  try {
    if (resumeRun) {
      const payloadText = last(flags, "payload");
      const payload = payloadText === undefined ? AUTO_EVENT : toEvent(payloadText);
      const saved = await new FileRunStore(".halo/runs").load(resumeRun);
      if (!saved) fail(`No paused run "${resumeRun}" in .halo/runs`);
      result = await rt.signal(resumeRun, last(flags, "event") ?? saved.waitingFor ?? "yield", payload);
    } else if (rewind) {
      const steps = findSteps(CHECKPOINTS, rewind.runId);
      const checkpointFile = steps.replace(/\.steps\.jsonl$/, ".json");
      const { step } = stateAt(await readSteps(steps), rewind.step);
      const pipelineName = ((await Bun.file(checkpointFile).json()) as { pipeline: string }).pipeline;
      // Stages after the step run again for real: say which ones change something, and want a yes for them.
      const again = rerunEffects(ast, pipelineName, step.next, (provider) => rt.toolProviderInfo(provider));
      if (again.length && !mock) {
        const list = again.map((e) => `  stage ${e.stage} ${e.target}: ${e.effect}${e.approval ? ` (needs approval: ${e.approval})` : ""}`).join("\n");
        if (!flags.bools.has("yes")) fail(`Going back to step ${rewind.step} runs these again:\n${list}\nPass --yes to run them, or --mock to try it offline.`);
        console.error(yellow(`Running again:\n${list}`));
      }
      result = await rt.rewind(checkpointFile, rewind.step);
      console.error(dim(`Rewound from run ${rewind.runId} at step ${rewind.step} (stage ${step.stage} ${step.label})`));
    } else if (checkpoint) {
      result = await rt.resume(checkpoint);
    } else if (replaying) {
      result = await rt.run(replaying.pipeline, replaying.args);
    } else {
      const pipeline = pickStream(ast, last(flags, "pipeline"));
      // --body <file.json>: the arguments a webhook would get from that body; --arg/--args add to them.
      const bodyPath = last(flags, "body");
      let body: unknown;
      if (bodyPath) {
        if (!(await Bun.file(bodyPath).exists())) fail(`Body file not found: ${bodyPath}`);
        body = await Bun.file(bodyPath).json().catch((e: unknown) => fail(`Body file ${bodyPath} is not valid JSON: ${e instanceof Error ? e.message : e}`));
      }
      const args = { ...(bodyPath ? argsFromBody(pipeline, body) : {}), ...inputArgs(flags) };
      const missing = pipeline.params.filter((p) => !(p.name in args)).map((p) => p.name);
      if (missing.length) {
        fail(`Missing argument(s) for ${pipeline.name}(${pipeline.params.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${missing.join(", ")}\n  Pass them with ${missing.map((m) => `--arg ${m}=...`).join(" ")}`);
      }
      recorder?.start(pipeline.name, args);
      pruneRecordings(RECORDINGS);
      result = await rt.run(pipeline.name, args, { runId });
    }
    recorder?.finish({ status: result.status, output: result.output });
  } catch (err) {
    recorder?.finish({ status: "error", error: err instanceof Error ? err.message : String(err) });
    throw err;
  } finally {
    await rt.close();
    telemetry?.close();
  }

  if (flags.bools.has("json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const pipeline = ast.pipelines.find((s) => s.name === result.context.meta.pipeline)!;
    const lastStage = pipeline.pipeline.at(-1);
    const printed = result.status === "completed" && lastStage?.kind === "call" && lastStage.callee === "System" && lastStage.method === "Print";
    if (!printed && result.status !== "paused") console.log(formatValue(result.output));
  }

  const meta = result.context.meta;
  if (replaying) {
    const same = replaying.end && replaying.end.status === result.status && JSON.stringify(replaying.end.output) === JSON.stringify(result.output);
    console.error(same ? green(`✓ Same output as the recorded run ${replayRun}`) : yellow(`≠ Different from the recorded run ${replayRun}${replaying.end ? ` (it ${replaying.end.status === "error" ? `failed: ${replaying.end.error}` : `ended ${replaying.end.status} with ${formatValue(replaying.end.output).slice(0, 200)}`})` : ""}`));
  }
  if (result.status === "halted" && meta.halted) {
    const stage = stageAt(ast, meta.pipeline, meta.halted.stage);
    console.error(yellow(`⏹ Halted at stage ${meta.halted.stage} ${stage}`));
  }
  if (result.status === "paused" && meta.paused) {
    const what = meta.paused.waitingFor === "yield" ? "a human response" : meta.paused.waitingFor;
    console.error(yellow(`⏸ Paused at stage ${meta.paused.stage} ${stageAt(ast, meta.pipeline, meta.paused.stage)}, waiting for ${what}${meta.paused.message ? `: ${meta.paused.message}` : ""}`));
    console.error(`  Continue with: halo resume ${rel} ${result.runId} --payload approve`);
  }
  const llmCalls = meta.calls.filter((c) => c.kind !== "tool").length;
  const parts = [`${meta.durationMs}ms`, `${llmCalls} LLM call(s)`, `${meta.calls.length - llmCalls} tool call(s)`];
  if (meta.cost > 0) parts.push(`$${meta.cost.toFixed(4)}`);
  if (meta.tokens.prompt + meta.tokens.completion > 0) parts.push(`${meta.tokens.prompt}+${meta.tokens.completion} tokens`);
  if (meta.checkpoint) parts.push(`checkpoint ${meta.checkpoint}`);
  if (recorder) parts.push(`run ${result.runId} (halo replay ${rel} ${result.runId})`);
  console.error(dim(parts.join(" · ")));
  return 0;
}

function stageAt(ast: ParseResult, pipeline: string, index: number): string {
  const stage = ast.pipelines.find((s) => s.name === pipeline)?.pipeline[index];
  return stage ? stageLabel(stage) : "";
}

async function cmdServe(flags: Flags): Promise<number> {
  const config = await loadServeConfig(last(flags, "config"));
  const port = last(flags, "port");
  let server;
  try {
    server = await startServer({
      ...config,
      files: flags.positional.length ? flags.positional : config.files,
      port: port !== undefined ? Number(port) : config.port,
      host: last(flags, "host") ?? config.host,
      studio: !flags.bools.has("no-studio"),
    });
  } catch (err) {
    if (err instanceof ServeError) fail(err.message);
    throw err;
  }
  console.log(bold(`\nHalo is serving ${server.pipelines.length} pipeline(s) at ${server.url}`));
  if (!flags.bools.has("no-studio")) console.log(`  Studio     ${server.url}/`);
  console.log(`  API        POST ${server.url}/api/pipelines/<name>/runs  {"args": {...}}`);
  for (const w of config.webhooks ?? []) console.log(`  Webhook    POST ${server.url}/hooks/${w.path.replace(/^\/+/, "")} → ${w.pipeline}`);
  for (const s of config.schedules ?? []) {
    let next = "";
    try {
      next = nextRun(parseCron(s.cron), new Date())?.toLocaleString() ?? "never";
    } catch {}
    console.log(`  Schedule   ${s.cron} → ${s.pipeline}${next ? dim(` (next ${next})`) : ""}`);
  }
  console.log(dim("  Paused runs get an approval link (logged here; also sent to notify.slack if set). Ctrl-C to stop.\n"));

  await new Promise<void>((done) => {
    const stop = () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      console.log(dim("\nStopping (waiting for running pipelines to reach a stopping point)..."));
      void server.stop().then(done);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
  return 0;
}

// ── Plans and MCP ──

async function cmdPlan(flags: Flags): Promise<number> {
  const { path, ast } = await load(flags.positional[0]);
  const diags = validate(ast, await validateOptions());
  for (const d of diags.filter((x) => x.severity === "error")) console.error(formatDiag(d, relative(process.cwd(), path)));
  const rt = new HaloRuntime({ logger: { log() {}, warn() {} } });
  registerInstalled(rt, await installed());
  const target = last(flags, "pipeline");
  const names = target ? [pickStream(ast, target).name] : ast.pipelines.map((p) => p.name);
  const plans = names.map((name) => plan(ast, name, { providerInfo: (provider) => rt.toolProviderInfo(provider) }));
  if (flags.bools.has("json")) console.log(JSON.stringify(plans.length === 1 ? plans[0] : plans, null, 2));
  else console.log(plans.map((p) => formatPlan(p, { bold, dim, red, yellow })).join("\n\n"));
  return diags.some((d) => d.severity === "error") ? 1 : 0;
}

/**
 * Tool calls that change something (or might: effect not described) in the stages from `from` on.
 * A loop after `from` can jump back before it, so then every stage counts.
 */
function rerunEffects(ast: ParseResult, pipeline: string, from: number, providerInfo: PlanOptions["providerInfo"]) {
  const steps = plan(ast, pipeline, { providerInfo }).steps;
  const decl = ast.pipelines.find((p) => p.name === pipeline);
  const start = decl?.pipeline.some((s, i) => i >= from && s.kind === "loop") ? 0 : from;
  return steps
    .filter((s) => Number.parseInt(s.at) >= start)
    .flatMap((s) => s.effects.filter((e) => e.effect !== "read").map((e) => ({ stage: Number.parseInt(s.at), ...e })));
}

function cmdThreads(flags: Flags): number {
  if (!existsSync(THREADS)) {
    if (flags.bools.has("json")) console.log("[]");
    else console.log(dim(`No threads yet (${THREADS})`));
    return 0;
  }
  const store = new ThreadStore(THREADS);
  try {
    const threads = store.list();
    if (flags.bools.has("json")) console.log(JSON.stringify(threads, null, 2));
    else if (!threads.length) console.log(dim("No threads"));
    else for (const t of threads) console.log(`${bold(t.name)} ${t.key}  ${dim(`v${t.version} · ${t.runs} run(s) · ${t.updatedAt} · ${Object.keys(t.state).join(", ") || "empty"}`)}`);
  } finally {
    store.close();
  }
  return 0;
}

/** Show one thread, or reset it (which wants --yes, since nothing brings it back). */
function cmdThread(flags: Flags): number {
  const [name, key] = flags.positional;
  if (!name || key === undefined) fail("Usage: halo thread <name> <key> [--json] [--reset --yes]");
  if (!existsSync(THREADS)) fail(`No thread ${name} ${key}: there are no threads yet (${THREADS})`);
  const store = new ThreadStore(THREADS);
  try {
    const t = store.get(name, key);
    if (flags.bools.has("reset")) {
      if (!t) fail(`No thread ${name} ${key}`);
      if (!flags.bools.has("yes")) {
        fail(`This deletes thread ${name} ${key} (v${t.version}, ${t.runs} run(s), fields: ${Object.keys(t.state).join(", ") || "none"}). Its log is kept. Pass --yes to delete it.`);
      }
      store.reset(name, key);
      console.log(`Reset thread ${name} ${key} (it was v${t.version})`);
      return 0;
    }
    const log = store.log(name, key);
    if (!t && !log.length) fail(`No thread ${name} ${key}`);
    if (flags.bools.has("json")) {
      console.log(JSON.stringify({ thread: t ?? null, log }, null, 2));
      return 0;
    }
    if (t) {
      console.log(bold(`${name} ${key}`) + dim(` · v${t.version} · ${t.runs} run(s) · updated ${t.updatedAt}`));
      console.log(JSON.stringify(t.state, null, 2));
    } else console.log(bold(`${name} ${key}`) + dim(" · reset (no state)"));
    console.log(bold("\nChanges, newest first"));
    for (const e of log) {
      const what = e.ops === "reset" ? yellow("reset") : e.ops.map((o) => (o.op === "clear" ? `clear ${o.names?.join(", ") ?? "all"}` : `${o.op} ${Object.keys(o.fields).join(", ")}`)).join("; ");
      console.log(`  v${e.version}  ${dim(e.at)}  ${e.runId ? dim(`run ${e.runId}`) : ""}  ${what}`);
    }
  } finally {
    store.close();
  }
  return 0;
}

/** List a @checkpoint run's steps, or show its state after one of them. */
async function cmdHistory(flags: Flags): Promise<number> {
  const target = flags.positional[0];
  if (!target) fail("Usage: halo history <runId|steps file> [--step N] [--json]");
  const path = target.endsWith(".jsonl") ? target : findSteps(CHECKPOINTS, target);
  const steps = await readSteps(path);
  const stepText = last(flags, "step");
  if (stepText !== undefined) {
    const n = Number(stepText);
    if (!Number.isInteger(n)) fail(`--step takes a step number, not "${stepText}"`);
    const state = stateAt(steps, n);
    if (flags.bools.has("json")) console.log(JSON.stringify(state, null, 2));
    else {
      const s = state.step;
      console.log(bold(`Step ${s.step}: stage ${s.stage} ${s.label}`) + dim(` · ${s.at} · next stage ${s.next}${s.halted ? " · halted" : ""}`));
      console.log(`${bold("current")} ${formatValue(state.current)}`);
      console.log(`${bold("data")} ${JSON.stringify(state.data, null, 2)}`);
    }
    return 0;
  }
  if (flags.bools.has("json")) {
    console.log(JSON.stringify(steps, null, 2));
    return 0;
  }
  console.log(dim(path));
  for (const s of steps) {
    const changed = [...Object.keys(s.set), ...(s.unset ?? []).map((k) => `-${k}`)];
    const cost = s.cost > 0 ? ` $${s.cost.toFixed(4)}` : "";
    console.log(`${bold(String(s.step).padStart(4))}  ${dim(s.at.slice(11, 23))}  ${`stage ${s.stage}`.padEnd(9)} ${s.label}${s.halted ? yellow(" ⏹ halted") : ""}${dim(cost)}${changed.length ? dim(`  → ${changed.join(", ")}`) : ""}`);
  }
  return 0;
}

/** Serve pipelines as MCP tools over stdio. Nothing but protocol messages may go to stdout. */
async function cmdMcp(flags: Flags): Promise<number> {
  const files = collectFiles(flags.positional.length ? flags.positional : ["."]);
  if (!files.length) fail("No .halo files found");
  const providers = await installed();
  const toStderr = { log: (...a: unknown[]) => console.error(...a), warn: (...a: unknown[]) => console.error(...a) };
  const entries = new Map<string, { rt: HaloRuntime; decl: PipelineDeclaration; file: string }>();
  const runtimes: HaloRuntime[] = [];
  for (const file of files) {
    const ast = parse(await Bun.file(file).text());
    const rel = relative(process.cwd(), file);
    if (ast.errors.length) fail(`Parse errors in ${rel}`);
    if (validate(ast, await validateOptions()).some((d) => d.severity === "error")) fail(`${rel} has errors; run halo validate`);
    const rt = new HaloRuntime({ logger: toStderr, runStore: new FileRunStore(".halo/runs") }).load(ast);
    registerInstalled(rt, providers);
    runtimes.push(rt);
    for (const decl of ast.pipelines) entries.set(decl.name, { rt, decl, file: rel });
  }
  const server = createMcpServer(
    {
      list: () => [...entries.values()].map((e) => ({ name: e.decl.name, description: `Halo pipeline ${e.decl.name} from ${e.file}`, params: e.decl.params })),
      call: async (name, args, signal) => {
        const e = entries.get(name);
        if (!e) return { status: "failed", runId: "", error: `No pipeline "${name}"` };
        try {
          const r = await e.rt.run(name, args, { signal });
          return { status: r.status, output: r.output, runId: r.runId, waitingFor: r.context.meta.paused?.waitingFor };
        } catch (err) {
          return { status: "failed", runId: "", error: err instanceof Error ? err.message : String(err) };
        }
      },
    },
    { name: "halo", version: pkg.version },
  );
  console.error(dim(`Halo MCP server: ${entries.size} pipeline(s) as tools, on stdio`));
  try {
    await serveMcpStdio(server);
  } finally {
    await Promise.all(runtimes.map((rt) => rt.close()));
  }
  return 0;
}

// ── Upgrading an installed binary ──

/** Running as the standalone binary from halolang.com/install.sh (not `bun index.ts` in a checkout)? */
const compiled = () => Bun.main.startsWith("/$bunfs/") || /[\\/]~BUN[\\/]/.test(Bun.main);

async function cmdUpgrade(): Promise<number> {
  if (!compiled()) {
    console.log(`This halo runs from a checkout of the source (${process.execPath} ${Bun.main}); update it with git pull.`);
    return 0;
  }
  const latest = (await (await fetch("https://halolang.com/dl/latest.json")).json()) as { version: string };
  if (latest.version === pkg.version) {
    console.log(`${green("✓")} halo ${pkg.version} is the latest release.`);
    return 0;
  }
  console.log(`Upgrading halo ${pkg.version} → ${latest.version}`);
  // The installer replaces this binary where it is, and leaves PATH alone.
  const installDir = resolve(process.execPath, "..", "..");
  const env = { ...process.env, HALO_INSTALL: installDir, HALO_NO_MODIFY_PATH: "1", HALO_VERSION: latest.version };
  const cmd = process.platform === "win32" ? ["powershell", "-NoProfile", "-Command", "irm https://halolang.com/install.ps1 | iex"] : ["sh", "-c", "curl -fsSL https://halolang.com/install.sh | sh"];
  const proc = Bun.spawn(cmd, { env, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  return await proc.exited;
}

// ── Tool packages ──

async function registryIndex(flags: Flags): Promise<string> {
  const flag = last(flags, "registry");
  if (flag) return flag;
  if (Bun.env.HALO_REGISTRY) return Bun.env.HALO_REGISTRY;
  const config = Bun.file("halo.json");
  const fromConfig = (await config.exists()) ? ((await config.json()) as { registry?: string }).registry : undefined;
  return fromConfig ?? DEFAULT_REGISTRY;
}

const project = () => ({ root: process.cwd(), builtins: [...TOOL_PROVIDERS] });

async function cmdAdd(flags: Flags): Promise<number> {
  const specs = flags.positional;
  if (!specs.length) fail("Usage: halo add <name[@version] | file.halotool | https://... | ./folder> [--trust]");
  const registry = await registryIndex(flags);
  for (const spec of specs) {
    const r = await install(project(), spec, { registry, trust: flags.bools.has("trust") });
    console.log(`${green("✓")} ${bold(`${r.name}@${r.version}`)} → ${r.providers.map((p) => `tool X : ${p}(...)`).join(", ")}`);
    for (const line of describePermissions(r.permissions)) console.log(dim(`    ${line}`));
  }
  return 0;
}

async function cmdTools(flags: Flags): Promise<number> {
  const rt = new HaloRuntime({ logger: { log() {}, warn() {} } });
  const providers = await installed();
  registerInstalled(rt, providers);
  const from = new Map(providers.map((p) => [p.name, p.packageName]));
  const rows = rt.toolProviderNames().sort().map((name) => {
    const info = rt.toolProviderInfo(name);
    const methods = Array.isArray(info?.methods) ? info.methods.map((m) => ({ name: m.name, effect: m.effect })) : info?.methods ? "listed at run time" : "not described";
    return { name, package: from.get(name) ?? "built in", description: info?.description, methods };
  });
  if (flags.bools.has("json")) {
    console.log(JSON.stringify(rows, null, 2));
    return 0;
  }
  for (const r of rows) {
    console.log(`${bold(r.name)} ${dim(`(${r.package})`)}${r.description ? ` ${r.description}` : ""}`);
    const list = typeof r.methods === "string" ? dim(r.methods) : r.methods.map((m) => (m.effect === "external" ? red(m.name) : m.effect === "write" ? yellow(m.name) : m.name)).join(", ");
    console.log(`  ${list}`);
  }
  console.log(dim(`\nMethods: plain = read, ${yellow("yellow")} = write, ${red("red")} = external`));
  return 0;
}

function cmdAgents(flags: Flags): number {
  const rows = Object.values(AGENT_PRESETS).map((p) => ({ name: p.name, summary: p.summary, settings: p.params, skills: p.skills ?? [], returns: p.returns ?? null }));
  if (flags.bools.has("json")) {
    console.log(JSON.stringify(rows, null, 2));
    return 0;
  }
  for (const r of rows) {
    console.log(`${bold(r.name)}  ${r.summary}`);
    const extra = [Object.entries(r.settings).map(([k, v]) => `${k}: ${v}`).join(", "), r.skills.length ? `skills: ${r.skills.join(", ")}` : "", r.returns ? `returns ${r.returns}` : ""].filter(Boolean);
    console.log(dim(`  ${extra.join(" · ")}`));
  }
  console.log(dim(`\nUse one: agent Reviewer [anthropic/claude-sonnet-4-5, preset: CodeReviewer]`));
  return 0;
}

function cmdSkills(flags: Flags): number {
  const dirs = flags.values.get("dir") ?? ["skills"];
  const catalog = skillCatalog(dirs, !flags.bools.has("no-builtin"));
  const name = flags.positional[0];
  if (name) {
    const skill = findSkill(catalog, name);
    if (!skill) fail(`No skill named "${name}" (there are: ${catalog.map((s) => s.name).join(", ") || "none"})`);
    if (flags.bools.has("json")) console.log(JSON.stringify({ ...skill, files: skillFiles(skill) }, null, 2));
    else console.log(`${bold(skill.name)} ${dim(`(${skill.source === "builtin" ? "built in" : skill.source})`)}\n${dim(skill.description)}\n\n${skill.instructions}`);
    return 0;
  }
  if (flags.bools.has("json")) {
    console.log(JSON.stringify(catalog.map((s) => ({ name: s.name, description: s.description, source: s.source })), null, 2));
    return 0;
  }
  if (!catalog.length) console.log("No skills found.");
  for (const s of catalog) console.log(`${bold(s.name)} ${dim(`(${s.source === "builtin" ? "built in" : relative(process.cwd(), s.source) || "."})`)}\n  ${s.description}`);
  console.log(dim(`\nGive an agent a skill with skills: "name" (on the agent or a call), or let it choose: tool Kit : Skills("./skills")`));
  return 0;
}

async function cmdSearch(flags: Flags): Promise<number> {
  const index = await registryIndex(flags);
  const found = await search(index, flags.positional.join(" "));
  const lock = readLock(process.cwd());
  if (!found.length) console.log("No packages found.");
  for (const p of found) {
    const have = lock.tools[p.name];
    console.log(`${bold(p.name)}@${p.latest}${have ? green(` (installed ${have.version})`) : ""}  ${p.description}`);
    console.log(dim(`    providers: ${p.latestVersion.providers.join(", ")} · ${describePermissions(p.latestVersion.permissions).join(" · ")}${p.publisher ? ` · by ${p.publisher}` : ""}`));
  }
  return 0;
}

async function cmdPack(flags: Flags): Promise<number> {
  const dir = flags.positional[0];
  if (!dir) fail("Usage: halo pack <package folder> [--out <folder>]");
  const { bytes, manifest, sha256 } = pack(dir);
  const out = join(last(flags, "out") ?? ".", `${manifest.name}-${manifest.version}.halotool`);
  await Bun.write(out, bytes);
  console.log(`${green("✓")} ${out} ${dim(`(${bytes.length} bytes, sha256 ${sha256})`)}`);
  for (const line of describePermissions(permissionsOf(manifest))) console.log(dim(`    ${line}`));
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  try {
    const flags = parseFlags(rest);
    if (command === "--version" || command === "-v" || flags.bools.has("version")) {
      console.log(pkg.version);
      return 0;
    }
    if (!command || command === "--help" || command === "-h" || command === "help" || flags.bools.has("help")) {
      console.log(HELP);
      return 0;
    }
    switch (command) {
      case "run":
        return await cmdRun(flags, false);
      case "debug":
        return await cmdRun(flags, true);
      case "test":
        flags.bools.add("mock");
        flags.bools.add("auto-approve");
        return await cmdRun(flags, false);
      case "replay": {
        const runId = flags.positional[1];
        if (!runId) fail("Usage: halo replay <file.halo> <runId> [--live-models | --live-tools]");
        return await cmdRun(flags, false, undefined, runId);
      }
      case "resume": {
        const runId = flags.positional[1];
        if (!runId) fail("Usage: halo resume <file.halo> <runId> [--payload '<json or word>']");
        return await cmdRun(flags, false, runId);
      }
      case "rewind": {
        const runId = flags.positional[1];
        const step = Number(last(flags, "step"));
        if (!runId || !Number.isInteger(step)) fail("Usage: halo rewind <file.halo> <runId> --step N [--yes]");
        return await cmdRun(flags, false, undefined, undefined, { runId, step });
      }
      case "threads":
        return cmdThreads(flags);
      case "thread":
        return cmdThread(flags);
      case "history":
        return await cmdHistory(flags);
      case "init":
        const template = last(flags, "template");
        return await initProject(flags.positional[0] ?? template ?? "my-halo-project", console, template);
      case "upgrade":
        return await cmdUpgrade();
      case "serve":
        return await cmdServe(flags);
      case "validate":
      case "lint":
        return await cmdValidate(flags);
      case "parse":
        return await cmdParse(flags);
      case "plan":
        return await cmdPlan(flags);
      case "mcp":
        return await cmdMcp(flags);
      case "add":
        return await cmdAdd(flags);
      case "remove":
      case "uninstall": {
        const name = flags.positional[0];
        if (!name) fail("Usage: halo remove <name>");
        if (!uninstall(process.cwd(), name)) fail(`"${name}" is not installed`);
        console.log(`${green("✓")} removed ${name}`);
        return 0;
      }
      case "install": {
        const done = await installFromLock(project(), { trust: flags.bools.has("trust") });
        console.log(done.length ? done.map((r) => `${green("✓")} ${r.name}@${r.version}`).join("\n") : "Nothing to install (halo.lock lists no tools).");
        return 0;
      }
      case "tools":
        return await cmdTools(flags);
      case "agents":
        return cmdAgents(flags);
      case "skills":
        return cmdSkills(flags);
      case "search":
        return await cmdSearch(flags);
      case "pack":
        return await cmdPack(flags);
      case "publish": {
        const file = flags.positional[0];
        const index = last(flags, "registry");
        if (!file || !index) fail("Usage: halo publish <file.halotool> --registry <path/to/index.json>");
        const r = publish(file, index);
        console.log(`${green("✓")} published ${r.name}@${r.version} to ${index} (${r.file})`);
        return 0;
      }
      default:
        // `halo file.halo` runs the file.
        if (command.endsWith(".halo")) return await cmdRun(parseFlags(argv), false);
        fail(`Unknown command: ${command} (try --help)`);
    }
  } catch (err) {
    if (err instanceof CliError) console.error(red(`Error: ${err.message}`));
    else console.error(red(`\n❌ ${err instanceof Error ? err.message : String(err)}`));
    return 1;
  }
}
