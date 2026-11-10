/**
 * The playground: Halo's real parser, validator, and planner, running in the browser.
 * mountPlayground() builds it inside an element (the docs' Playground component calls it).
 *
 * It's meant to be a place to mess about safely: every example and a set of challenges
 * to open, a cheat sheet that writes code for you, problems marked on the line they're
 * on, edits that survive a reload, a link to share what you wrote, and a small party
 * when something starts working.
 */

import { parse } from "../../src/parser/index.ts";
import { validate, type Diagnostic } from "../../src/parser/validate.ts";
import { plan, type Plan } from "../../src/plan.ts";
import type { ProviderInfo } from "../../src/runtime/tools.ts";
import { CHALLENGES, TRACKS, type Challenge } from "./challenges.ts";
import { setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { EditorSelection, EditorState, type Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { flashLine, haloEditor, SHORTCUTS } from "./editor.ts";
import { escapeHtml, highlight } from "./highlight.ts";
import { icon, type IconName } from "./icons.ts";
import type { SiteData } from "./render.ts";

/** Where the playground starts: an example, a challenge, or shared code (from a #code= link). */
export interface PlaygroundStart {
  example?: string;
  challenge?: string;
  code?: string;
}

type Example = SiteData["examples"][number];
/** scratch is the blank canvas, or code someone shared (which keeps its own draft). */
type Mode = { kind: "example"; example: Example } | { kind: "challenge"; challenge: Challenge } | { kind: "scratch"; shared?: boolean };

const SCRATCH = `// A blank page. Open the cheat sheet tab to add pieces,
// or press Surprise me for an example to pull apart.

agent Helper [anthropic/claude-haiku-4-5, temp: 0.7]

pipeline Hello(name: String) -> Result:
  name
    |> Helper.prompt("Say something nice to {{name}}.")
    |> System.Print()
`;

/** The cheat sheet: each card explains a piece of Halo and adds it below the cursor's line. */
const SNIPPETS: Array<{ id: string; icon: IconName; title: string; note: string; code: string }> = [
  { id: "agent", icon: "robot", title: "agent", note: "A model with settings. Pipelines call it by name.", code: "agent Helper [anthropic/claude-haiku-4-5, temp: 0.7]\n" },
  { id: "pipeline", icon: "route", title: "pipeline", note: "Named inputs flowing through stages, top to bottom.", code: 'pipeline Go(input: String) -> Result:\n  input\n    |> Helper.prompt("Do something useful with {{input}}.")\n' },
  { id: "call", icon: "arrow-right", title: "|>  call", note: "Pass the current value to an agent or tool.", code: '    |> Helper.prompt("Make this better: {{context.current}}")\n' },
  { id: "fanout", icon: "arrows-split", title: "|*  fan-out", note: "Run several calls at once.", code: '    |* { Helper.prompt("Idea one"), Helper.prompt("Idea two") }\n' },
  { id: "gate", icon: "traffic-lights", title: "|?  gate", note: "Stop here unless the condition holds.", code: "    |? (context.current != null)\n" },
  { id: "ask", icon: "hand-stop", title: "|!  ask a person", note: "Pause the run until someone answers.", code: '    |! yield(msg: "Look good?", [context.current]) as ok\n    |? (context.data.ok.approved == true)\n' },
  { id: "loop", icon: "repeat", title: "|<> loop", note: "Send it back to an agent while a check fails.", code: '    |<> loop(Helper, "context.current.length > 280", max: 3)\n' },
  { id: "policy", icon: "shield", title: "policy", note: "Rules the runtime enforces. Attach with `requires`.", code: "policy Budget : MaxSpend(0.10)\n" },
  { id: "requires", icon: "link", title: "requires", note: "Put on the line under an agent to apply a policy.", code: "  requires Budget\n" },
  { id: "tool", icon: "tool", title: "tool", note: "Something agents can call: Slack, GitHub, SQL, Bash…", code: "tool Chat : Slack(Env.SLACK_BOT_TOKEN)\n" },
  { id: "schema", icon: "schema", title: "schema", note: "The shape an answer must have.", code: "schema Answer {\n  title: String\n  score: Number\n}\n" },
  { id: "print", icon: "printer", title: "System.Print()", note: "Show the result.", code: "    |> System.Print()\n" },
];

const STEP_ICON: Record<string, IconName> = { model: "brain", tool: "tool", "agent-tools": "robot", control: "traffic-lights", human: "hand-stop", pipeline: "route" };
const CHEERS = ["Fixed it!", "Clean as a whistle", "The validator is happy", "Back in business", "Nice one", "All green"];
const pickOne = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

/** localStorage can be missing or throw (private windows, blocked storage): the playground works without it. */
const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(`halo-pg:${key}`);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(`halo-pg:${key}`);
      else localStorage.setItem(`halo-pg:${key}`, value);
    } catch {}
  },
};

const MARKUP = `
<div class="pg">
  <div class="pg-bar">
    <select data-pg-pick aria-label="Open an example or a challenge"></select>
    <button type="button" class="pg-btn" data-pg-dice title="Open a random example">${icon("dice-5")} <span>Surprise me</span></button>
    <select data-pg-pipeline aria-label="Pipeline to plan"></select>
    <span class="pg-spacer"></span>
    <button type="button" class="pg-btn" data-pg-keys aria-expanded="false" title="Keyboard shortcuts">${icon("keyboard")} <span>Shortcuts</span></button>
    <button type="button" class="pg-btn" data-pg-reset hidden title="Undo all your edits to this file">${icon("rotate")} <span>Reset</span></button>
    <button type="button" class="pg-btn" data-pg-share title="Copy a link to what's in the editor (⌘S / Ctrl+S)">${icon("link")} <span>Share</span></button>
    <span class="pg-status" data-pg-status role="status" aria-live="polite"></span>
  </div>
  <div class="pg-intro" data-pg-intro></div>
  <div class="pg-body">
    <div class="editor" data-pg-editor>
      <div class="pg-keys" data-pg-keys-panel hidden>
        <div class="pg-keys-head"><strong>${icon("keyboard")} Keyboard shortcuts</strong><button type="button" class="pg-link" data-pg-keys-close aria-label="Close">${icon("x")}</button></div>
        <dl data-pg-keys-list></dl>
      </div>
    </div>
    <div class="pg-out">
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected="true" data-tab="plan">plan</button>
        <button role="tab" aria-selected="false" data-tab="problems">problems <span class="badge" data-pg-count></span></button>
        <button role="tab" aria-selected="false" data-tab="cheats">cheat sheet</button>
        <button role="tab" aria-selected="false" data-tab="ast">ast</button>
      </div>
      <div class="tab-body" data-pane="plan"><div data-pg-plan></div></div>
      <div class="tab-body" data-pane="problems" hidden><ul class="problems" data-pg-problems></ul></div>
      <div class="tab-body" data-pane="cheats" hidden>
        <p class="pg-tip">Click a card to add it below the line your cursor is on. <kbd>Tab</kbd> indents, <kbd>⌘/</kbd> comments a line, <kbd>⌘Z</kbd> undoes anything, and ${icon("keyboard")} Shortcuts lists the rest.</p>
        <div class="cheats" data-pg-cheats></div>
      </div>
      <div class="tab-body" data-pane="ast" hidden><pre class="ast" data-pg-ast></pre></div>
    </div>
  </div>
  <div class="pg-toast" data-pg-toast role="status" aria-live="polite" hidden></div>
</div>`;

export function mountPlayground(root: HTMLElement, data: SiteData, start: PlaygroundStart | string = {}): void {
  if (typeof start === "string") start = { example: start };
  root.innerHTML = MARKUP;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll(sel)] as T[];
  const pg = $(".pg");
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** What plan and the validator know about providers: the built-ins, plus every package in the registry. */
  const providerInfo = new Map<string, ProviderInfo>(
    Object.entries(data.providers).map(([name, p]) => [name, { description: p.description, methods: (p.methods ?? undefined) as ProviderInfo["methods"] }]),
  );
  for (const p of data.packages) for (const pr of p.providers) providerInfo.set(pr.name, { methods: pr.methods.length ? (pr.methods as ProviderInfo["methods"]) : undefined });

  const editorHost = $("[data-pg-editor]");
  const pick = $<HTMLSelectElement>("[data-pg-pick]");
  const pipelinePick = $<HTMLSelectElement>("[data-pg-pipeline]");
  const status = $("[data-pg-status]");
  const intro = $("[data-pg-intro]");
  const resetBtn = $<HTMLButtonElement>("[data-pg-reset]");

  // ── What's open ──

  const sections = data.sections ?? [];
  const sectionOf = (e: Example) => sections.find((s) => s.folder === e.section);
  const slug = (e: Example) => e.name.replace(/\.halo$/, "");
  /**
   * An example by its path (`learn/01-hello.halo`), name (`software-team.halo`), or slug
   * (`software-team`). Old links (`74-software-team`, `casebook/021-ecommerce-refund`) go
   * through the renames, path or not.
   */
  const findExample = (key: string): Example | undefined => {
    const k = key.replace(/\.halo$/, "");
    const found = data.examples.find((e) => e.file.replace(/\.halo$/, "") === k || slug(e) === k);
    if (found) return found;
    const renamed = data.renamed ?? {};
    const to = renamed[k] ?? renamed[k.split("/").pop()!];
    return to ? data.examples.find((e) => slug(e) === to) : undefined;
  };
  const label = (e: Example) => `${e.number !== undefined ? `${String(e.number).padStart(2, "0")} · ` : ""}${e.title || e.name}`;

  const solved = new Set((store.get("solved") ?? "").split(",").filter(Boolean));
  const renderPicker = () => {
    const groups = sections.map((s) => {
      const list = data.examples.filter((e) => e.section === s.folder);
      return list.length ? `<optgroup label="${escapeHtml(s.title)}">${list.map((e) => `<option value="ex:${escapeHtml(e.file)}">${escapeHtml(label(e))}</option>`).join("")}</optgroup>` : "";
    });
    // One group per track, numbered straight through so "Challenge 9" means the same everywhere.
    const challenges = TRACKS.map((t) => {
      const opts = CHALLENGES.map((c, i) => (c.track === t ? `<option value="ch:${c.id}">${i + 1}. ${escapeHtml(c.title)}${solved.has(c.id) ? " ✓" : ""}</option>` : "")).join("");
      return `<optgroup label="Challenges · ${t}">${opts}</optgroup>`;
    }).join("");
    pick.innerHTML = `${challenges}<optgroup label="Start fresh"><option value="scratch">Blank canvas</option></optgroup>${groups.join("")}`;
  };
  renderPicker();

  let mode: Mode = { kind: "scratch" };
  /** The text a reset goes back to. */
  let original = "";
  /** Whether the person has typed since this file was opened: only their own edits earn a cheer. */
  let touched = false;
  let lastErrors: number | null = null;
  let lastSolved = false;

  const draftKey = () => (mode.kind === "example" ? `draft:ex:${mode.example.file}` : mode.kind === "challenge" ? `draft:ch:${mode.challenge.id}` : mode.shared ? "draft:shared" : "draft:scratch");
  const pickValue = () => (mode.kind === "example" ? `ex:${mode.example.file}` : mode.kind === "challenge" ? `ch:${mode.challenge.id}` : "scratch");
  const urlFor = () => {
    const q = mode.kind === "example" ? `?example=${encodeURIComponent(slug(mode.example))}` : mode.kind === "challenge" ? `?challenge=${mode.challenge.id}` : "";
    return `${location.pathname}${q}`;
  };

  function open(next: Mode, opts: { text?: string; restoreDraft?: boolean } = {}) {
    mode = next;
    original = next.kind === "example" ? next.example.source : next.kind === "challenge" ? next.challenge.starter : (opts.text ?? SCRATCH);
    const draft = opts.restoreDraft === false ? null : store.get(draftKey());
    const text = opts.text ?? (draft && draft !== original ? draft : original);
    // A fresh state per file: its own undo history and folds.
    view.setState(EditorState.create({ doc: text, extensions }));
    view.scrollDOM.scrollTop = 0;
    touched = false;
    lastErrors = null;
    lastSolved = false;
    pick.value = pickValue();
    renderIntro();
    update();
    if (!opts.text && draft && draft !== original) toast("Picked up where you left off. Reset starts over.", "rotate");
  }

  const openKey = (value: string) => {
    if (value.startsWith("ex:")) {
      const e = findExample(value.slice(3));
      if (e) open({ kind: "example", example: e });
    } else if (value.startsWith("ch:")) {
      const c = CHALLENGES.find((c) => c.id === value.slice(3));
      if (c) open({ kind: "challenge", challenge: c });
    } else open({ kind: "scratch" });
    history.replaceState(null, "", urlFor());
  };
  pick.addEventListener("change", () => openKey(pick.value));
  pipelinePick.addEventListener("change", () => update());

  $("[data-pg-dice]").addEventListener("click", (ev) => {
    const pool = data.examples.filter((e) => mode.kind !== "example" || e.file !== mode.example.file);
    const e = pickOne(pool);
    const btn = ev.currentTarget as HTMLElement;
    btn.classList.remove("roll");
    void btn.offsetWidth;
    btn.classList.add("roll");
    openKey(`ex:${e.file}`);
    toast(e.title || e.name, sectionOf(e)?.icon ?? "dice-5");
  });

  resetBtn.addEventListener("click", () => {
    store.set(draftKey(), null);
    replaceAll(original);
    touched = false;
    toast("Back to the start", "rotate");
  });

  $("[data-pg-share]").addEventListener("click", () => share());

  // ── The intro strip: what this file is, or the challenge's goal ──

  function renderIntro() {
    if (mode.kind === "example") {
      const e = mode.example;
      const s = sectionOf(e);
      intro.className = "pg-intro";
      intro.innerHTML = `<div class="pg-intro-text"><span class="pg-crumb">${s ? `${icon(s.icon)} ${escapeHtml(s.title)}` : ""}</span><strong>${escapeHtml(e.title || e.name)}</strong>${e.about ? `<span class="pg-about" title="${escapeHtml(e.about)}">${escapeHtml(e.about)}</span>` : ""}</div>
        <button type="button" class="pg-link" data-go-challenge>${icon("target")} New here? Try a challenge</button>`;
    } else if (mode.kind === "challenge") {
      const c = mode.challenge;
      const i = CHALLENGES.indexOf(c);
      const dot = (x: Challenge) => {
        const j = CHALLENGES.indexOf(x);
        return `<button type="button" class="dot${solved.has(x.id) ? " done" : ""}${x === c ? " here" : ""}" data-ch="${x.id}" title="${escapeHtml(`${j + 1}. ${x.title} (${x.track})${solved.has(x.id) ? ", solved" : ""}`)}" aria-label="Challenge ${j + 1}: ${escapeHtml(x.title)}"></button>`;
      };
      // The dots in a little cluster per track, so the progress row reads as chapters.
      const dots = TRACKS.map((t) => `<span class="pg-dots-track" title="${t}">${CHALLENGES.filter((x) => x.track === t).map(dot).join("")}</span>`).join("");
      intro.className = "pg-intro challenge";
      intro.innerHTML = `<div class="pg-intro-text"><span class="pg-crumb">${icon("target")} Challenge ${i + 1} of ${CHALLENGES.length} · ${c.track}</span><strong>${icon(c.icon)} ${escapeHtml(c.title)}</strong><span class="pg-goal">${escapeHtml(c.goal)}</span>
          <span class="pg-hint" data-pg-hint hidden>${icon("bulb")} ${inlineCode(c.hint)}</span></div>
        <div class="pg-intro-side">
          <span class="pg-check" data-pg-check></span>
          <div class="pg-dots">${dots}</div>
          <div class="pg-intro-actions">
            <button type="button" class="pg-link" data-pg-hint-btn>${icon("bulb")} Hint</button>
            <button type="button" class="pg-link" data-pg-solution>${icon("eye")} Show me</button>
            <button type="button" class="pg-btn primary" data-pg-next style="visibility: hidden">Next →</button>
          </div>
        </div>`;
    } else {
      intro.className = "pg-intro";
      intro.innerHTML = `<div class="pg-intro-text"><span class="pg-crumb">${mode.shared ? `${icon("link")} Shared with you` : `${icon("sparkles")} Blank canvas`}</span><span class="pg-about">${mode.shared ? "Someone sent you this. It's your copy now: change anything. " : ""}Write anything. It's checked and planned as you type, nothing leaves this page, and no model is called.</span></div>
        <button type="button" class="pg-link" data-go-challenge>${icon("target")} Want a goal? Try a challenge</button>`;
    }
  }

  intro.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest("[data-go-challenge]")) {
      const next = CHALLENGES.find((c) => !solved.has(c.id)) ?? CHALLENGES[0]!;
      openKey(`ch:${next.id}`);
    } else if (t.closest("[data-ch]")) openKey(`ch:${t.closest<HTMLElement>("[data-ch]")!.dataset.ch}`);
    else if (t.closest("[data-pg-hint-btn]")) {
      const h = $("[data-pg-hint]");
      h.hidden = !h.hidden;
    } else if (t.closest("[data-pg-solution]") && mode.kind === "challenge") {
      replaceAll(mode.challenge.solution);
      touched = false;
      lastSolved = true;
      toast("Here's one way to do it. Change it and see what happens.", "eye");
    } else if (t.closest("[data-pg-next]") && mode.kind === "challenge") {
      const i = CHALLENGES.indexOf(mode.challenge);
      const next = CHALLENGES.slice(i + 1).find((c) => !solved.has(c.id)) ?? CHALLENGES.find((c) => !solved.has(c.id)) ?? CHALLENGES[(i + 1) % CHALLENGES.length]!;
      openKey(`ch:${next.id}`);
    }
  });

  // ── The editor ──

  let timer: ReturnType<typeof setTimeout> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const extensions = haloEditor(
    [
      { key: "Mod-s", preventDefault: true, run: () => (share(), true) },
      { key: "Mod-Enter", preventDefault: true, run: () => (showTab("plan"), true) },
    ],
    () => {
      touched = true;
      clearTimeout(timer);
      timer = setTimeout(update, 140);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => store.set(draftKey(), source() === original ? null : source()), 400);
    },
  );
  const view = new EditorView({ state: EditorState.create({ doc: "", extensions }), parent: editorHost });
  const source = () => view.state.doc.toString();

  /** Replace a range as an edit, so ⌘Z undoes it. */
  function edit(start: number, end: number, text: string, select?: [number, number]) {
    view.dispatch({
      changes: { from: start, to: end, insert: text },
      selection: select ? EditorSelection.range(select[0], select[1]) : undefined,
      scrollIntoView: true,
      userEvent: "input",
    });
    view.focus();
  }
  const replaceAll = (text: string) => edit(0, view.state.doc.length, text, [0, 0]);

  const goToLine = (line: number, column = 1) => {
    const doc = view.state.doc;
    const l = doc.line(Math.min(Math.max(1, line), doc.lines));
    const pos = Math.min(l.to, l.from + Math.max(0, column - 1));
    view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "center" }) });
    view.focus();
    flashLine(view, l.number);
  };

  // The shortcuts panel.
  const keysBtn = $("[data-pg-keys]");
  const keysPanel = $("[data-pg-keys-panel]");
  $("[data-pg-keys-list]").innerHTML = SHORTCUTS.map(([k, what]) => `<div><dt>${k.split(" ").map((x) => (x === "/" ? " / " : `<kbd>${escapeHtml(x)}</kbd>`)).join("")}</dt><dd>${escapeHtml(what)}</dd></div>`).join("");
  const toggleKeys = (show = keysPanel.hidden) => {
    keysPanel.hidden = !show;
    keysBtn.setAttribute("aria-expanded", String(show));
    if (!show) view.focus();
  };
  keysBtn.addEventListener("click", () => toggleKeys());
  $("[data-pg-keys-close]").addEventListener("click", () => toggleKeys(false));
  keysPanel.addEventListener("keydown", (ev) => ev.key === "Escape" && toggleKeys(false));

  // ── Tabs, problems, and the cheat sheet ──

  function showTab(name: string) {
    for (const t of $$("[data-tab]")) t.setAttribute("aria-selected", String(t.dataset.tab === name));
    for (const p of $$("[data-pane]")) p.hidden = p.dataset.pane !== name;
  }
  for (const tab of $$<HTMLButtonElement>("[data-tab]")) tab.addEventListener("click", () => showTab(tab.dataset.tab!));

  $("[data-pg-problems]").addEventListener("click", (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLElement>("[data-line]");
    if (li?.dataset.line) goToLine(Number(li.dataset.line), Number(li.dataset.col || 1));
  });

  $("[data-pg-cheats]").innerHTML = SNIPPETS.map(
    (s) => `<button type="button" class="cheat" data-snippet="${s.id}"><span class="cheat-head">${icon(s.icon)}<code>${escapeHtml(s.title)}</code></span><span class="cheat-note">${inlineCode(s.note)}</span><pre>${highlight(s.code.trimEnd())}</pre></button>`,
  ).join("");
  root.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-snippet]");
    if (!b) return;
    const snip = SNIPPETS.find((s) => s.id === b.dataset.snippet);
    if (snip) insertBelow(snip.code);
  });

  /** Add code on the line after the cursor's (or at the end, with a blank line before a declaration). */
  function insertBelow(code: string) {
    const v = source();
    const head = view.state.selection.main.head;
    const at = view.hasFocus || head > 0 ? view.state.doc.lineAt(head).to : v.length;
    const atEnd = at >= v.length;
    const lead = !v.length ? "" : atEnd ? (v.endsWith("\n") ? "" : "\n") + (/^\S/.test(code) && !v.endsWith("\n\n") ? "\n" : "") : "\n";
    const text = lead + (atEnd ? code : code.replace(/\n$/, ""));
    edit(at, at, text, [at + lead.length, at + text.length]);
  }

  // ── Checking, as you type ──

  /** Problems as the editor's diagnostics: underlined where the validator can say what, with a gutter marker either way. */
  function renderLines(problems: Diagnostic[]) {
    const doc = view.state.doc;
    const marks: CmDiagnostic[] = problems.filter((d) => d.line).map((d) => ({ ...rangeOf(doc, d), severity: d.severity, message: d.message }));
    view.dispatch(setDiagnostics(view.state, marks));
  }

  function update() {
    const text = source();
    const ast = parse(text);
    const problems: Diagnostic[] = ast.errors.length
      ? ast.errors.map((message) => {
          const m = message.match(/^\[(\d+):(\d+)\] (.*)$/s);
          return m ? { severity: "error" as const, message: m[3]!, line: Number(m[1]), column: Number(m[2]) + 1 } : { severity: "error" as const, message };
        })
      : validate(ast, { toolProviders: [...providerInfo.keys()] });
    const errors = problems.filter((d) => d.severity === "error").length;
    const warnings = problems.length - errors;
    renderLines(problems);

    const edited = text !== original;
    resetBtn.hidden = !edited;
    status.className = `pg-status ${errors ? "bad" : warnings ? "warn" : "ok"}`;
    status.textContent = errors ? `✗ ${errors} error${errors > 1 ? "s" : ""}` : warnings ? `✓ valid · ${warnings} warning${warnings > 1 ? "s" : ""}` : "✓ valid";
    status.title = errors ? "Open the problems tab, or click a red line number" : "Halo's validator found nothing wrong";
    const count = $("[data-pg-count]");
    count.textContent = problems.length ? `(${problems.length})` : "";
    count.className = `badge${errors ? " bad" : ""}`;
    $("[data-pg-problems]").innerHTML = problems.length
      ? `<li class="head">${errors ? `${errors} thing${errors > 1 ? "s" : ""} to fix${warnings ? `, and ${warnings} to look at` : ""}. Click one to jump to its line.` : `It runs. ${warnings} suggestion${warnings > 1 ? "s" : ""}, if you like:`}</li>` +
        problems.map((d) => `<li class="${d.severity}" data-line="${d.line ?? ""}" data-col="${d.column ?? ""}"><span class="icon">${d.severity === "error" ? "✗" : "!"}</span><span class="where">${d.line ? `line ${d.line}` : ""}</span>${inlineCode(d.message)}</li>`).join("")
      : `<li class="none">${icon("confetti")} No problems. Nice and tidy.</li>`;

    // The plan for the chosen pipeline, and a plan for every pipeline for the challenge checks.
    const names = ast.pipelines.map((p) => p.name);
    const current = names.includes(pipelinePick.value) ? pipelinePick.value : names.at(-1);
    pipelinePick.innerHTML = names.map((n) => `<option${n === current ? " selected" : ""}>${escapeHtml(n)}</option>`).join("");
    pipelinePick.hidden = names.length < 2;

    const plans = new Map<string, Plan>();
    let planError = "";
    if (!ast.errors.length)
      for (const name of names) {
        try {
          plans.set(name, plan(ast, name, { providerInfo: (p) => providerInfo.get(p) }));
        } catch (err) {
          if (name === current) planError = err instanceof Error ? err.message : String(err);
        }
      }

    const planEl = $("[data-pg-plan]");
    if (!text.trim()) planEl.innerHTML = `<p class="empty">An empty page, full of possibility. <button type="button" class="pg-link" data-snippet="agent">${icon("robot")} Add an agent</button> or press ${icon("dice-5")} Surprise me for an example.</p>`;
    else if (ast.errors.length) planEl.innerHTML = `<p class="empty">Almost: fix the ${errors > 1 ? `${errors} syntax errors` : "syntax error"} and the plan comes back. The red line number shows where.</p>`;
    else if (!current) planEl.innerHTML = `<p class="empty">No pipeline yet, so nothing to plan. <button type="button" class="pg-link" data-snippet="pipeline">${icon("route")} Add a pipeline</button></p>`;
    else if (planError || !plans.get(current)) planEl.innerHTML = `<p class="empty">${escapeHtml(planError || "This pipeline can't be planned yet.")}</p>`;
    else planEl.innerHTML = renderPlan(plans.get(current)!);
    $("[data-pg-ast]").textContent = JSON.stringify(ast, (k, v) => (k === "loc" ? undefined : v), 2);

    // A cheer when the person's own edit fixes the last error.
    if (touched && lastErrors && !errors) {
      toast(pickOne(CHEERS), "sparkles");
      sparkle(status);
    }
    lastErrors = errors;

    if (mode.kind === "challenge") checkChallenge(mode.challenge, { source: text, ast, problems, plans: [...plans.values()] });
  }

  function checkChallenge(c: Challenge, input: Parameters<Challenge["check"]>[0]) {
    const ok = c.check(input);
    const check = $("[data-pg-check]");
    const next = $("[data-pg-next]");
    if (check) {
      check.className = `pg-check${ok ? " ok" : ""}`;
      check.innerHTML = ok ? `${icon("circle-check")} ${solved.has(c.id) ? "Solved" : "That works"}` : `${icon("circle-dashed")} Not yet`;
    }
    // Hidden by visibility, so the strip keeps its height and the editor doesn't jump.
    if (next) next.style.visibility = ok ? "visible" : "hidden";
    if (ok && !lastSolved && touched) {
      const first = !solved.has(c.id);
      solved.add(c.id);
      store.set("solved", [...solved].join(","));
      renderPicker();
      pick.value = pickValue();
      for (const d of $$("[data-ch]")) d.classList.toggle("done", solved.has(d.dataset.ch!));
      if (check) check.innerHTML = `${icon("circle-check")} Solved`;
      confetti();
      if (solved.size === CHALLENGES.length && first) toast(`All ${CHALLENGES.length} solved. You're a Halo wizard.`, "wand");
      else toast("Challenge solved!", "trophy");
    }
    lastSolved = ok;
  }

  // ── Sharing ──

  async function share() {
    let url = `${location.origin}${urlFor()}`;
    const text = source();
    if (text !== original || mode.kind === "scratch") url = `${location.origin}${location.pathname}#code=${await encode(text)}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {}
    history.replaceState(null, "", url.slice(location.origin.length));
    toast(copied ? "Link copied. Anyone who opens it sees exactly this." : "The link to this is in your address bar.", "link");
  }

  // ── Small joys ──

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function toast(text: string, ic?: IconName) {
    const t = $("[data-pg-toast]");
    t.innerHTML = `${ic ? `${icon(ic)} ` : ""}${escapeHtml(text)}`;
    t.hidden = false;
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  const COLORS = ["#ffcb6b", "#c3e88d", "#82aaff", "#f78c6c", "#c792ea", "#89ddff"];
  function burst(x: number, y: number, count: number, spread: number) {
    if (reducedMotion) return;
    const box = pg.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "pg-confetti";
      const angle = Math.random() * Math.PI * 2;
      const dist = spread * (0.4 + Math.random() * 0.6);
      p.style.left = `${x - box.left}px`;
      p.style.top = `${y - box.top}px`;
      p.style.background = pickOne(COLORS);
      p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(angle) * dist - spread * 0.3}px`);
      p.style.setProperty("--rot", `${Math.round(Math.random() * 720 - 360)}deg`);
      p.style.animationDelay = `${Math.random() * 80}ms`;
      pg.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }
  }
  const sparkle = (el: Element) => {
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 14, 60);
  };
  const confetti = () => {
    const r = pg.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height * 0.4, 70, Math.min(r.width, 700) / 2);
  };

  // ── Start ──

  if (start.code !== undefined) {
    open({ kind: "scratch", shared: true }, { text: start.code });
    toast("Opened a shared snippet. Play away, it's your copy.", "sparkles");
  } else if (start.challenge && CHALLENGES.some((c) => c.id === start.challenge)) openKey(`ch:${start.challenge}`);
  else {
    const e = (start.example && findExample(start.example)) || findExample("01-hello") || data.examples[0]!;
    open({ kind: "example", example: e });
  }
}

/** Where a problem sits: its token on or after its line when it names one, else from its column to the end of the line. */
function rangeOf(doc: Text, d: Diagnostic): { from: number; to: number } {
  const line = doc.line(Math.min(Math.max(1, d.line!), doc.lines));
  if (d.token) {
    const tail = doc.sliceString(line.from + Math.max(0, (d.column ?? 1) - 1));
    const at = tail.search(new RegExp(`\\b${d.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
    if (at >= 0 && line.from + (d.column ?? 1) - 1 + at < doc.length) {
      const from = line.from + Math.max(0, (d.column ?? 1) - 1) + at;
      return { from, to: from + d.token.length };
    }
  }
  const from = Math.min(line.to, line.from + Math.max(0, (d.column ?? 1) - 1));
  const to = from < line.to ? line.to : from;
  return { from: from === to && from > line.from ? line.from : from, to };
}

/** Backticked words in a message as code. */
const inlineCode = (text: string) => escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");

/** Source for a #code= link: deflated and base64url-encoded where the browser can, plain base64url where it can't. */
async function encode(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  try {
    const packed = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    return `z${b64(packed)}`;
  } catch {
    return `b${b64(bytes)}`;
  }
}

/** The other way: the text a #code= link holds, or undefined when it's not one we made. */
export async function decodeShared(code: string): Promise<string | undefined> {
  try {
    const raw = atob(code.slice(1).replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    if (code[0] === "b") return new TextDecoder().decode(bytes);
    if (code[0] === "z") return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  } catch {}
  return undefined;
}

function renderPlan(p: Plan): string {
  const steps = p.steps
    .map((s) => {
      const meta = [s.model, s.times, s.maxCost !== undefined ? `≤ $${s.maxCost.toFixed(4)}` : ""].filter(Boolean).join(" · ");
      const eff = s.effects.length
        ? `<div class="eff">${s.effects.map((e) => `<span class="${e.effect}${e.approval ? " approve" : ""}" title="${e.effect}${e.approval ? `, needs approval (${e.approval})` : ""}">${e.via ? "" : "→ "}${escapeHtml(e.target)}${e.approval ? " (approval)" : ""}</span>`).join("")}</div>`
        : "";
      const notes = s.notes.length ? `<div class="meta">${s.notes.map(escapeHtml).join(" · ")}</div>` : "";
      return `<li class="${s.kind}"><span class="kind" title="${s.kind}">${STEP_ICON[s.kind] ? icon(STEP_ICON[s.kind]!) : "•"}</span><div class="lbl">${escapeHtml(s.label)}</div>${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}${notes}${eff}</li>`;
    })
    .join("");
  const all = p.steps.flatMap((s) => s.effects);
  const uniq = (xs: string[]) => [...new Set(xs)];
  const external = uniq(all.filter((e) => e.effect === "external" && !e.approval).map((e) => e.target));
  const approve = uniq(all.filter((e) => e.approval).map((e) => e.target));
  const humans = p.steps.filter((s) => s.kind === "human").length;
  const cost = p.maxCost !== undefined ? `$${p.maxCost.toFixed(4)}` : "unbounded";
  const capped = p.cappedAt !== undefined && (p.maxCost === undefined || p.cappedAt < p.maxCost) ? `, MaxSpend stops it at $${p.cappedAt.toFixed(2)}` : "";
  return `<ol class="flow">${steps || `<li><span class="empty">This pipeline has no stages to plan.</span></li>`}</ol>
    <dl class="summary">
      <div><dt>acts on the world without asking</dt><dd>${external.length ? escapeHtml(external.join(", ")) : "nothing"}</dd></div>
      <div><dt>waits for a person</dt><dd>${[...approve.map(escapeHtml), humans ? `${humans} pause${humans > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ") || "never"}</dd></div>
      <div><dt>worst-case model cost</dt><dd>${cost}${capped}${p.costNote ? ` (${escapeHtml(p.costNote)})` : ""}</dd></div>
    </dl>`;
}
