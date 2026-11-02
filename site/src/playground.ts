/**
 * The playground: Halo's real parser, validator, and planner, running in the browser.
 * mountPlayground() builds it inside an element (the docs' Playground component calls it).
 */

import { parse } from "../../src/parser/index.ts";
import { validate, type Diagnostic } from "../../src/parser/validate.ts";
import { plan, type Plan } from "../../src/plan.ts";
import type { ProviderInfo } from "../../src/runtime/tools.ts";
import { escapeHtml, highlight } from "./highlight.ts";
import type { SiteData } from "./render.ts";

const MARKUP = `
<div class="pg">
  <div class="pg-bar">
    <select data-pg-pick aria-label="Load an example"></select>
    <select data-pg-pipeline aria-label="Pipeline to plan"></select>
    <span class="pg-status" data-pg-status role="status"></span>
  </div>
  <div class="pg-body">
    <div class="editor">
      <pre class="editor-hl" aria-hidden="true"><code data-pg-hl></code></pre>
      <textarea data-pg-src spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Halo source"></textarea>
    </div>
    <div class="pg-out">
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected="true" data-tab="plan">plan</button>
        <button role="tab" aria-selected="false" data-tab="problems">problems <span class="badge" data-pg-count></span></button>
        <button role="tab" aria-selected="false" data-tab="ast">ast</button>
      </div>
      <div class="tab-body" data-pane="plan"><div data-pg-plan></div></div>
      <div class="tab-body" data-pane="problems" hidden><ul class="problems" data-pg-problems></ul></div>
      <div class="tab-body" data-pane="ast" hidden><pre class="ast" data-pg-ast></pre></div>
    </div>
  </div>
</div>`;

export function mountPlayground(root: HTMLElement, data: SiteData, initial?: string): void {
  root.innerHTML = MARKUP;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll(sel)] as T[];

  /** What plan and the validator know about providers: the built-ins, plus every package in the registry. */
  const providerInfo = new Map<string, ProviderInfo>(
    Object.entries(data.providers).map(([name, p]) => [name, { description: p.description, methods: (p.methods ?? undefined) as ProviderInfo["methods"] }]),
  );
  for (const p of data.packages) for (const pr of p.providers) providerInfo.set(pr.name, { methods: pr.methods.length ? (pr.methods as ProviderInfo["methods"]) : undefined });

  const src = $<HTMLTextAreaElement>("[data-pg-src]");
  const hl = $("[data-pg-hl]");
  const hlPre = hl.parentElement!;
  const pick = $<HTMLSelectElement>("[data-pg-pick]");
  const pipelinePick = $<HTMLSelectElement>("[data-pg-pipeline]");
  const status = $("[data-pg-status]");

  pick.innerHTML = data.examples.map((e) => `<option value="${e.file}">${e.file}</option>`).join("");

  const load = (file: string) => {
    const ex = data.examples.find((e) => e.file === file);
    if (!ex) return false;
    pick.value = file;
    src.value = ex.source;
    src.scrollTop = 0;
    update();
    return true;
  };
  pick.addEventListener("change", () => {
    load(pick.value);
    history.replaceState(null, "", `?example=${encodeURIComponent(pick.value)}`);
  });
  pipelinePick.addEventListener("change", () => update());

  const syncScroll = () => {
    hlPre.scrollTop = src.scrollTop;
    hlPre.scrollLeft = src.scrollLeft;
  };
  src.addEventListener("scroll", syncScroll);
  src.addEventListener("keydown", (ev) => {
    if (ev.key !== "Tab" || ev.shiftKey || ev.metaKey || ev.ctrlKey) return;
    ev.preventDefault();
    src.setRangeText("  ", src.selectionStart, src.selectionEnd, "end");
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

  const goToLine = (line: number) => {
    const offset = src.value.split("\n").slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
    src.focus();
    src.setSelectionRange(offset, offset);
    src.scrollTop = Math.max(0, (line - 4) * 20.8);
    syncScroll();
  };
  $("[data-pg-problems]").addEventListener("click", (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLElement>("[data-line]");
    if (li?.dataset.line) goToLine(Number(li.dataset.line));
  });

  function update() {
    hl.innerHTML = highlight(src.value) + "\n";
    syncScroll();
    const ast = parse(src.value);
    const problems: Diagnostic[] = ast.errors.length
      ? ast.errors.map((message) => {
          const m = message.match(/^\[(\d+):(\d+)\] (.*)$/s);
          return m ? { severity: "error" as const, message: m[3]!, line: Number(m[1]), column: Number(m[2]) } : { severity: "error" as const, message };
        })
      : validate(ast, { toolProviders: [...providerInfo.keys()] });
    const errors = problems.filter((d) => d.severity === "error").length;
    const warnings = problems.length - errors;

    status.className = `pg-status ${errors ? "bad" : warnings ? "warn" : "ok"}`;
    status.textContent = errors ? `${errors} error${errors > 1 ? "s" : ""}` : warnings ? `${warnings} warning${warnings > 1 ? "s" : ""}` : "✓ valid";
    const count = $("[data-pg-count]");
    count.textContent = problems.length ? `(${problems.length})` : "";
    count.className = `badge${errors ? " bad" : ""}`;
    $("[data-pg-problems]").innerHTML = problems.length
      ? problems.map((d) => `<li class="${d.severity}" data-line="${d.line ?? ""}"><span class="where">${d.line ? `${d.line}:${d.column ?? 0}` : ""}</span>${escapeHtml(d.message)}</li>`).join("")
      : `<li class="none">No problems.</li>`;

    const names = ast.pipelines.map((p) => p.name);
    const current = names.includes(pipelinePick.value) ? pipelinePick.value : names.at(-1);
    pipelinePick.innerHTML = names.map((n) => `<option${n === current ? " selected" : ""}>${n}</option>`).join("");
    pipelinePick.hidden = names.length < 2;

    const planEl = $("[data-pg-plan]");
    if (ast.errors.length) planEl.innerHTML = `<p class="empty">Fix the syntax errors to see the plan.</p>`;
    else if (!current) planEl.innerHTML = `<p class="empty">Declare a pipeline to see its plan.</p>`;
    else {
      try {
        planEl.innerHTML = renderPlan(plan(ast, current, { providerInfo: (p) => providerInfo.get(p) }));
      } catch (err) {
        planEl.innerHTML = `<p class="empty">${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`;
      }
    }
    $("[data-pg-ast]").textContent = JSON.stringify(ast, (k, v) => (k === "loc" ? undefined : v), 2);
  }

  if (!(initial && load(initial))) load(data.examples.find((e) => e.file.startsWith("74-"))?.file ?? data.examples[0]!.file);
}

function renderPlan(p: Plan): string {
  const steps = p.steps
    .map((s) => {
      const meta = [s.model, s.times, s.maxCost !== undefined ? `≤ $${s.maxCost.toFixed(4)}` : ""].filter(Boolean).join(" · ");
      const eff = s.effects.length
        ? `<div class="eff">${s.effects.map((e) => `<span class="${e.effect}${e.approval ? " approve" : ""}" title="${e.effect}${e.approval ? `, needs approval (${e.approval})` : ""}">${e.via ? "" : "→ "}${e.target}${e.approval ? " (approval)" : ""}</span>`).join("")}</div>`
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
      <div><dt>acts on the world without asking</dt><dd>${external.length ? external.join(", ") : "nothing"}</dd></div>
      <div><dt>needs a person's approval</dt><dd>${approve.length ? approve.join(", ") : "nothing"}</dd></div>
      <div><dt>worst-case model cost</dt><dd>${cost}${capped}${p.costNote ? ` (${escapeHtml(p.costNote)})` : ""}</dd></div>
    </dl>`;
}
