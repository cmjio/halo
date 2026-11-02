/**
 * Halo CLI
 *
 *   halo run <file.halo> [--pipeline <name>] [--arg key=value ...] [--args '<json>']
 *   halo debug <file.halo> ...
 *   halo test <file.halo> ...          (run --mock)
 *   halo resume <file.halo> <runId> --payload '<json|word>'
 *   halo validate <file.halo | dir ...>
 *   halo parse <file.halo>
 *   halo init [name]
 *   halo serve [files or folders] [--port 8080]
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parse } from "./parser/index.js";
import { validate, type Diagnostic } from "./parser/validate.js";
import type { CallStage, ParseResult, PipelineStage, PipelineDeclaration } from "./parser/types.js";
import { AdapterRegistry } from "./runtime/adapter.js";
import { FileRunStore, HaloRuntime, stageLabel, type InterruptRequest, type ListenRequest, type RunResult, type RuntimeEvent } from "./runtime/runtime.js";
import { SqliteTelemetry } from "./runtime/telemetry.js";
import { initProject } from "./init.js";
import { loadServeConfig, startServer, ServeError } from "./serve/server.js";
import { nextRun, parseCron } from "./serve/cron.js";
import { APPROVED, answerToEvent, formatValue } from "./runtime/values.js";
import pkg from "../package.json" with { type: "json" };

const HELP = `
Halo CLI - AI Workflow Language

USAGE:
  halo run <file.halo> [options]        Run a pipeline
  halo debug <file.halo> [options]      Run with stage-by-stage tracing
  halo test <file.halo> [options]       Run offline: --mock plus --auto-approve
  halo resume <file.halo> <runId>       Continue a paused run (--payload '<json or word>')
  halo validate <file.halo|dir ...>     Check syntax and semantics
  halo parse <file.halo>                Print the AST as JSON
  halo init [name]                      Create a new Halo project
  halo serve [files|dirs ...]           Serve pipelines: HTTP API, webhooks, schedules,
                                        approval links, and Halo Studio at /

RUN OPTIONS:
  --pipeline, -p <name>  Pipeline to run (default: the file's entry pipeline)
  --arg <key=value>      Input argument (repeatable; values parse as JSON when possible)
  --args '<json>'        Input arguments as a JSON object
  --mock                 Mock every agent and tool call (no network, no API keys)
  --auto-approve         Approve every |! yield and ~> listen automatically
  --checkpoint <file>    Resume from a @checkpoint snapshot
  --api-key <key>        API key for any provider without its own env var
  --router '<json>'      Router configuration, e.g. '{"strategy":"cost-optimized"}'
  --json                 Print the full run result (output, meta, trace) as JSON
  --no-telemetry         Don't record this run for Halo Studio (.halo/telemetry.db)

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

const BOOL_FLAGS = new Set(["mock", "auto-approve", "json", "strict", "help", "version", "no-telemetry", "no-studio"]);
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
      : validate(ast, { canHandleModel });
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
  const answer = await ask(`Response [approve/reject/...]: `);
  return answer ? toEvent(answer) : AUTO_EVENT;
}

const toEvent = answerToEvent;

async function promptListen(req: ListenRequest): Promise<unknown> {
  console.error(bold(`\n👂 ${req.pipeline} is waiting for ${req.target}`));
  const answer = await ask(`Event (JSON or a word like approve/reject) [approve]: `);
  return answer ? toEvent(answer) : AUTO_EVENT;
}

function mockRuntime(rt: HaloRuntime, ast: ParseResult): void {
  const preview = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").slice(0, 80);
  const mocks: Record<string, unknown> = {
    "*": (req: { target: string; prompt?: string }) => `[mock ${req.target}] ${preview(req.prompt)}`,
  };
  for (const t of [...ast.tools, ...ast.stores]) {
    mocks[t.name] = (req: { target: string; args: unknown[]; named: Record<string, unknown> }) => ({ mock: true, tool: req.target, named: req.named });
  }
  rt.mockAll(mocks);
}

function tracer(debug: boolean): (e: RuntimeEvent) => void {
  return (e) => {
    if (e.type === "retry") console.error(yellow(`  ↻ retry ${e.target} (attempt ${e.attempt}): ${e.error}`));
    if (e.type === "violation") console.error(red(`  ⛔ ${e.policy}/${e.rule}: ${e.message}`));
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
    if (e.type === "correction") console.error(yellow(`  ✎ ${e.target} correction ${e.attempt}: ${e.error}`));
    if (e.type === "checkpoint") console.error(dim(`  💾 ${e.path}`));
  };
}

async function cmdRun(flags: Flags, debug: boolean, resumeRun?: string): Promise<number> {
  const { path, ast } = await load(flags.positional[0]);
  const rel = relative(process.cwd(), path);

  const diags = validate(ast, { canHandleModel });
  for (const d of diags) console.error(formatDiag(d, rel));
  if (diags.some((d) => d.severity === "error")) return 1;

  const mock = flags.bools.has("mock");
  const autoApprove = flags.bools.has("auto-approve");
  const routerJson = last(flags, "router");
  const telemetry = flags.bools.has("no-telemetry") ? undefined : new SqliteTelemetry(".halo/telemetry.db");
  const trace = tracer(debug);
  const rt = new HaloRuntime({
    apiKey: last(flags, "api-key"),
    router: routerJson ? (parseJsonish(routerJson) as object) : undefined,
    // In a terminal, ask; otherwise pause the run (it is saved to .halo/runs) unless auto-approving.
    onInterrupt: autoApprove ? () => AUTO_EVENT : process.stdin.isTTY ? promptInterrupt : undefined,
    onListen: autoApprove ? () => AUTO_EVENT : process.stdin.isTTY ? promptListen : undefined,
    runStore: new FileRunStore(".halo/runs"),
    onEvent: (e) => {
      trace(e);
      telemetry?.handler(e);
    },
  }).load(ast);
  if (mock) mockRuntime(rt, ast);

  let result: RunResult;
  const checkpoint = last(flags, "checkpoint");
  try {
    if (resumeRun) {
      const payloadText = last(flags, "payload");
      const payload = payloadText === undefined ? AUTO_EVENT : toEvent(payloadText);
      const saved = await new FileRunStore(".halo/runs").load(resumeRun);
      if (!saved) fail(`No paused run "${resumeRun}" in .halo/runs`);
      result = await rt.signal(resumeRun, last(flags, "event") ?? saved.waitingFor ?? "yield", payload);
    } else if (checkpoint) {
      result = await rt.resume(checkpoint);
    } else {
      const pipeline = pickStream(ast, last(flags, "pipeline"));
      const args = inputArgs(flags);
      const missing = pipeline.params.filter((p) => !(p.name in args)).map((p) => p.name);
      if (missing.length) {
        fail(`Missing argument(s) for ${pipeline.name}(${pipeline.params.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${missing.join(", ")}\n  Pass them with ${missing.map((m) => `--arg ${m}=...`).join(" ")}`);
      }
      result = await rt.run(pipeline.name, args);
    }
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
      case "resume": {
        const runId = flags.positional[1];
        if (!runId) fail("Usage: halo resume <file.halo> <runId> [--payload '<json or word>']");
        return await cmdRun(flags, false, runId);
      }
      case "init":
        return await initProject(flags.positional[0] ?? "my-halo-project");
      case "serve":
        return await cmdServe(flags);
      case "validate":
      case "lint":
        return await cmdValidate(flags);
      case "parse":
        return await cmdParse(flags);
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
