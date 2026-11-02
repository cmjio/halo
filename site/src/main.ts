import { parse } from "../../src/parser/index.ts";
import { validate, type Diagnostic } from "../../src/parser/validate.ts";
import { plan, type Plan } from "../../src/plan.ts";
import type { ProviderInfo } from "../../src/runtime/tools.ts";
import data from "../.gen/data.json";
import { escapeHtml, highlight } from "./highlight.ts";

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll(sel)] as T[];
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const pad2 = (n: number) => String(n).padStart(2, "0");

// ── Facts ──

for (const el of $$("[data-version]")) el.textContent = data.version;
for (const el of $$("[data-built]")) el.textContent = data.builtAt;
for (const el of $$("[data-count-examples]")) el.textContent = String(data.counts.examples);
for (const el of $$("[data-tests]")) el.textContent = data.counts.tests ? `${data.counts.tests} tests passing` : "";
$("[data-facts]")!.innerHTML = [
  ["runtime", "Bun"],
  ["providers", `${data.counts.providers} built in + ${data.counts.packages} packages`],
  ["models", "Anthropic · OpenAI · Gemini · Ollama · OpenRouter · Together · Replicate"],
  ["examples", String(data.counts.examples)],
  ...(data.counts.tests ? [["tests", `${data.counts.tests} passing`]] : []),
]
  .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
  .join("");

// ── Code: snippets, highlighted blocks, JSON, real CLI output ──

const snippets = data.snippets as Record<string, string>;
for (const el of $$("code[data-snippet]")) el.innerHTML = highlight(snippets[el.dataset.snippet!] ?? "");
for (const el of $$("code[data-hl]")) el.innerHTML = highlight(el.textContent ?? "");

const json = (text: string) =>
  escapeHtml(text).replace(/"([^"]*)"(\s*:)?/g, (_, s: string, colon?: string) => (colon ? `<span class="j-key">"${s}"</span>${colon}` : `<span class="j-str">"${s}"</span>`));
const stripe = data.packages.find((p) => p.name === "stripe");
const manifest = $("code[data-manifest]");
if (manifest && stripe) {
  const refund = stripe.providers[0]!.methods.find((m) => m.name === "create_refund");
  manifest.textContent = `// halo-tool.json (abridged)
{
  "name": "stripe",
  "version": "${stripe.version}",
  "providers": {
    "Stripe": {
      "kind": "http",
      "baseUrl": "https://api.stripe.com/v1",
      "auth": { "type": "bearer", "env": "STRIPE_API_KEY" },
      "body": "form",
      "methods": [{
        "name": "create_refund",
        "effect": "${refund?.effect ?? "external"}",
        "http": { "method": "POST", "path": "/refunds" },
        "params": { "type": "object", "required": ["charge"] }
      }]
    }
  }
}`;
}
for (const el of $$("code[data-json]")) el.innerHTML = json(el.textContent ?? "").replace(/^(\/\/.*)$/m, '<span class="t-comment">$1</span>');

/** Terminal output: the command, then what it printed, colored like the CLI colors it. */
function terminal(cmd: string, out: string): string {
  const body = escapeHtml(out)
    .split("\n")
    .map((line) => {
      if (/ error /.test(line) && /:\d+:\d+/.test(line)) return line.replace(/(error)/, '<span class="red">$1</span>').replace(/^(\s*\S+:\d+:\d+)/, '<span class="muted">$1</span>');
      if (/^✗/.test(line)) return `<span class="red">${line}</span>`;
      if (/^✓/.test(line)) return `<span class="green">${line}</span>`;
      if (/^\d+ file\(s\), [1-9]/.test(line)) return `<span class="red">${line}</span>`;
      if (/^\d+ms · /.test(line)) return `<span class="muted">${line}</span>`;
      return colorPlanLine(line);
    })
    .join("\n");
  return `<span class="p">$</span> <span class="cmd">${escapeHtml(cmd)}</span>\n${body}`;
}

function colorPlanLine(line: string): string {
  if (/^Plan for/.test(line)) return `<span class="bold">${line}</span>`;
  if (/^(Acts on|Needs|Worst-case|Spend limit|Effects not)/.test(line)) return line.replace(/^([^:]+:)/, '<span class="bold">$1</span>');
  if (/^\s+\d/.test(line)) return line.replace(/(\[[^\]]+\])/, '<span class="muted">$1</span>').replace(/(≤ \$[\d.]+)/, '<span class="muted">$1</span>');
  if (/^[A-Z][A-Z ]+:$/.test(line.trim())) return `<span class="bold">${line}</span>`;
  return line
    .replace(/: (external)/, ': <span class="red">$1</span>')
    .replace(/: (write)/, ': <span class="yellow">$1</span>')
    .replace(/: (read)\b/, ': <span class="green">$1</span>')
    .replace(/(· needs approval[^<]*)/, '<span class="yellow">$1</span>')
    .replace(/^(\s{9}(?!may|calls)\S.*)$/, '<span class="muted">$1</span>');
}

/** `halo --help`: commands and flags bright, explanations dim. */
function colorHelp(text: string): string {
  return escapeHtml(text)
    .split("\n")
    .map((line) => {
      if (/^[A-Z][A-Z ]+:$/.test(line.trim())) return `<span class="bold">${line}</span>`;
      const m = line.match(/^(\s+)(\S.*?)(\s{2,})(\S.*)$/);
      if (m && /^(halo|--|-[a-z]|[A-Z_]+,|bun )/.test(m[2]!)) return `${m[1]}<span class="cmd">${m[2]}</span>${m[3]}${m[4]}`;
      return line;
    })
    .join("\n");
}

const runs = data.runs as Record<string, { cmd: string; out: string }>;
for (const el of $$("[data-run-out]")) {
  const r = runs[el.dataset.runOut!];
  if (r) el.innerHTML = el.dataset.runOut === "help" ? colorHelp(r.out.trim()) : terminal(r.cmd, r.out);
}

// Tabs (code + output)
for (const block of $$("[data-tabs]")) {
  const tabs = $$<HTMLButtonElement>("[data-t]", block);
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      for (const t of tabs) t.setAttribute("aria-selected", String(t === tab));
      for (const p of $$("[data-p]", block)) p.hidden = p.dataset.p !== tab.dataset.t;
    });
  }
}

// ── The recorded run ──

type Recorded = { kind: string; target: string; value: unknown; toolCalls?: Array<{ name: string; args: Record<string, unknown> }> };
const effects = new Map<string, string>([["Tests.run", "external"], ...(data.providers.Workspace?.methods ?? []).map((m) => [`Code.${m.name}`, m.effect] as [string, string])]);

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
  $("[data-run]")!.innerHTML = `
    <div class="run-head"><span>$ halo run examples/74-software-team.halo --pipeline FixUntilGreen</span><span><b>${run.model}</b></span></div>
    <ol>${steps.join("")}</ol>
    <div class="run-foot"><span>${(run.durationMs / 1000).toFixed(1)}s · ${agentCalls} model calls · ${toolCalls} tool calls · $${run.cost.toFixed(4)}</span><span class="ok">2 pass · 0 fail</span></div>`;
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

// ── Plan and replay ──

$("[data-plan]")!.innerHTML = `<span class="p">$</span> <span class="cmd">halo plan examples/75-research-assistant.halo</span>\n${escapeHtml(data.plans.research).split("\n").map(colorPlanLine).join("\n")}`;
{
  const run = data.fixerRun;
  const calls = (run.lines as Array<{ c?: Recorded }>).filter((l) => l.c);
  const llm = calls.filter((l) => l.c!.kind === "agent").length;
  const tools = calls.filter((l) => l.c!.kind === "tool").length;
  $("[data-replay]")!.innerHTML = [
    `<span class="p">$</span> <span class="cmd">halo run fix.halo --arg workdir=./project</span>`,
    `<span class="muted">${(run.durationMs / 1000).toFixed(1)}s · ${llm} LLM calls · ${tools} tool calls ·</span> <span class="yellow">$${run.cost.toFixed(4)}</span> <span class="muted">· run 80edd0aa…</span>`,
    ``,
    `<span class="p">$</span> <span class="cmd">halo replay fix.halo 80edd0aa…</span>`,
    `<span class="green">✓ Same output as the recorded run 80edd0aa…</span>`,
    `<span class="muted">${run.replayMs}ms · ${llm} LLM calls · ${tools} tool calls ·</span> <span class="green">$0</span>`,
    ``,
    `<span class="c"># new prompts against the same tool results:</span>`,
    `<span class="p">$</span> <span class="cmd">halo replay fix.halo 80edd0aa… --live-models</span>`,
  ].join("\n");
}

// ── Providers reference ──

const builtinAliases = new Set(["GET", "SQL"]);
const providerRows = [
  ...Object.entries(data.providers)
    .filter(([name]) => !builtinAliases.has(name))
    .map(([name, p]) => ({ name, description: p.description ?? "", methods: p.methods, from: "built in" })),
  ...data.packages.flatMap((pkg) => pkg.providers.map((pr) => ({ name: pr.name, description: pkg.description, methods: pr.methods.length ? pr.methods : null, from: `halo add ${pkg.name}` }))),
];
$("[data-providers]")!.innerHTML = providerRows
  .map(
    (p) => `<tr data-q="${escapeHtml(`${p.name} ${p.description} ${(p.methods ?? []).map((m) => m.name).join(" ")}`.toLowerCase())}">
      <td><code>${p.name}</code><span class="desc">${escapeHtml(clip(p.description, 80))}</span></td>
      <td><div class="ms">${p.methods ? p.methods.map((m) => `<span class="e ${m.effect}" title="${escapeHtml(m.description)}">${m.name}</span>`).join("") : `<span class="e unknown">listed by the server at run time</span>`}</div></td>
      <td class="from">${p.from}</td>
    </tr>`,
  )
  .join("");
$("[data-provider-filter]")!.addEventListener("input", (ev) => {
  const q = (ev.target as HTMLInputElement).value.trim().toLowerCase();
  for (const row of $$("[data-providers] tr")) row.hidden = !!q && !row.dataset.q!.includes(q);
});

// ── Packages ──

$("[data-packages]")!.innerHTML = data.packages
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

// ── Examples ──

const examplesEl = $("[data-examples]")!;
examplesEl.innerHTML = data.examples
  .map(
    (e) => `<details class="ex" id="ex-${e.number}" data-features="${Object.entries(e.features)
      .filter(([, on]) => on)
      .map(([k]) => k)
      .join(" ")}">
      <summary><span class="num">${pad2(e.number)}</span><span class="t"><b>${escapeHtml(e.title || e.file)}</b><span>${escapeHtml(e.about)}</span></span><span class="file">${e.file}</span></summary>
      <div class="ex-body" data-src="${e.file}"></div>
    </details>`,
  )
  .join("");
// Sources are highlighted when first opened.
examplesEl.addEventListener(
  "toggle",
  (ev) => {
    const d = ev.target as HTMLDetailsElement;
    const body = $("[data-src]", d)!;
    if (!d.open || body.childElementCount) return;
    const ex = data.examples.find((x) => x.file === body.dataset.src)!;
    body.innerHTML = `<pre class="code"><code>${highlight(ex.source)}</code></pre>
      <div class="ex-actions"><button data-open="${ex.file}">Open in the playground →</button>${ex.run ? `<code>${escapeHtml(ex.run)}</code>` : ""}</div>`;
    addCopy(body);
  },
  true,
);
for (const chip of $$<HTMLButtonElement>("[data-filter]")) {
  chip.addEventListener("click", () => {
    for (const c of $$("[data-filter]")) c.classList.toggle("on", c === chip);
    const f = chip.dataset.filter!;
    for (const ex of $$("[data-examples] .ex")) ex.hidden = f !== "all" && !(ex.dataset.features ?? "").split(" ").includes(f);
  });
}

// ── Copy buttons ──

function addCopy(root: ParentNode = document) {
  for (const pre of $$<HTMLPreElement>("pre.code", root)) {
    if ($(".copy", pre) || pre.closest(".editor")) continue;
    const btn = document.createElement("button");
    btn.className = "copy";
    btn.textContent = "copy";
    btn.addEventListener("click", async () => {
      // A terminal copies its commands (no "$ ", no output, no comments); code copies as is.
      const text = [...pre.childNodes].filter((n) => n !== btn).map((n) => n.textContent).join("");
      const commands = text
        .split("\n")
        .filter((l) => /^(\$|PS>) /.test(l))
        .map((l) => l.replace(/^(\$|PS>) /, "").replace(/\s+#.*$/, "").trimEnd());
      try {
        await navigator.clipboard.writeText(commands.length ? commands.join("\n") : text);
        btn.textContent = "copied";
        btn.classList.add("done");
        setTimeout(() => ((btn.textContent = "copy"), btn.classList.remove("done")), 1400);
      } catch {
        btn.textContent = "select & copy";
      }
    });
    pre.append(btn);
  }
}
addCopy();

// ── Sidebar: the section in view, and the mobile menu ──

const tocLinks = new Map($$<HTMLAnchorElement>("[data-toc] a").map((a) => [a.getAttribute("href")!.slice(1), a]));
const inView = new Map<string, boolean>();
const observer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) inView.set(e.target.id, e.isIntersecting);
    const current = [...tocLinks.keys()].find((id) => inView.get(id));
    if (current) for (const [id, a] of tocLinks) a.classList.toggle("on", id === current);
  },
  { rootMargin: "-64px 0px -60% 0px" },
);
for (const id of tocLinks.keys()) {
  const el = document.getElementById(id);
  if (el) observer.observe(el);
}
const side = $("[data-side]")!;
const menu = $<HTMLButtonElement>("[data-menu]")!;
menu.addEventListener("click", () => {
  const open = side.classList.toggle("open");
  menu.setAttribute("aria-expanded", String(open));
});
side.addEventListener("click", (ev) => {
  if ((ev.target as HTMLElement).closest("a")) side.classList.remove("open");
});

// ── Search (⌘K or /) ──

interface Hit {
  title: string;
  sub?: string;
  kind: string;
  href: string;
  q: string;
}
const hits: Hit[] = [
  // A section matches on its title and its text (rule names, flags, ...).
  ...[...tocLinks].map(([id, a]) => ({ title: a.textContent!, kind: "section", href: `#${id}`, q: `${a.textContent} ${document.getElementById(id)?.textContent ?? ""}`.toLowerCase() })),
  ...(data.docPages as Array<{ title: string; path: string }>).map((p) => {
    const title = p.title === "index.md" ? "Docs home" : p.title;
    return { title, sub: p.path, kind: "docs", href: p.path, q: `${title} ${p.path}`.toLowerCase() };
  }),
  ...data.examples.map((e) => ({ title: e.title || e.file, sub: e.file, kind: "example", href: `#ex-${e.number}`, q: `${e.title} ${e.file} ${e.about}`.toLowerCase() })),
  ...providerRows.flatMap((p) => [
    { title: p.name, sub: p.from, kind: "provider", href: "#providers", q: `${p.name} ${p.description}`.toLowerCase() },
    ...(p.methods ?? []).map((m) => ({ title: `${p.name}.${m.name}`, sub: m.description, kind: m.effect, href: "#providers", q: `${p.name}.${m.name} ${m.description}`.toLowerCase() })),
  ]),
  ...[...runs.help!.out.matchAll(/^\s+(halo [a-z]+)[^\n]*?\s{2,}(\S[^\n]*)$/gm)].map((m) => ({ title: m[1]!, sub: m[2]!, kind: "command", href: "#cli", q: `${m[1]} ${m[2]}`.toLowerCase() })),
];

const dialog = $<HTMLDialogElement>("[data-search]")!;
const input = $<HTMLInputElement>("[data-search-input]")!;
const list = $("[data-search-results]")!;
let selected = 0;
let shown: Hit[] = [];

function search(q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  shown = (words.length ? hits.filter((h) => words.every((w) => h.q.includes(w))) : hits.filter((h) => h.kind === "section"))
    .sort((a, b) => Number(!a.title.toLowerCase().startsWith(first)) - Number(!b.title.toLowerCase().startsWith(first)))
    .slice(0, 40);
  selected = 0;
  list.innerHTML = shown.length
    ? shown
        .map((h, i) => `<li><a href="${h.href}" data-i="${i}"${i === 0 ? ' class="on"' : ""}><span>${escapeHtml(h.title)}${h.sub ? `<span class="sub">${escapeHtml(clip(h.sub, 90))}</span>` : ""}</span><span class="k">${h.kind}</span></a></li>`)
        .join("")
    : `<li class="none">Nothing matches “${escapeHtml(q)}”.</li>`;
}

function go(h: Hit | undefined) {
  if (!h) return;
  dialog.close();
  if (h.href.startsWith("#ex-")) {
    const d = document.querySelector<HTMLDetailsElement>(h.href);
    if (d) {
      for (const c of $$("[data-filter]")) c.classList.toggle("on", c.dataset.filter === "all");
      for (const ex of $$("[data-examples] .ex")) ex.hidden = false;
      d.open = true;
    }
  }
  if (h.href.startsWith("#")) document.querySelector(h.href)?.scrollIntoView();
  else location.href = h.href;
}

function openSearch() {
  input.value = "";
  search("");
  dialog.showModal();
  input.focus();
}
$("[data-search-open]")!.addEventListener("click", openSearch);
document.addEventListener("keydown", (ev) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target as HTMLElement).tagName);
  if ((ev.key.toLowerCase() === "k" && (ev.metaKey || ev.ctrlKey)) || (ev.key === "/" && !typing)) {
    ev.preventDefault();
    openSearch();
  }
});
input.addEventListener("input", () => search(input.value));
input.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
    ev.preventDefault();
    selected = Math.max(0, Math.min(shown.length - 1, selected + (ev.key === "ArrowDown" ? 1 : -1)));
    for (const a of $$("a", list)) a.classList.toggle("on", Number(a.dataset.i) === selected);
    $(`a[data-i="${selected}"]`, list)?.scrollIntoView({ block: "nearest" });
  } else if (ev.key === "Enter") {
    ev.preventDefault();
    go(shown[selected]);
  }
});
list.addEventListener("click", (ev) => {
  const a = (ev.target as HTMLElement).closest<HTMLAnchorElement>("a[data-i]");
  if (!a) return;
  ev.preventDefault();
  go(shown[Number(a.dataset.i)]);
});
dialog.addEventListener("click", (ev) => {
  if (ev.target === dialog) dialog.close();
});

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

pick.innerHTML = data.examples.map((e) => `<option value="${e.file}">${e.file}</option>`).join("");

function load(file: string, scroll = false) {
  const ex = data.examples.find((e) => e.file === file);
  if (!ex) return;
  pick.value = file;
  src.value = ex.source;
  src.scrollTop = 0;
  update();
  if (scroll) $("#playground")!.scrollIntoView();
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
  const count = $("[data-pg-count]")!;
  count.textContent = problems.length ? `(${problems.length})` : "";
  count.className = `badge${errors ? " bad" : ""}`;
  $("[data-pg-problems]")!.innerHTML = problems.length
    ? problems.map((d) => `<li class="${d.severity}" data-line="${d.line ?? ""}"><span class="where">${d.line ? `${d.line}:${d.column ?? 0}` : ""}</span>${escapeHtml(d.message)}</li>`).join("")
    : `<li class="none">No problems.</li>`;

  const names = ast.pipelines.map((p) => p.name);
  const current = names.includes(pipelinePick.value) ? pipelinePick.value : names.at(-1);
  pipelinePick.innerHTML = names.map((n) => `<option${n === current ? " selected" : ""}>${n}</option>`).join("");
  pipelinePick.hidden = names.length < 2;

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

load(data.examples.find((e) => e.file.startsWith("74-"))?.file ?? data.examples[0]!.file);
