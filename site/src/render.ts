/**
 * HTML for the site's data-driven parts: a recorded run, the provider table, and the
 * package list. Used by the docs theme's components (docs/.vitepress/theme).
 */

import { escapeHtml } from "./highlight.ts";

export interface SiteData {
  version: string;
  examples: Array<{ file: string; number: number; title: string; about: string; run?: string; source: string; features: Record<string, boolean> }>;
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

export function runHtml(data: SiteData): string {
  const run = data.fixerRun;
  const effects = new Map<string, string>([["Tests.run", "external"], ...(data.providers.Workspace?.methods ?? []).map((m) => [`Code.${m.name}`, m.effect] as [string, string])]);
  const calls = run.lines.flatMap((l) => (l.c ? [l.c] : []));
  const steps: string[] = [];
  let n = 0;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i]!;
    if (c.kind !== "agent") continue;
    n++;
    if (!c.toolCalls?.length) {
      steps.push(`<li class="step" data-n="${n}"><div class="who">model → answer</div><div class="answer">${escapeHtml(clip(String(c.value), 420))}</div></li>`);
      continue;
    }
    const parts = c.toolCalls.map((t, k) => {
      const target = t.name.replace("__", ".");
      const result = calls[i + 1 + k];
      const args = Object.entries(t.args)
        .map(([key, v]) => `${key}: ${JSON.stringify(typeof v === "string" ? clip(v.split("\n")[0]!, 70) : v)}`)
        .join(", ");
      const out = result?.kind === "tool" ? summarize(target, result.value) : "";
      const ok = /\b0 fail\b|"replacements":1/.test(out);
      const eff = effects.get(target) ?? "unknown";
      return `<div class="call"><span class="effect ${eff}">${eff}</span><span class="target">${target}</span><span class="args">(${escapeHtml(args)})</span></div>${out ? `<div class="result${ok ? " ok" : ""}">${escapeHtml(out)}</div>` : ""}`;
    });
    steps.push(`<li class="step" data-n="${n}"><div class="who">model → ${c.toolCalls.length} tool call${c.toolCalls.length > 1 ? "s" : ""}</div>${parts.join("")}</li>`);
    i += c.toolCalls.length;
  }
  const agentCalls = calls.filter((c) => c.kind === "agent").length;
  const toolCalls = calls.filter((c) => c.kind === "tool").length;
  return `<div class="run-head"><span>$ halo run examples/74-software-team.halo --pipeline FixUntilGreen</span><span>${run.model}</span></div>
    <ol>${steps.join("")}</ol>
    <div class="run-foot"><span>${(run.durationMs / 1000).toFixed(1)}s · ${agentCalls} model calls · ${toolCalls} tool calls · $${run.cost.toFixed(4)}</span><span class="ok">2 pass · 0 fail</span></div>`;
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
      <div><h3>${p.name}</h3><span class="ver">${p.version} · ${p.providers.map((pr) => `${pr.name}()`).join(", ")}</span></div>
      <div class="kind ${p.providers[0]!.kind}">${[...new Set(p.providers.map((pr) => pr.kind))].join(" · ")}</div>
      <div><p>${escapeHtml(p.description)}</p>${methods}</div>
      <div class="perms">${p.permissionLines.map((l) => (l.includes("YES") ? `<span class="code-yes">${escapeHtml(l)}</span>` : escapeHtml(l))).join("<br>")}</div>
    </div>`;
    })
    .join("");
}
