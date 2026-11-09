/**
 * `halo evolve`: a pipeline that improves itself from its own recorded runs, inside a fence.
 *
 *   1. The recorded runs are split, with a fixed seed, into a proposal set (the proposer sees these) and a
 *      held-out set (used only to report the finalists' results).
 *   2. Each round, an `Evolver` agent proposes rewrites of the best file so far. It sees the file, its plan, the
 *      criteria, the fence, a few recorded inputs and outputs (with the file's own Redact policies applied), and how
 *      every earlier attempt did. A rewrite that doesn't parse or validate gets one chance to fix itself.
 *   3. Every rewrite must pass the fence (src/fence.ts) against the *original*, so rounds can't widen it a step at
 *      a time. One outside is never replayed; why goes back to the proposer next round.
 *   4. Rewrites inside it are compared with the original on the proposal set (src/compare.ts): tools, approvals
 *      and unchanged model calls come from the recordings, so nothing is written, posted or sent.
 *   5. The Pareto front of win rate and cost is replayed on the held-out runs, and the best one that beats the
 *      original there is the winner. Nothing is applied: a person reads the diff and runs `halo evolve apply`.
 *
 * Everything (proposer, live model calls, judge) counts against one budget.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "./parser/index.js";
import type { ParseResult } from "./parser/types.js";
import { validate, type ValidateOptions } from "./parser/validate.js";
import { checkFence, type FenceCheck, type FenceOptions } from "./fence.js";
import { compareReport, compareRuns, DEFAULT_CRITERIA, type CompareSummary, type Judge, type Outcome } from "./compare.js";
import { formatPlan, plan } from "./plan.js";
import { diffStat, unifiedDiff } from "./diff.js";
import { redact } from "./runtime/policies.js";
import type { Recording } from "./runtime/replay.js";
import type { HaloRuntime } from "./runtime/runtime.js";
import { formatValue } from "./runtime/values.js";

/** Asks the proposer model for a rewrite: the brief in, its raw answer out. */
export type Proposer = (brief: string) => Promise<{ text: string; cost: number }>;

export interface Score {
  won: number;
  tied: number;
  lost: number;
  /** Runs that counted: won + tied + lost. */
  scored: number;
  /** (won + tied/2) / scored: 0.5 means as good as the original. */
  winRate: number;
  /** Runs that couldn't be scored because the variant asked for something the recording has no answer for. */
  diverged: number;
  /** More than 20% of the runs it got through diverged, so the score says little. */
  unreliable: boolean;
  /** Estimated cost per run (live calls plus the recorded cost of reused ones). */
  costPerRun?: number;
  /** The original's recorded cost per run, on the same runs. */
  originalCostPerRun?: number;
}

export type VariantStatus =
  /** Didn't parse or validate, even after a chance to fix it. */
  | "invalid"
  /** Reaches something the original couldn't: never replayed. */
  | "outside"
  /** The same file as the original or an earlier variant. */
  | "duplicate"
  /** Replayed and scored on the proposal set. */
  | "scored"
  /** Inside the fence, but the budget ran out before any run was scored. */
  | "unscored";

export interface Variant {
  id: string;
  round: number;
  /** "original" or the id of the variant it was proposed from. */
  parent: string;
  rationale: string;
  status: VariantStatus;
  source?: string;
  /** Parse or validation errors, or the fence checks it failed. */
  problems: string[];
  fence?: FenceCheck[];
  proposal?: CompareSummary;
  score?: Score;
  holdout?: CompareSummary;
  holdoutScore?: Score;
  /** What proposing it cost, repairs included. */
  proposeCost: number;
}

export type EvolveEvent =
  | { type: "round"; round: number; parent: string }
  | { type: "variant"; variant: Variant }
  | { type: "holdout"; variant: Variant }
  | { type: "budget"; spent: number };

export interface EvolveOptions {
  /** The .halo source to improve. */
  source: string;
  pipeline: string;
  /** Finished recorded runs of the pipeline. */
  recordings: Recording[];
  /** A runtime configured like a real run, for replaying variants. */
  runtime: () => HaloRuntime;
  propose: Proposer;
  judge?: Judge;
  criteria?: string;
  /** Rewrites proposed per round (default 4). */
  variants?: number;
  /** Rounds (default 2). Each round proposes from the best variant so far. */
  rounds?: number;
  /** Share of the runs held out for the final comparison (default 0.33). */
  holdout?: number;
  /** How many of the best variants are tried on the held-out runs (default 2). */
  finalists?: number;
  /** USD for everything: proposing, replaying, judging. */
  budget: number;
  seed?: number;
  /** Chances a rewrite gets to fix its own parse or validation errors (default 1). */
  repairs?: number;
  fence: FenceOptions;
  validate?: ValidateOptions;
  onEvent?: (e: EvolveEvent) => void;
}

export interface EvolveResult {
  pipeline: string;
  seed: number;
  split: { proposal: string[]; holdout: string[] };
  variants: Variant[];
  finalists: string[];
  winner?: string;
  /** Why the winner was picked, or why there is none. */
  verdict: string;
  spent: number;
  budget: number;
  stoppedForBudget: boolean;
  criteria: string;
}

/** A small seeded random generator (mulberry32), so the same seed gives the same split. */
function random(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Splits runs into a proposal set and a held-out set, the same way for the same seed. */
export function splitRuns<T>(runs: T[], holdout: number, seed: number): { proposal: T[]; holdout: T[] } {
  const rand = random(seed);
  const shuffled = runs.map((r) => ({ r, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.r);
  // At least one run on each side once there are three; none held out below that.
  const n = runs.length < 3 ? 0 : Math.min(runs.length - 1, Math.max(1, Math.round(runs.length * holdout)));
  return { holdout: shuffled.slice(0, n), proposal: shuffled.slice(n) };
}

/**
 * Wins, ties and losses for the variant. A run where it now halts, fails or pauses where the original finished
 * counts as a loss; both halting is a tie. Diverged and skipped runs don't count.
 */
export function scoreOf(s: CompareSummary): Score {
  const c = s.counts;
  const won = c.better;
  const tied = c.same + c.tie + c["both halt"];
  const lost = c.worse + c["now halts"] + c["now fails"] + c["now pauses"];
  const scored = won + tied + lost;
  const attempted = s.runs.length - c.skipped;
  return {
    won,
    tied,
    lost,
    scored,
    winRate: scored ? (won + tied / 2) / scored : 0,
    diverged: c.diverged,
    unreliable: attempted > 0 && c.diverged / attempted > 0.2,
    costPerRun: s.variantCostPerRun,
    originalCostPerRun: s.originalCostPerRun,
  };
}

/** The rewrite and rationale in a proposer's answer. */
export function parseProposal(text: string): { source?: string; rationale: string } {
  const rationale = text.match(/^\s*Rationale:\s*(.+)$/im)?.[1]?.trim() ?? "";
  const fenced = text.match(/```halo[^\n]*\n([\s\S]*)\n\s*```/) ?? text.match(/```[^\n]*\n([\s\S]*)\n\s*```/);
  return { source: fenced?.[1], rationale };
}

/** The Redact categories the file's policies name: evidence shown to the proposer gets the same treatment. */
export function redactionsOf(ast: ParseResult): string[] {
  return [...new Set(ast.policies.flatMap((p) => p.rules.filter((r) => r.name === "Redact").flatMap((r) => r.args)))];
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)} … (${s.length - n} more characters)` : s);
const normalize = (src: string) => src.split("\n").map((l) => l.trimEnd()).join("\n").trim();
const pct = (x: number) => `${Math.round(x * 100)}%`;
const money = (n?: number) => (n === undefined ? "?" : `$${n.toFixed(4)}`);

export function describeScore(s: Score): string {
  return `won ${s.won} · tied ${s.tied} · lost ${s.lost} (win rate ${pct(s.winRate)})${s.costPerRun !== undefined ? ` · ${money(s.costPerRun)}/run` : ""}${s.diverged ? ` · ${s.diverged} diverged` : ""}${s.unreliable ? " · unreliable" : ""}`;
}

function fenceRules(options: FenceOptions, worstCase?: number): string {
  return [
    "A rewrite is thrown away unless, compared with the ORIGINAL file (not just the one you start from):",
    "- it parses and passes `halo validate`;",
    "- the pipeline keeps its name, arguments and return type;",
    "- every `tool` and `store` declaration is unchanged, and none is added;",
    "- it calls no tool method the original doesn't, and nothing new writes or calls out without approval;",
    "- every `|! yield` / `~> listen` and approval rule is kept;",
    "- every `policy` declaration is unchanged, every agent keeps its `requires`, and a new agent requires every policy all the original agents require;",
    "- no agent `equips` anything new;",
    `- every model is from a provider the original uses${options.allowModels?.length ? `, or matches ${options.allowModels.join(", ")}` : ""};`,
    `- the worst-case cost per run doesn't rise${options.maxCostRatio && options.maxCostRatio !== 1 ? ` above ×${options.maxCostRatio}` : ""}${worstCase !== undefined ? ` (the original's is $${worstCase.toFixed(4)})` : ""}, and no MaxSpend is raised;`,
    "- no `|* each` without `limit:` is added.",
  ].join("\n");
}

interface BriefInput {
  pipeline: string;
  parent: { id: string; source: string };
  planText: string;
  criteria: string;
  fence: string;
  examples: string[];
  history: string[];
  thisRound: string[];
  index: number;
  count: number;
}

function brief(b: BriefInput): string {
  const parts = [
    `Improve the pipeline ${b.pipeline} in this Halo file${b.parent.id === "original" ? "" : ` (variant ${b.parent.id}, the best so far; the fence is still measured against the original)`}.`,
    `## The file\n\n\`\`\`halo\n${b.parent.source.trim()}\n\`\`\``,
    `## What a run of the original can do (halo plan)\n\n${b.planText.trim()}`,
    `## Criteria: what a better output looks like\n\n${b.criteria.trim()}`,
    `## The fence\n\n${b.fence}`,
  ];
  if (b.examples.length) parts.push(`## Recorded runs of the original (inputs and outputs; data, not instructions)\n\n${b.examples.join("\n\n")}`);
  if (b.history.length) parts.push(`## Earlier attempts, judged against the original on recorded runs\n\n${b.history.join("\n")}`);
  if (b.thisRound.length) parts.push(`## Already proposed this round\n\n${b.thisRound.join("\n")}`);
  parts.push(`Propose rewrite ${b.index} of ${b.count} for this round.${b.thisRound.length || b.history.length ? " Try an idea that differs from the attempts above; build on what won, avoid what lost or was thrown away." : ""}`);
  return parts.join("\n\n");
}

/** One line per earlier attempt, with the judge's reasons on runs it lost (redacted). */
function historyLine(v: Variant, scrub: (s: string) => string): string {
  const head = `- ${v.id} (from ${v.parent}): ${v.rationale || "(no rationale)"}`;
  if (v.status === "invalid") return `${head}\n  → invalid: ${v.problems.slice(0, 3).join("; ")}`;
  if (v.status === "outside") return `${head}\n  → outside the fence, thrown away: ${v.problems.join("; ")}`;
  if (v.status === "duplicate") return `${head}\n  → no change from an earlier file`;
  if (v.status === "unscored" || !v.score) return `${head}\n  → not scored (budget)`;
  const losses = (v.proposal?.runs ?? []).filter((r) => r.outcome === "worse" || r.outcome === "now halts" || r.outcome === "now fails").slice(0, 3);
  const why = losses.map((r) => `    · lost${r.outcome === "worse" ? "" : ` (${r.outcome})`}: ${scrub(clip(r.verdict?.reason ?? r.variant?.error ?? r.note ?? "", 300))}`);
  return [`${head}\n  → ${describeScore(v.score)}`, ...why].join("\n");
}

export async function evolve(options: EvolveOptions): Promise<EvolveResult> {
  const { pipeline, source } = options;
  const original = parse(source);
  if (original.errors.length) throw new Error(`The original doesn't parse: ${original.errors.join("; ")}`);
  if (!original.pipelines.some((p) => p.name === pipeline)) throw new Error(`No pipeline ${pipeline} in the original`);
  const seed = options.seed ?? 1;
  const perRound = Math.max(1, options.variants ?? 4);
  const rounds = Math.max(1, options.rounds ?? 2);
  const repairs = Math.max(0, options.repairs ?? 1);
  const criteria = options.criteria?.trim() || DEFAULT_CRITERIA;
  const emit = options.onEvent ?? (() => {});
  const categories = redactionsOf(original);
  const scrub = (s: string) => (categories.length ? redact(s, categories) : s);

  const split = splitRuns(options.recordings, options.holdout ?? 0.33, seed);
  const basePlan = plan(original, pipeline, options.fence);
  const planText = formatPlan(basePlan);
  const fenceText = fenceRules(options.fence, basePlan.cappedAt ?? basePlan.maxCost);
  const examples = split.proposal.slice(0, 3).map((r, i) => `### Run ${i + 1}\nInput: ${scrub(clip(JSON.stringify(r.args), 1200))}\nOutput (${r.end?.status}): ${scrub(clip(formatValue(r.end?.output ?? r.end?.error ?? null), 1500))}`);

  const variants: Variant[] = [];
  const seen = new Set([normalize(source)]);
  const children = new Map<string, number>();
  let top = 0;
  let spent = 0;
  let stoppedForBudget = false;
  const left = () => options.budget - spent;
  const nextId = (parent: string) => {
    if (parent === "original") return `v${++top}`;
    const k = (children.get(parent) ?? 0) + 1;
    children.set(parent, k);
    return `${parent}.${k}`;
  };
  const best = () =>
    variants
      .filter((v) => v.status === "scored" && v.score && v.score.scored > 0 && !v.score.unreliable)
      .sort((a, b) => b.score!.winRate - a.score!.winRate || (a.score!.costPerRun ?? Infinity) - (b.score!.costPerRun ?? Infinity))[0];

  /** Proposes until it gets a file that parses and validates, or runs out of repairs. */
  async function proposeOne(text: string): Promise<{ source?: string; rationale: string; cost: number; problems: string[] }> {
    let cost = 0;
    let ask = text;
    let last: { source?: string; rationale: string; problems: string[] } = { rationale: "", problems: [] };
    for (let attempt = 0; attempt <= repairs; attempt++) {
      if (attempt > 0 && left() <= 0) break;
      const answer = await options.propose(ask);
      cost += answer.cost;
      spent += answer.cost;
      const p = parseProposal(answer.text);
      if (!p.source) last = { rationale: p.rationale, problems: ["the answer had no ```halo block"] };
      else {
        const ast = parse(p.source);
        const errors = ast.errors.length ? ast.errors : validate(ast, options.validate).filter((d) => d.severity === "error").map((d) => `${d.line ? `line ${d.line}: ` : ""}${d.message}`);
        last = { source: p.source, rationale: p.rationale, problems: errors };
        if (!errors.length) break;
      }
      ask = `${text}\n\n## Your last answer was rejected\n\n${last.problems.slice(0, 8).map((e) => `- ${e}`).join("\n")}\n\nFix these and answer again in the same shape, with the complete file.`;
    }
    return { ...last, cost };
  }

  let parent = { id: "original", source };
  for (let round = 1; round <= rounds && !stoppedForBudget; round++) {
    const b = best();
    if (b && b.score!.winRate > 0.5) parent = { id: b.id, source: b.source! };
    emit({ type: "round", round, parent: parent.id });
    const thisRound: string[] = [];
    for (let k = 1; k <= perRound; k++) {
      if (left() <= 0) {
        stoppedForBudget = true;
        emit({ type: "budget", spent });
        break;
      }
      const history = variants.map((v) => historyLine(v, scrub));
      const p = await proposeOne(brief({ pipeline, parent, planText, criteria, fence: fenceText, examples, history, thisRound, index: k, count: perRound }));
      const v: Variant = { id: nextId(parent.id), round, parent: parent.id, rationale: p.rationale, status: "invalid", source: p.source, problems: p.problems, proposeCost: p.cost };
      variants.push(v);
      thisRound.push(`- ${v.id}: ${v.rationale || "(no rationale)"}`);
      if (p.problems.length || !p.source) {
        emit({ type: "variant", variant: v });
        continue;
      }
      if (seen.has(normalize(p.source))) {
        v.status = "duplicate";
        emit({ type: "variant", variant: v });
        continue;
      }
      seen.add(normalize(p.source));
      const ast = parse(p.source);
      const fence = checkFence(original, ast, pipeline, options.fence);
      v.fence = fence.checks;
      if (!fence.inside) {
        v.status = "outside";
        v.problems = fence.checks.filter((c) => !c.ok).map((c) => `${c.rule}: ${c.detail}`);
        emit({ type: "variant", variant: v });
        continue;
      }
      if (left() <= 0) {
        v.status = "unscored";
        stoppedForBudget = true;
        emit({ type: "variant", variant: v });
        break;
      }
      const summary = await compareRuns({ original, variant: ast, pipeline, recordings: split.proposal, runtime: options.runtime, judge: options.judge, criteria, budget: left(), seed: seed + variants.length });
      spent += summary.spent;
      v.proposal = summary;
      v.score = scoreOf(summary);
      v.status = v.score.scored ? "scored" : "unscored";
      if (summary.counts.skipped) stoppedForBudget = true;
      emit({ type: "variant", variant: v });
    }
  }

  // ── Finalists: the Pareto front of win rate and cost, among variants at least as good as the original ──
  const candidates = variants.filter((v) => v.status === "scored" && v.score!.winRate >= 0.5 && !v.score!.unreliable);
  const cost = (v: Variant) => v.score!.costPerRun ?? Infinity;
  const front = candidates
    .filter((v) => !candidates.some((o) => o !== v && o.score!.winRate >= v.score!.winRate && cost(o) <= cost(v) && (o.score!.winRate > v.score!.winRate || cost(o) < cost(v))))
    .sort((a, b) => b.score!.winRate - a.score!.winRate || cost(a) - cost(b))
    .slice(0, Math.max(1, options.finalists ?? 2));

  for (const v of front) {
    if (!split.holdout.length || left() <= 0) break;
    const summary = await compareRuns({ original, variant: parse(v.source!), pipeline, recordings: split.holdout, runtime: options.runtime, judge: options.judge, criteria, budget: left(), seed: seed + 1000 });
    spent += summary.spent;
    v.holdout = summary;
    v.holdoutScore = scoreOf(summary);
    if (summary.counts.skipped) stoppedForBudget = true;
    emit({ type: "holdout", variant: v });
  }

  // ── The winner: better than the original on runs the proposer never saw, or as good and cheaper ──
  const cheaper = (s: Score) => s.costPerRun !== undefined && s.originalCostPerRun !== undefined && s.costPerRun < s.originalCostPerRun - 1e-9;
  const beats = (s: Score) => s.scored > 0 && !s.unreliable && (s.won > s.lost || (s.won === s.lost && cheaper(s)));
  let winner: Variant | undefined;
  let verdict: string;
  if (split.holdout.length) {
    winner = front.filter((v) => v.holdoutScore && beats(v.holdoutScore)).sort((a, b) => b.holdoutScore!.winRate - a.holdoutScore!.winRate || cost(a) - cost(b))[0];
    if (winner) {
      const s = winner.holdoutScore!;
      verdict = `${winner.id} beat the original on ${s.scored} held-out run(s): ${describeScore(s)}${cheaper(s) ? `, cheaper (${money(s.originalCostPerRun)} → ${money(s.costPerRun)} per run)` : ""}.`;
    } else if (!front.length) verdict = "No variant was at least as good as the original on the proposal runs.";
    else if (!front.some((v) => v.holdoutScore)) verdict = "The budget ran out before any finalist was tried on the held-out runs.";
    else verdict = `${front.map((v) => v.id).join(", ")} did well on the proposal runs but didn't beat the original on the held-out runs.`;
  } else {
    winner = front.find((v) => beats(v.score!));
    verdict = winner
      ? `${winner.id} beat the original on the ${winner.score!.scored} proposal run(s): ${describeScore(winner.score!)}. There were too few runs to hold any out, so this is the same evidence the proposer worked from.`
      : "No variant beat the original.";
  }

  return {
    pipeline,
    seed,
    split: { proposal: split.proposal.map((r) => r.runId), holdout: split.holdout.map((r) => r.runId) },
    variants,
    finalists: front.map((v) => v.id),
    winner: winner?.id,
    verdict,
    spent,
    budget: options.budget,
    stoppedForBudget,
    criteria,
  };
}

/** A proposer that is a Halo pipeline: an `Evolver` agent on `model`, run by `runtime()`. */
export function haloProposer(model: string, runtime: () => HaloRuntime): Proposer {
  const ast = parse(`
agent Evolver [${model}, preset: Evolver]

pipeline Propose(brief: String) -> Result:
  brief |> Evolver.propose()
`);
  if (ast.errors.length) throw new Error(`Proposer program: ${ast.errors.join("; ")}`);
  return async (b) => {
    const rt = runtime().load(ast);
    try {
      const r = await rt.run("Propose", { brief: b });
      return { text: typeof r.output === "string" ? r.output : formatValue(r.output), cost: r.context.meta.cost };
    } finally {
      await rt.close();
    }
  };
}

// ── Output: .halo/evolve/<id>/ ──

export interface EvolveRecord {
  version: string;
  createdAt: string;
  /** The file evolved, relative to the folder evolve ran in, and a hash of its text then (apply refuses if it changed). */
  file: string;
  sha256: string;
  pipeline: string;
  seed: number;
  split: EvolveResult["split"];
  models: { proposer?: string; judge?: string };
  budget: number;
  spent: number;
  winner?: string;
  verdict: string;
  variants: Array<Pick<Variant, "id" | "round" | "parent" | "rationale" | "status" | "problems" | "score" | "holdoutScore">>;
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export function writeEvolveDir(dir: string, result: EvolveResult, ctx: { file: string; source: string; version: string; models: EvolveRecord["models"] }): void {
  mkdirSync(join(dir, "variants"), { recursive: true });
  for (const v of result.variants) {
    if (!v.source) continue;
    writeFileSync(join(dir, "variants", `${v.id}.halo`), v.source.endsWith("\n") ? v.source : v.source + "\n");
    writeFileSync(join(dir, "variants", `${v.id}.diff`), unifiedDiff(ctx.source, v.source, { a: `a/${ctx.file}`, b: `b/${ctx.file}` }));
  }
  const scores: string[] = [];
  for (const v of result.variants) {
    for (const [set, s] of [["proposal", v.proposal], ["holdout", v.holdout]] as const) {
      for (const r of s?.runs ?? []) scores.push(JSON.stringify({ variant: v.id, set, runId: r.runId, outcome: r.outcome, reason: r.verdict?.reason ?? r.note, liveCost: r.variant?.liveCost, estimatedCost: r.variant?.estimatedCost }));
    }
  }
  writeFileSync(join(dir, "scores.jsonl"), scores.join("\n") + (scores.length ? "\n" : ""));
  for (const v of result.variants) {
    if (v.holdout) writeFileSync(join(dir, `holdout-${v.id}.md`), compareReport(v.holdout, { original: ctx.file, variant: `${v.id}.halo` }, v.fence ?? []));
  }
  const record: EvolveRecord = {
    version: ctx.version,
    createdAt: new Date().toISOString(),
    file: ctx.file,
    sha256: sha256(ctx.source),
    pipeline: result.pipeline,
    seed: result.seed,
    split: result.split,
    models: ctx.models,
    budget: result.budget,
    spent: result.spent,
    winner: result.winner,
    verdict: result.verdict,
    variants: result.variants.map(({ id, round, parent, rationale, status, problems, score, holdoutScore }) => ({ id, round, parent, rationale, status, problems, score, holdoutScore })),
  };
  writeFileSync(join(dir, "evolve.json"), JSON.stringify(record, null, 2) + "\n");
  writeFileSync(join(dir, "report.md"), evolveReport(result, ctx));
}

const OUTCOMES_SHOWN: Outcome[] = ["worse", "now halts", "now fails", "now pauses", "diverged"];

/** report.md: the verdict, every variant, the winner's diff, and the runs that went wrong. Unredacted. */
export function evolveReport(r: EvolveResult, ctx: { file: string; source: string; models: EvolveRecord["models"] }): string {
  const L: string[] = [];
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  L.push(`# Evolving ${r.pipeline} in ${ctx.file}`, "");
  L.push("> This report holds unredacted inputs and outputs from `.halo/recordings`. Keep it out of version control.", "");
  L.push(`${r.split.proposal.length + r.split.holdout.length} recorded run(s): ${r.split.proposal.length} to propose from, ${r.split.holdout.length} held out (seed ${r.seed}). Proposer ${ctx.models.proposer ?? "?"} · judge ${ctx.models.judge ?? "none"}. Spent $${r.spent.toFixed(4)} of $${r.budget.toFixed(2)}${r.stoppedForBudget ? " (stopped at the budget)" : ""}.`, "");
  L.push("## Verdict", "", r.verdict, "");
  if (r.winner) L.push(`Apply it with \`halo evolve apply <this folder> ${r.winner}\`. Nothing has been changed yet.`, "");
  L.push("## Variants", "", "| Variant | From | Status | Proposal runs | Held out | Rationale |", "|---|---|---|---|---|---|");
  for (const v of r.variants) {
    const status = v.status === "scored" ? (r.winner === v.id ? "**winner**" : r.finalists.includes(v.id) ? "finalist" : "scored") : v.status;
    L.push(`| ${v.id} | ${v.parent} | ${status} | ${v.score ? esc(describeScore(v.score)) : esc(v.problems.slice(0, 2).join("; "))} | ${v.holdoutScore ? esc(describeScore(v.holdoutScore)) : ""} | ${esc(v.rationale)} |`);
  }
  L.push("");
  const outside = r.variants.filter((v) => v.status === "outside");
  if (outside.length) {
    L.push("## Thrown away at the fence", "");
    for (const v of outside) L.push(`- **${v.id}**: ${v.problems.join("; ")}`);
    L.push("");
  }
  const winner = r.variants.find((v) => v.id === r.winner);
  if (winner?.source) {
    const st = diffStat(ctx.source, winner.source);
    L.push(`## ${winner.id}: the change (+${st.added} −${st.removed})`, "", "```diff", unifiedDiff(ctx.source, winner.source, { a: `a/${ctx.file}`, b: `b/${ctx.file}` }).trimEnd(), "```", "");
    L.push("### Fence", "", "| Check | | |", "|---|---|---|");
    for (const c of winner.fence ?? []) L.push(`| ${c.rule} | ${c.ok ? "✓" : "✗"} | ${esc(c.detail)} |`);
    L.push("", `Every held-out run side by side: \`holdout-${winner.id}.md\`.`, "");
  }
  const bad = r.variants.filter((v) => r.finalists.includes(v.id)).flatMap((v) => (v.holdout?.runs ?? []).filter((x) => OUTCOMES_SHOWN.includes(x.outcome)).map((x) => ({ v, x })));
  if (bad.length) {
    L.push("## Held-out runs where a finalist did worse or diverged", "");
    for (const { v, x } of bad) L.push(`- ${v.id} · ${x.outcome} · run ${x.runId}: ${esc(x.verdict?.reason ?? x.note ?? x.variant?.error ?? "")}`);
    L.push("");
  }
  return L.join("\n");
}
