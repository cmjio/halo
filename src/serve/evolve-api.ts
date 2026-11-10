/**
 * Evolve in Halo Studio: `halo serve`'s /api/evolve endpoints.
 *
 *   GET  /api/evolve                     past and running evolve runs, newest first
 *   POST /api/evolve                     start one in the background: { pipeline, variants?, rounds?, budget?, criteria?, minRuns? }
 *   GET  /api/evolve/<id>                its progress, then its evolve.json, diffs and report
 *   POST /api/evolve/<id>/apply          write a variant over the file: { variant? } (default: the winner)
 *
 * Runs use the recordings in <stateDir>/recordings (from `halo run`, or from `halo serve` with
 * `recordings.serve`) and write to <stateDir>/evolve/<id>, the same as the CLI. Applying changes a
 * file this server has already loaded, so the server keeps serving the old version until restarted.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { ParseResult, PipelineDeclaration } from "../parser/types.js";
import type { ValidateOptions } from "../parser/validate.js";
import { defaultJudgeModel, haloJudge, recordingsFor } from "../compare.js";
import { describeScore, evolve, EvolveApplyError, haloProposer, prepareApply, writeEvolveDir, type EvolveEvent, type EvolveRecord } from "../evolve.js";
import type { FenceOptions } from "../fence.js";
import type { HaloRuntime } from "../runtime/runtime.js";

export interface EvolveConfig {
  proposer?: string;
  judge?: string;
  models?: string[];
  maxCostRatio?: number;
  holdout?: number;
  criteria?: Record<string, string>;
}

interface Job {
  id: string;
  pipeline: string;
  file: string;
  startedAt: string;
  status: "running" | "done" | "error";
  /** One line per round, variant and finalist, as the CLI prints them. */
  log: string[];
  spent: number;
  budget: number;
  error?: string;
}

export interface EvolveApiOptions {
  stateDir: string;
  /** The project folder files are relative to. */
  root: string;
  pipelines: () => Array<{ name: string; file: string; decl: PipelineDeclaration; ast: ParseResult; path: string }>;
  runtime: () => HaloRuntime;
  fence: Omit<FenceOptions, "allowModels" | "maxCostRatio">;
  validate: ValidateOptions;
  config?: EvolveConfig;
  version: string;
  logger: Pick<Console, "log" | "warn" | "error">;
}

const ID = /^\w[\w.-]*$/;

export function evolveApi(o: EvolveApiOptions) {
  const dir = join(o.stateDir, "evolve");
  const recordings = join(o.stateDir, "recordings");
  const jobs = new Map<string, Job>();
  const json = (body: unknown, status = 200) => Response.json(body, { status });

  const readRecord = (id: string): EvolveRecord | undefined => {
    const f = join(dir, id, "evolve.json");
    if (!existsSync(f)) return undefined;
    try {
      return JSON.parse(readFileSync(f, "utf8")) as EvolveRecord;
    } catch {
      return undefined;
    }
  };

  const list = () => {
    const done = existsSync(dir)
      ? readdirSync(dir)
          .filter((id) => ID.test(id) && !jobs.has(id))
          .flatMap((id) => {
            const r = readRecord(id);
            return r ? [{ id, pipeline: r.pipeline, file: r.file, startedAt: r.createdAt, status: "done" as const, winner: r.winner, verdict: r.verdict, spent: r.spent, budget: r.budget, variants: r.variants.length }] : [];
          })
      : [];
    const running = [...jobs.values()].map((j) => {
      const r = j.status === "done" ? readRecord(j.id) : undefined;
      return { id: j.id, pipeline: j.pipeline, file: j.file, startedAt: j.startedAt, status: j.status, winner: r?.winner, verdict: r?.verdict ?? j.error, spent: j.spent, budget: j.budget, variants: r?.variants.length };
    });
    return [...running, ...done].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  };

  const start = async (body: { pipeline?: string; variants?: number; rounds?: number; budget?: number; criteria?: string; minRuns?: number; proposer?: string; judge?: string }) => {
    const p = o.pipelines().find((x) => x.name === body.pipeline);
    if (!p) return json({ error: `Unknown pipeline "${body.pipeline}"` }, 400);
    if ([...jobs.values()].some((j) => j.status === "running" && j.pipeline === p.name)) return json({ error: `${p.name} is already being evolved` }, 409);
    const int = (v: unknown, fallback: number, max: number) => (v === undefined ? fallback : Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max ? (v as number) : NaN);
    const variants = int(body.variants, 4, 12);
    const rounds = int(body.rounds, 2, 6);
    const minRuns = int(body.minRuns, 10, 10_000);
    const budget = body.budget === undefined ? 3 : Number(body.budget);
    if ([variants, rounds, minRuns].some(Number.isNaN)) return json({ error: "variants (1-12), rounds (1-6) and minRuns must be whole numbers" }, 400);
    if (!(budget > 0 && budget <= 100)) return json({ error: "budget must be more than 0 and at most 100 (USD)" }, 400);
    const runs = recordingsFor(recordings, p.name, 60);
    if (runs.length < minRuns) return json({ error: `${p.name} has ${runs.length} finished recorded run(s); evolve needs at least ${minRuns}. Record runs with halo run, or set "recordings": { "serve": true } in halo.json.` }, 409);
    const proposer = body.proposer ?? o.config?.proposer ?? defaultJudgeModel(p.ast);
    const judge = body.judge ?? o.config?.judge ?? defaultJudgeModel(p.ast);
    if (!proposer || !judge) return json({ error: `${p.file} has no agents to evolve` }, 400);
    for (const [role, model] of [["proposer", proposer], ["judge", judge]] as const) {
      if (!o.runtime().canCallModel(model)) return json({ error: `No API key for the ${role}'s model ${model}` }, 400);
    }
    const criteria = body.criteria?.trim() || (o.config?.criteria?.[p.name] && existsSync(join(o.root, o.config.criteria[p.name]!)) ? readFileSync(join(o.root, o.config.criteria[p.name]!), "utf8") : undefined);

    const id = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${p.name}`;
    if (jobs.has(id) || existsSync(join(dir, id))) return json({ error: "An evolve run started this second already; try again" }, 409);
    const source = readFileSync(p.path, "utf8");
    const job: Job = { id, pipeline: p.name, file: p.file, startedAt: new Date().toISOString(), status: "running", log: [], spent: 0, budget };
    jobs.set(id, job);
    const onEvent = (e: EvolveEvent) => {
      if (e.type === "round") job.log.push(`Round ${e.round}: proposing from ${e.parent}`);
      else if (e.type === "variant") {
        const v = e.variant;
        job.log.push(`${v.id} ${v.score ? describeScore(v.score) : v.status === "outside" ? `outside the fence: ${v.problems[0] ?? ""}` : v.status === "invalid" ? `invalid: ${v.problems[0] ?? ""}` : v.status}${v.rationale ? ` — ${v.rationale}` : ""}`);
        job.spent += v.proposeCost + (v.proposal?.spent ?? 0);
      } else if (e.type === "holdout") {
        job.log.push(`held out ${e.variant.id}: ${describeScore(e.variant.holdoutScore!)}`);
        job.spent += e.variant.holdout?.spent ?? 0;
      } else if (e.type === "budget") job.log.push(`budget reached ($${e.spent.toFixed(4)})`);
    };
    o.logger.log(`[halo] evolving ${p.name} (${runs.length} recorded runs, budget $${budget.toFixed(2)})`);
    void evolve({
      source,
      pipeline: p.name,
      recordings: runs,
      runtime: o.runtime,
      propose: haloProposer(proposer, o.runtime),
      judge: haloJudge(judge, o.runtime),
      criteria,
      variants,
      rounds,
      holdout: o.config?.holdout,
      budget,
      fence: { ...o.fence, allowModels: o.config?.models ?? [], maxCostRatio: o.config?.maxCostRatio ?? 1 },
      validate: o.validate,
      onEvent,
    })
      .then((result) => {
        writeEvolveDir(join(dir, id), result, { file: relative(o.root, p.path), source, version: o.version, models: { proposer, judge } });
        job.spent = result.spent;
        job.status = "done";
        o.logger.log(`[halo] evolved ${p.name}: ${result.verdict}`);
      })
      .catch((err: unknown) => {
        job.status = "error";
        job.error = err instanceof Error ? err.message : String(err);
        o.logger.error(`[halo] evolving ${p.name} failed: ${job.error}`);
      });
    return json({ id, status: "running" }, 202);
  };

  const detail = (id: string) => {
    const job = jobs.get(id);
    const record = readRecord(id);
    if (!job && !record) return json({ error: "No such evolve run" }, 404);
    const diffs: Record<string, string> = {};
    const variantsDir = join(dir, id, "variants");
    if (record && existsSync(variantsDir)) {
      for (const f of readdirSync(variantsDir)) if (f.endsWith(".diff")) diffs[f.slice(0, -".diff".length)] = readFileSync(join(variantsDir, f), "utf8");
    }
    const report = record && existsSync(join(dir, id, "report.md")) ? readFileSync(join(dir, id, "report.md"), "utf8") : undefined;
    return json({ id, status: job?.status ?? "done", log: job?.log ?? [], error: job?.error, spent: record?.spent ?? job?.spent, budget: record?.budget ?? job?.budget, record, diffs, report });
  };

  const apply = async (id: string, body: { variant?: string }) => {
    if (jobs.get(id)?.status === "running") return json({ error: "That evolve run hasn't finished" }, 409);
    try {
      const p = await prepareApply(join(dir, id), body.variant, { root: o.root });
      await Bun.write(p.path, p.next);
      o.logger.log(`[halo] applied ${p.id} from evolve run ${id} to ${p.record.file}`);
      return json({ applied: p.id, file: p.record.file, note: "Written. This server keeps serving the version it loaded: restart halo serve to serve the new one." });
    } catch (err) {
      if (err instanceof EvolveApplyError) return json({ error: err.message }, 409);
      throw err;
    }
  };

  /** Handles /api/evolve…, or returns undefined for any other path. */
  return async (req: Request, path: string, readJson: (req: Request) => Promise<unknown>): Promise<Response | undefined> => {
    if (path === "/api/evolve" && req.method === "GET") return json(list());
    if (path === "/api/evolve" && req.method === "POST") return await start(((await readJson(req)) ?? {}) as Parameters<typeof start>[0]);
    const one = path.match(/^\/api\/evolve\/(\w[\w.-]*)$/);
    if (one && req.method === "GET") return detail(one[1]!);
    const ap = path.match(/^\/api\/evolve\/(\w[\w.-]*)\/apply$/);
    if (ap && req.method === "POST") return await apply(ap[1]!, ((await readJson(req)) ?? {}) as { variant?: string });
    return undefined;
  };
}
