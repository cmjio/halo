import { parse } from "../../src/parser/index.ts";
import { validate, type Diagnostic } from "../../src/parser/validate.ts";
import { plan, type Plan } from "../../src/plan.ts";
import type { ProviderInfo } from "../../src/runtime/tools.ts";
import data from "../.gen/data.json";
import { escapeHtml, highlight } from "./highlight.ts";

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll(sel)] as T[];
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ── Facts and static code ──

for (const el of $$("[data-version]")) el.textContent = data.version;
for (const el of $$("[data-built]")) el.textContent = data.builtAt;
for (const el of $$("[data-count-examples]")) el.textContent = String(data.counts.examples);
for (const el of $$("code[data-highlight]")) el.innerHTML = highlight(el.textContent ?? "");
for (const el of $$("code[data-highlight-json]")) {
  el.innerHTML = escapeHtml(el.textContent ?? "").replace(/"([^"]*)"(\s*:)?/g, (_, s: string, colon?: string) => (colon ? `<span class="t-type">"${s}"</span>${colon}` : `<span class="t-string">"${s}"</span>`));
}
$("[data-facts]")!.innerHTML = [
  [data.counts.providers, "Built-in tool providers"],
  [data.counts.packages, "Installable packages"],
  [data.counts.examples, "Working examples"],
  [data.counts.tests, "Passing tests"],
]
  .filter(([n]) => n)
  .map(([n, label]) => `<div><dt>${label}</dt><dd>${n}</dd></div>`)
  .join("");

// The hero listing: numbered lines, with pins on the lines its margin notes explain.
for (const code of $$("code[data-annotated]")) {
  const notes = $$("li[data-line]", code.closest(".listing")!).map((li) => Number(li.dataset.line));
  const lines = highlight(code.textContent ?? "").split("\n");
  code.innerHTML = lines
    .map((line, i) => {
      const pin = notes.indexOf(i + 1);
      return `<span class="ln${pin >= 0 ? " noted" : ""}" data-n="${i + 1}">${line || " "}${pin >= 0 ? `<span class="pin" aria-label="note ${pin + 1}">${pin + 1}</span>` : ""}</span>`;
    })
    .join("");
}

// ── The recorded run ──

type Recorded = { kind: string; target: string; value: unknown; toolCalls?: Array<{ name: string; args: Record<string, unknown> }> };
const effects = new Map<string, string>([
  ["Tests.run", "external"],
  ...(data.providers.Workspace?.methods ?? []).map((m) => [`Code.${m.name}`, m.effect] as [string, string]),
]);

function renderRun() {
  const run = data.fixerRun;
  const calls = (run.lines as Array<{ c?: Recorded }>).flatMap((l) => (l.c ? [l.c] : []));
  const steps: string[] = [];
  let n = 0;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i]!;
    if (c.kind !== "agent") continue;
    n++;
    if (!c.toolCalls?.length) {
      steps.push(`<li class="step" data-n="${n}"><div class="who">Fixer answers</div><div class="answer">${escapeHtml(clip(String(c.value), 420))}</div></li>`);
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
      return `<div class="call"><span class="effect ${effects.get(target) ?? "unknown"}">${effects.get(target) ?? "?"}</span><span class="target">${target}</span><span class="args">(${escapeHtml(args)})</span></div>${out ? `<div class="result${ok ? " ok" : ""}">${escapeHtml(out)}</div>` : ""}`;
    });
    steps.push(`<li class="step" data-n="${n}"><div class="who">Fixer calls ${c.toolCalls.length === 1 ? "a tool" : `${c.toolCalls.length} tools`}</div>${parts.join("")}</li>`);
    i += c.toolCalls.length;
  }
  const agentCalls = calls.filter((c) => c.kind === "agent").length;
  const toolCalls = calls.filter((c) => c.kind === "tool").length;
  $("[data-run]")!.innerHTML = `
    <div class="run-head"><span>halo run examples/74-software-team.halo --pipeline FixUntilGreen</span><span><b>${run.model}</b></span></div>
    <ol>${steps.join("")}</ol>
    <div class="run-foot"><span>${(run.durationMs / 1000).toFixed(1)} s · ${agentCalls} model calls · ${toolCalls} tool calls · $${run.cost.toFixed(4)}</span><span class="ok">✓ 2 pass, 0 fail</span></div>`;
}

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

renderRun();

// ── Plan and replay terminals ──

function colorPlan(text: string): string {
  return escapeHtml(text)
    .split("\n")
    .map((line) => {
      if (/^Plan for/.test(line)) return `<span class="bold">${line}</span>`;
      if (/^\s+\d/.test(line)) return line.replace(/(\[[^\]]+\])/, '<span class="muted">$1</span>').replace(/(≤ \$[\d.]+)/, '<span class="muted">$1</span>');
      if (/^(Acts on|Needs|Worst-case|Spend limit|Effects not)/.test(line)) return line.replace(/^([^:]+:)/, '<span class="bold">$1</span>');
      return line
        .replace(/: (external)/, ': <span class="red">$1</span>')
        .replace(/: (write)/, ': <span class="yellow">$1</span>')
        .replace(/(· needs approval[^<]*)/, '<span class="yellow">$1</span>')
        .replace(/^(\s{9}(?!may|calls).*)$/, '<span class="muted">$1</span>');
    })
    .join("\n");
}
$("[data-plan]")!.innerHTML = `<span class="muted">$ halo plan examples/75-research-assistant.halo</span>\n\n${colorPlan(data.plans.research)}`;
{
  const run = data.fixerRun;
  const calls = (run.lines as Array<{ c?: Recorded }>).filter((l) => l.c);
  $("[data-replay]")!.innerHTML = [
    `<span class="muted">$ halo run examples/74-software-team.halo --pipeline FixUntilGreen …</span>`,
    `${(run.durationMs / 1000).toFixed(1)} s · ${calls.filter((l) => l.c!.kind === "agent").length} LLM calls · ${calls.filter((l) => l.c!.kind === "tool").length} tool calls · <span class="yellow">$${run.cost.toFixed(4)}</span>`,
    `run 80edd0aa… (halo replay examples/74-software-team.halo 80edd0aa…)`,
    ``,
    `<span class="muted">$ halo replay examples/74-software-team.halo 80edd0aa…</span>`,
    `<span class="green">✓ Same output as the recorded run 80edd0aa…</span>`,
    `${run.replayMs} ms · ${calls.filter((l) => l.c!.kind === "agent").length} LLM calls · ${calls.filter((l) => l.c!.kind === "tool").length} tool calls · <span class="green">$0</span>`,
  ].join("\n");
}

// ── Registry ──

$("[data-packages]")!.innerHTML = data.packages
  .map((p) => {
    const kinds = [...new Set(p.providers.map((pr) => pr.kind))].join(" · ");
    const methods = p.providers
      .map((pr) =>
        pr.methods.length
          ? `<div class="methods">${pr.methods.map((m) => `<span class="m ${m.effect}" title="${escapeHtml(m.description)} (${m.effect})">${m.name}</span>`).join("")}</div>`
          : `<div class="methods"><span class="m">listed by its server at run time</span></div>`,
      )
      .join("");
    return `<div class="row" role="row">
      <div role="cell"><h3>${p.name}</h3><span class="ver">${p.version} · tool X : ${p.providers.map((pr) => `${pr.name}()`).join(", ")}</span></div>
      <div role="cell" class="kind ${p.providers[0]!.kind}">${kinds}</div>
      <div role="cell"><p>${escapeHtml(p.description)}</p>${methods}</div>
      <div role="cell" class="perms">${p.permissionLines.map((l) => (l.includes("YES") ? `<span class="code-yes">${escapeHtml(l)}</span>` : escapeHtml(l))).join("<br>")}</div>
    </div>`;
  })
  .join("");
$("[data-builtins]")!.textContent = Object.keys(data.providers)
  .filter((n) => !["GET", "SQL"].includes(n))
  .join(", ");

// ── Examples ──

const examplesEl = $("[data-examples]")!;
examplesEl.innerHTML = data.examples
  .map(
    (e) => `<article class="ex" data-features="${Object.entries(e.features)
      .filter(([, on]) => on)
      .map(([k]) => k)
      .join(" ")}">
      <span class="num">${String(e.number).padStart(2, "0")}</span>
      <h3>${escapeHtml(e.title || e.file)}<small>${e.file}</small></h3>
      <p>${escapeHtml(e.about)}</p>
      <button data-open="${e.file}">Open →</button>
    </article>`,
  )
  .join("");
for (const chip of $$<HTMLButtonElement>("[data-filter]")) {
  chip.addEventListener("click", () => {
    for (const c of $$("[data-filter]")) c.classList.toggle("on", c === chip);
    const f = chip.dataset.filter!;
    for (const ex of $$("[data-examples] .ex")) ex.hidden = f !== "all" && !(ex.dataset.features ?? "").split(" ").includes(f);
  });
}

// ── Playground ──

/** What plan and the validator know about providers: the built-ins, plus every package in the registry. */
const providerInfo = new Map<string, ProviderInfo>(
  Object.entries(data.providers).map(([name, p]) => [name, { description: p.description, methods: (p.methods ?? undefined) as ProviderInfo["methods"] }]),
);
for (const p of data.packages) for (const pr of p.providers) providerInfo.set(pr.name, { methods: pr.methods.length ? (pr.methods as ProviderInfo["methods"]) : undefined });

const src = $<HTMLTextAreaElement>("[data-pg-src]")!;
const hl = $("[data-pg-hl]")!;
const hlPre = hl.parentElement!;
const pick = $<HTMLSelectElement>("[data-pg-pick]")!;
const pipelinePick = $<HTMLSelectElement>("[data-pg-pipeline]")!;
const status = $("[data-pg-status]")!;

pick.innerHTML = data.examples.map((e) => `<option value="${e.file}">${String(e.number).padStart(2, "0")} · ${escapeHtml(clip(e.title || e.file, 46))}</option>`).join("");

function load(file: string, scroll = false) {
  const ex = data.examples.find((e) => e.file === file);
  if (!ex) return;
  pick.value = file;
  src.value = ex.source;
  src.scrollTop = 0;
  update();
  if (scroll) $("#c06")!.scrollIntoView();
}
examplesEl.addEventListener("click", (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-open]");
  if (btn) load(btn.dataset.open!, true);
});
pick.addEventListener("change", () => load(pick.value));
pipelinePick.addEventListener("change", () => update());

const syncScroll = () => {
  hlPre.scrollTop = src.scrollTop;
  hlPre.scrollLeft = src.scrollLeft;
};
src.addEventListener("scroll", syncScroll);
src.addEventListener("keydown", (ev) => {
  if (ev.key !== "Tab" || ev.shiftKey || ev.metaKey || ev.ctrlKey) return;
  ev.preventDefault();
  const { selectionStart: a, selectionEnd: b } = src;
  src.setRangeText("  ", a, b, "end");
  update();
});
let timer: ReturnType<typeof setTimeout> | undefined;
src.addEventListener("input", () => {
  hl.innerHTML = highlight(src.value) + "\n";
  syncScroll();
  clearTimeout(timer);
  timer = setTimeout(update, 140);
});

for (const tab of $$<HTMLButtonElement>("[data-tab]")) {
  tab.addEventListener("click", () => {
    for (const t of $$("[data-tab]")) t.setAttribute("aria-selected", String(t === tab));
    for (const p of $$("[data-pane]")) p.hidden = p.dataset.pane !== tab.dataset.tab;
  });
}

function goToLine(line: number) {
  const offset = src.value.split("\n").slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
  src.focus();
  src.setSelectionRange(offset, offset);
  src.scrollTop = Math.max(0, (line - 4) * 20.8);
  syncScroll();
}

function update() {
  hl.innerHTML = highlight(src.value) + "\n";
  syncScroll();
  const ast = parse(src.value);
  const problems: Array<Diagnostic> = ast.errors.length
    ? ast.errors.map((message) => {
        const m = message.match(/^\[(\d+):(\d+)\] (.*)$/s);
        return m ? { severity: "error" as const, message: m[3]!, line: Number(m[1]), column: Number(m[2]) } : { severity: "error" as const, message };
      })
    : validate(ast, { toolProviders: [...providerInfo.keys()] });
  const errors = problems.filter((d) => d.severity === "error").length;
  const warnings = problems.length - errors;

  status.className = `pg-status ${errors ? "bad" : warnings ? "warn" : "ok"}`;
  status.textContent = errors ? `${errors} error${errors > 1 ? "s" : ""}` : warnings ? `${warnings} warning${warnings > 1 ? "s" : ""}` : "✓ valid";
  const count = $("[data-pg-count]")!;
  count.textContent = String(problems.length);
  count.className = `badge${errors ? " bad" : ""}`;
  $("[data-pg-problems]")!.innerHTML = problems.length
    ? problems.map((d) => `<li class="${d.severity}" data-line="${d.line ?? ""}"><span class="where">${d.line ? `line ${d.line}` : ""}</span>${escapeHtml(d.message)}</li>`).join("")
    : `<li class="none">No problems.</li>`;

  const names = ast.pipelines.map((p) => p.name);
  const current = names.includes(pipelinePick.value) ? pipelinePick.value : names.at(-1);
  pipelinePick.innerHTML = names.map((n) => `<option${n === current ? " selected" : ""}>${n}</option>`).join("");
  $("[data-pg-pipeline-wrap]")!.hidden = names.length < 2;

  const planEl = $("[data-pg-plan]")!;
  if (ast.errors.length) planEl.innerHTML = `<p class="empty">Fix the syntax errors to see the plan.</p>`;
  else if (!current) planEl.innerHTML = `<p class="empty">Declare a pipeline to see its plan.</p>`;
  else {
    try {
      planEl.innerHTML = renderPlan(plan(ast, current, { providerInfo: (p) => providerInfo.get(p) }));
    } catch (err) {
      planEl.innerHTML = `<p class="empty">${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`;
    }
  }
  $("[data-pg-ast]")!.textContent = JSON.stringify(ast, (k, v) => (k === "loc" ? undefined : v), 2);
}

$("[data-pg-problems]")!.addEventListener("click", (ev) => {
  const li = (ev.target as HTMLElement).closest<HTMLElement>("[data-line]");
  if (li?.dataset.line) goToLine(Number(li.dataset.line));
});

function renderPlan(p: Plan): string {
  const steps = p.steps
    .map((s) => {
      const meta = [s.model, s.times, s.maxCost !== undefined ? `≤ $${s.maxCost.toFixed(4)}` : ""].filter(Boolean).join(" · ");
      const eff = s.effects.length
        ? `<div class="eff">${s.effects.map((e) => `<span class="${e.effect}${e.approval ? " approve" : ""}" title="${e.effect}${e.approval ? `, needs approval (${e.approval})` : ""}">${e.via ? "" : "→ "}${e.target}${e.approval ? " · approval" : ""}</span>`).join("")}</div>`
        : "";
      const notes = s.notes.length ? `<div class="meta">${s.notes.map(escapeHtml).join(" · ")}</div>` : "";
      return `<li class="${s.kind}"><div class="lbl">${escapeHtml(s.label)}</div>${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}${notes}${eff}</li>`;
    })
    .join("");
  const all = p.steps.flatMap((s) => s.effects);
  const uniq = (xs: string[]) => [...new Set(xs)];
  const external = uniq(all.filter((e) => e.effect === "external" && !e.approval).map((e) => e.target));
  const approve = uniq(all.filter((e) => e.approval).map((e) => e.target));
  const cost = p.maxCost !== undefined ? `$${p.maxCost.toFixed(4)}` : "unbounded";
  const capped = p.cappedAt !== undefined && (p.maxCost === undefined || p.cappedAt < p.maxCost) ? `, MaxSpend stops it at $${p.cappedAt.toFixed(2)}` : "";
  return `<ol class="flow">${steps || `<li><span class="empty">This pipeline has no stages to plan.</span></li>`}</ol>
    <dl class="summary">
      <div><dt>Acts on the world without asking</dt><dd>${external.length ? external.join(", ") : "nothing"}</dd></div>
      <div><dt>Needs a person's approval</dt><dd>${approve.length ? approve.join(", ") : "nothing"}</dd></div>
      <div><dt>Worst-case model cost</dt><dd>${cost}${capped}${p.costNote ? ` (${escapeHtml(p.costNote)})` : ""}</dd></div>
    </dl>`;
}

load(data.examples.find((e) => e.file.startsWith("75-"))?.file ?? data.examples[0]!.file);
