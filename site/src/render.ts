/**
 * HTML for the site's data-driven parts: a recorded run, the provider table, and the
 * package list. Used by the docs theme's components (docs/.vitepress/theme).
 */

import { escapeHtml } from "./highlight.ts";
import type { IconName } from "./icons.ts";

export interface SiteData {
  version: string;
  /** file is the path from examples/ (`learn/01-hello.halo`), name just the file name; only learn/'s are numbered. */
  examples: Array<{ file: string; name: string; section: string; number?: number; title: string; about: string; run?: string; source: string; pipelines: string[]; features: Record<string, boolean> }>;
  sections: Array<{ folder: string; title: string; icon: IconName; blurb: string }>;
  /** Old example slugs and the name each example has now. */
  renamed?: Record<string, string>;
  packages: Array<{
    name: string;
    version: string;
    description: string;
    permissionLines: string[];
    providers: Array<{ name: string; kind: string; methods: Array<{ name: string; effect: string; description: string }> }>;
  }>;
  providers: Record<string, { description?: string; methods: Array<{ name: string; effect: string; description: string }> | null }>;
  fixerRun: { model: string; durationMs: number; cost: number; replayMs: number; lines: Array<{ c?: Recorded }> };
  counts: { examples: number; providers: number; packages: number; tests: number };
}

type Recorded = { kind: string; target: string; value: unknown; toolCalls?: Array<{ name: string; args: Record<string, unknown> }> };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ── A recorded run ──

/** A tool result as a few readable lines. */
function summarize(target: string, value: unknown): string {
  const v = value as Record<string, any>;
  if (target === "Tests.run") {
    const text = `${v.stdout ?? ""}\n${v.stderr ?? ""}`;
    const fails = [...text.matchAll(/\(fail\) ([^\n[]+)/g)].map((m) => `(fail) ${m[1]!.trim()}`);
    const expected = text.match(/Expected: [^\n]+\nReceived: [^\n]+/)?.[0];
    const tally = text.match(/\d+ pass\s+\d+ fail/)?.[0]?.replace(/\s+/g, " ");
    return [...fails, expected, tally].filter(Boolean).join("\n");
  }
  if (target === "Code.read") return clip(String(v.content ?? ""), 220);
  if (target === "Code.list") return (v.entries ?? []).map((e: { path: string }) => e.path).join("  ");
  if (target === "Code.edit") return JSON.stringify(v);
  return clip(JSON.stringify(v), 200);
}

export interface RunCall {
  effect: string;
  target: string;
  args: string;
  result: string;
  ok: boolean;
}
export interface RunStep {
  n: number;
  /** "model" for the agent's turns, "pipeline" for a call the pipeline makes itself. */
  who: "model" | "pipeline";
  calls: RunCall[];
  /** The model's final answer, on the step where it stops calling tools. */
  answer?: string;
}
export interface RunSummary {
  command: string;
  model: string;
  steps: RunStep[];
  seconds: string;
  cost: string;
  replayMs: number;
  modelCalls: number;
  toolCalls: number;
  /** Tool calls the model asked for; the rest are the pipeline's own. */
  modelToolCalls: number;
  tally: string;
}

/** A Code.edit's old and new text, cut to the first line that changed, so the edit is visible in one line. */
function editedLines(target: string, args: Record<string, unknown>): Record<string, unknown> {
  if (target !== "Code.edit" || typeof args.old !== "string" || typeof args.new !== "string") return args;
  const a = args.old.split("\n"), b = args.new.split("\n");
  const i = a.findIndex((line, k) => line !== b[k]);
  if (i < 0) return args;
  return { ...args, old: a[i]!.trim(), new: (b[i] ?? "").trim() };
}

/** The recorded fixer run as steps: each model turn with the tool calls it asked for, then the pipeline's own checks. */
export function runSteps(data: Pick<SiteData, "fixerRun" | "providers">): RunSummary {
  const run = data.fixerRun;
  const effects = new Map<string, string>([["Tests.run", "external"], ...(data.providers.Workspace?.methods ?? []).map((m) => [`Code.${m.name}`, m.effect] as [string, string])]);
  const calls = run.lines.flatMap((l) => (l.c ? [l.c] : []));
  const call = (target: string, args: Record<string, unknown>, value: unknown): RunCall => {
    const result = value === undefined ? "" : summarize(target, value);
    return {
      effect: effects.get(target) ?? "unknown",
      target,
      args: Object.entries(editedLines(target, args))
        .map(([key, v]) => `${key}: ${JSON.stringify(typeof v === "string" ? clip(v.split("\n")[0]!, 70) : v)}`)
        .join(", "),
      result,
      ok: /\b0 fail\b|"replacements":1/.test(result),
    };
  };
  const steps: RunStep[] = [];
  let modelToolCalls = 0;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i]!;
    const n = steps.length + 1;
    if (c.kind === "tool") {
      // Not answering a model's request: a step of the pipeline itself.
      const t = c.target.split(".");
      const v = c.value as { command?: string } | undefined;
      const args = (c as { args?: Record<string, unknown> }).args ?? (v?.command ? { command: v.command } : {});
      steps.push({ n, who: "pipeline", calls: [call(`${t[0]}.${t[1]}`, args, c.value)] });
      continue;
    }
    if (c.kind !== "agent") continue;
    if (!c.toolCalls?.length) {
      steps.push({ n, who: "model", calls: [], answer: clip(String(c.value), 420) });
      continue;
    }
    modelToolCalls += c.toolCalls.length;
    steps.push({
      n,
      who: "model",
      calls: c.toolCalls.map((t, k) => {
        const result = calls[i + 1 + k];
        return call(t.name.replace("__", "."), t.args, result?.kind === "tool" ? result.value : undefined);
      }),
    });
    i += c.toolCalls.length;
  }
  const last = [...steps].reverse().flatMap((s) => s.calls).find((c) => c.target === "Tests.run");
  return {
    command: "halo run examples/engineering/software-team.halo --pipeline FixUntilGreen",
    model: run.model,
    steps,
    seconds: (run.durationMs / 1000).toFixed(1),
    cost: run.cost.toFixed(4),
    replayMs: run.replayMs,
    modelCalls: calls.filter((c) => c.kind === "agent").length,
    toolCalls: calls.filter((c) => c.kind === "tool").length,
    modelToolCalls,
    tally: last?.result.match(/\d+ pass \d+ fail/)?.[0]?.replace(/ (\d+ fail)/, " · $1") ?? "",
  };
}

/** The recorded run as HTML, for the home page's RecordedRun component. */
export function runHtml(data: Pick<SiteData, "fixerRun" | "providers">): string {
  const run = runSteps(data);
  const steps = run.steps.map((s) => {
    if (s.answer !== undefined) return `<li class="step" data-n="${s.n}"><div class="who">model → answer</div><div class="answer">${escapeHtml(s.answer)}</div></li>`;
    const who = s.who === "pipeline" ? "pipeline" : `model → ${s.calls.length} tool call${s.calls.length > 1 ? "s" : ""}`;
    const parts = s.calls.map((c) => `<div class="call"><span class="effect ${c.effect}">${c.effect}</span><span class="target">${c.target}</span><span class="args">(${escapeHtml(c.args)})</span></div>${c.result ? `<div class="result${c.ok ? " ok" : ""}">${escapeHtml(c.result)}</div>` : ""}`);
    return `<li class="step" data-n="${s.n}"><div class="who">${who}</div>${parts.join("")}</li>`;
  });
  return `<div class="run-head"><span>$ ${run.command}</span><span>${run.model}</span></div>
    <ol>${steps.join("")}</ol>
    <div class="run-foot"><span>${run.seconds}s · ${run.modelCalls} model calls · ${run.toolCalls} tool calls · $${run.cost}</span><span class="ok">${run.tally}</span></div>`;
}

// ── Providers ──

export function providerRows(data: SiteData) {
  return [
    ...Object.entries(data.providers)
      .filter(([name]) => name !== "GET" && name !== "SQL")
      .map(([name, p]) => ({ name, description: p.description ?? "", methods: p.methods, from: "built in" })),
    ...data.packages.flatMap((pkg) => pkg.providers.map((pr) => ({ name: pr.name, description: pkg.description, methods: pr.methods.length ? pr.methods : null, from: `halo add ${pkg.name}` }))),
  ];
}

export function providersHtml(data: SiteData): string {
  return providerRows(data)
    .map(
      (p) => `<tr data-q="${escapeHtml(`${p.name} ${p.description} ${(p.methods ?? []).map((m) => m.name).join(" ")}`.toLowerCase())}">
      <td><code>${p.name}</code><span class="desc">${escapeHtml(clip(p.description, 80))}</span></td>
      <td><div class="ms">${p.methods ? p.methods.map((m) => `<span class="e ${m.effect}" title="${escapeHtml(m.description)}">${m.name}</span>`).join("") : `<span class="e unknown">listed by the server at run time</span>`}</div></td>
      <td class="from">${p.from}</td>
    </tr>`,
    )
    .join("");
}

// ── Packages ──

export function packagesHtml(data: SiteData): string {
  return data.packages
    .map((p) => {
      const methods = p.providers
        .map((pr) =>
          pr.methods.length
            ? `<div class="methods">${pr.methods.map((m) => `<span class="m ${m.effect}" title="${escapeHtml(m.description)} (${m.effect})">${m.name}</span>`).join("")}</div>`
            : `<div class="methods"><span class="m">methods listed by its server at run time</span></div>`,
        )
        .join("");
      return `<div class="row">
      <div><h3><a href="https://registry.halolang.com/${escapeHtml(p.name)}">${escapeHtml(p.name)}</a></h3><span class="ver">${p.version} · ${p.providers.map((pr) => `${pr.name}()`).join(", ")}</span></div>
      <div class="kind ${p.providers[0]!.kind}">${[...new Set(p.providers.map((pr) => pr.kind))].join(" · ")}</div>
      <div><p>${escapeHtml(p.description)}</p>${methods}</div>
      <div class="perms">${p.permissionLines.map((l) => (l.includes("YES") ? `<span class="code-yes">${escapeHtml(l)}</span>` : escapeHtml(l))).join("<br>")}</div>
    </div>`;
    })
    .join("");
}
