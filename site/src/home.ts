/**
 * The home page (docs/index.md → docs/.vitepress/theme/Home.vue): its words, and the
 * functions that turn the generated data into its HTML. site/build.ts also turns the same
 * words into Markdown (homeMarkdown) for /index.md and llms.txt, so the two never drift.
 *
 * Text fields are tiny Markdown: `code`, **bold** and [links](/path) only.
 */

import { escapeHtml } from "./highlight.ts";
import type { RunSummary } from "./render.ts";

export interface HomeExample {
  /** triage.halo */
  file: string;
  /** The CLI command shown under it: plan, validate, test. */
  verb: string;
  source: string;
  /** `$ halo plan triage.halo` and what it printed. */
  output: string;
}

export interface HomeData {
  version: string;
  examples: HomeExample[];
  plan: { cmd: string; text: string };
  run: RunSummary;
}

export const HOME = {
  eyebrow: "agents · tools · policies · pipelines",
  title: "A language for AI pipelines",
  lede: "Declare agents, tools, and the policies that bound them, then chain them with pipeline operators.",
  proof: [
    { label: "policy", text: "The runtime checks every tool call an agent makes against its policies before it runs." },
    { label: "$ halo plan", text: "Shows what a run could do: every model call with its worst-case cost, every tool it could call, and what needs approval. Nothing runs." },
    { label: "$ halo replay", text: "Reruns exactly what a run did, from its recording, with no model or tool calls." },
  ],
  install: [
    { label: "macOS · Linux", prompt: "$", lines: ["curl -fsSL https://halolang.com/install.sh | sh"] },
    { label: "Windows", prompt: ">", lines: ["irm https://halolang.com/install.ps1 | iex"] },
    { label: "From source", prompt: "$", lines: ["git clone https://github.com/cmjio/halo && cd halo", "bun install && bun link"], comment: "`halo` now runs the source" },
  ],
  installNote: "One standalone binary with Bun built in, checked against the release's `SHA256SUMS`. [Read the script](/install.sh) before piping it to a shell.",
  examplesCaption: "A file, and what the CLI says about it. The outputs are the real CLI, run on these files when this site was built.",
  run: {
    kicker: "tools: [...]",
    title: "Agents choose their tools. Policy sets the fence.",
    body: "Give an agent `tools: [...]` and it calls them until it has an answer, using each provider's native tool calling. Every call is checked against the agent's policies first.",
    rules: [
      { name: "AllowTools / AllowEffects", text: "Decide what it can see at all." },
      { name: "DenyArgs", text: "Refuses calls whose arguments match a pattern." },
      { name: "ApproveTools", text: "Asks a person first: terminal, approval link, or Slack buttons. The run waits on disk until someone answers." },
      { name: "Redact / Block", text: "Tool results go through these rules before the model reads them." },
    ],
    more: { text: "Agents with tools", link: "/guide/agents-with-tools" },
    caption: "A real run of the fixer in [example 74](/examples/software-team), on a small project with two bugs, as `halo run` recorded it.",
  },
  plan: {
    kicker: "halo plan · halo replay",
    title: "Plan before. Replay after.",
    body: "`halo plan` lists every model call with its worst-case cost, every tool it could call and what that changes, and what needs approval. Nothing runs.",
    replay: "Every run keeps a recording of what it got back. `halo replay <file> <run>` feeds it back with no model or tool calls; `--live-models` or `--live-tools` redo one side.",
    more: { text: "Plan and replay", link: "/guide/plan-and-replay" },
  },
  minute: {
    kicker: "halo in 16 seconds",
    title: "Refused before it runs. Planned before it starts. Replayed for $0.",
    body: "Everything in it is real: the fixer's policy from [example 74](/examples/software-team), the runtime's own verdicts on two edits it could ask for, `halo plan` for that pipeline, and its recorded run, replayed.",
    video: "/video/halo-loop.mp4",
    poster: "/video/halo-loop.jpg",
  },
  start: {
    kicker: "halo init",
    title: "Your first pipeline, offline.",
    body: "After [installing](#install), scaffold a project and test it with every model and tool mocked. Set a provider key when you want it live. `halo upgrade` keeps the binary current.",
    commands: [
      { cmd: "halo init my-flow && cd my-flow" },
      { cmd: "halo test main.halo --arg topic=tides", comment: "offline: every model and tool mocked" },
      { cmd: "halo run main.halo --arg topic=tides", comment: "with ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY set" },
    ],
  },
  next: [
    { text: "Quickstart", link: "/guide/quickstart", about: "Install, write a pipeline, run it" },
    { text: "Language reference", link: "/guide/reference", about: "Every declaration, operator, and built-in" },
    { text: "CLI", link: "/reference/cli", about: "Every command and flag" },
    { text: "Tool providers", link: "/reference/providers", about: "Every built-in and packaged tool, with its methods and effects" },
    { text: "Policies", link: "/stdlib/policies", about: "Every rule the runtime enforces" },
    { text: "Examples", link: "/examples/", about: "Working pipelines, from hello world to a team of agents" },
    { text: "Packages", link: "/packages", about: "Install tools for Stripe, Notion, Jira, Sentry, GitHub; publish your own" },
    { text: "Serving", link: "/guide/production/serving", about: "HTTP API, webhooks, schedules, watches, Slack approvals, MCP" },
  ],
};

/** The tiny Markdown of HOME's text fields as HTML. */
export function inline(md: string): string {
  return escapeHtml(md)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

// ── Code and CLI output, one element per line so long lines wrap under their own text ──

/** A line as a block whose wrapped rows hang under its first character. */
function line(raw: string, html: string, attrs = ""): string {
  const indent = raw.match(/^ */)![0].length;
  const body = html.replace(/^((?:<span[^>]*>)*) +/, "$1");
  return `<span class="cl"${attrs} style="--ind:${indent}">${body}</span>`;
}

const HALO = /("(?:[^"\\]|\\.)*")|\b(policy|tool|agent|pipeline|equips|requires|as)\b|(\|>|->)|(\[[a-z]+\/[^\],\]]+)|\b([A-Z][A-Za-z0-9_]*)\b|(\b\d+(?:\.\d+)?\b)/g;

function haloLine(src: string): string {
  let out = "";
  let last = 0;
  for (const m of src.matchAll(HALO)) {
    out += escapeHtml(src.slice(last, m.index));
    const [tok, str, kw, op, model, ty, num] = m;
    if (str) out += `<span class="s">${escapeHtml(str).replace(/\{\{[^}]*\}\}/g, (x) => `<span class="i">${x}</span>`)}</span>`;
    else if (kw) out += `<span class="k">${kw}</span>`;
    else if (op) out += `<span class="op">${escapeHtml(op)}</span>`;
    else if (model) out += `[<span class="m">${escapeHtml(model.slice(1))}</span>`;
    else if (ty) out += `<span class="t">${ty}</span>`;
    else if (num) out += `<span class="n">${num}</span>`;
    else out += escapeHtml(tok);
    last = m.index! + tok.length;
  }
  return out + escapeHtml(src.slice(last));
}

function outLine(raw: string): string {
  if (raw.startsWith("$ ")) return `<span class="o-prompt">$</span> <span class="o-cmd">${escapeHtml(raw.slice(2))}</span>`;
  return escapeHtml(raw)
    .replace(/^(Acts on the world without asking:|Needs a person's approval:|Worst-case model cost:|Spend limit:|Plan for)/, '<span class="o-label">$1</span>')
    .replace(/(may call )([\w.]+)(: )(read|write|external)/, '<span class="o-dim">$1</span><span class="o-cmd">$2</span>$3<span class="o-$4">$4</span>')
    .replace(/(needs approval)/, '<span class="o-appr">$1</span>')
    .replace(/(≤ \$[\d.]+)/, '<span class="o-num">$1</span>')
    .replace(/^(✗)/, '<span class="o-err">$1</span>')
    .replace(/ (error) /, ' <span class="o-err">$1</span> ')
    .replace(/^(\[mock [^\]]+\])/, '<span class="o-dim">$1</span>')
    .replace(/^(\s+chooses its own calls.*)$/, '<span class="o-dim">$1</span>');
}

export const haloHtml = (src: string) => src.replace(/\n+$/, "").split("\n").map((l) => line(l, haloLine(l))).join("");
export const outputHtml = (text: string) => text.replace(/\n+$/, "").split("\n").map((l) => line(l, outLine(l))).join("");

/** `halo plan` output with each tool line tagged by its effect, for the highlight filter, and the counts. */
export function planHtml(text: string): { html: string; counts: { read: number; write: number; approval: number } } {
  const counts = { read: 0, write: 0, approval: 0 };
  const html = text
    .replace(/\n+$/, "")
    .split("\n")
    .map((raw) => {
      const effect = raw.match(/may call [\w.]+: (read|write|external)/)?.[1];
      if (!effect) return line(raw, outLine(raw));
      const tags = [effect, ...(/needs approval/.test(raw) ? ["approval"] : [])];
      for (const t of tags) if (t in counts) counts[t as keyof typeof counts]++;
      return line(raw, outLine(raw), ` data-e="${tags.join(" ")}"`);
    })
    .join("");
  return { html, counts };
}

/** The three lines at the end of a plan: what acts without asking, what needs a person, the worst case. */
export function planSummary(text: string): { acts: string; approval: string; worst: string; limit: string } {
  const field = (label: string) => text.match(new RegExp(`^${label}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";
  const [worst, limit = ""] = field("Worst-case model cost").split(/,\s*but\s*/);
  return { acts: field("Acts on the world without asking"), approval: field("Needs a person's approval"), worst: worst ?? "", limit };
}

/** The model's closing answer: plain text with its **bold** and `code` kept, and headings made bold. */
export const answerHtml = (text: string) => inline(text.replace(/^\s*-{3,}\s*$/gm, "").replace(/^#{1,6}\s+(.+)$/gm, "**$1**"));

// ── Markdown, for /index.md and llms.txt ──

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body.replace(/\n+$/, "")}\n\`\`\``;

/** The home page as Markdown. Links become absolute on origin, for agents reading it out of context. */
export function homeMarkdown(d: HomeData, origin = ""): string {
  const h = HOME;
  const run = d.run;
  const steps = run.steps.map((s) => {
    const who = s.who === "pipeline" ? "the pipeline checks for itself" : s.answer !== undefined ? "the model answers" : `the model calls ${s.calls.length} tool${s.calls.length > 1 ? "s" : ""}`;
    const calls = s.calls.map((c) => `   - \`${c.target}(${c.args})\` (${c.effect})${c.result ? `: ${c.result.split("\n").pop()}` : ""}`);
    return [`${s.n}. ${who}`, ...calls].join("\n");
  });
  return [
    `**${h.title}.** ${h.lede}`,
    h.proof.map((p) => `- **${p.label.replace(/^\$ /, "")}**: ${p.text}`).join("\n"),
    "## Install",
    h.install.map((i) => `${i.label}:\n\n${fence(i.prompt === ">" ? "powershell" : "bash", i.lines.join("\n"))}`).join("\n\n"),
    h.installNote,
    "## What it looks like",
    h.examplesCaption,
    d.examples.map((e) => `${e.file}:\n\n${fence("halo", e.source)}\n\n${fence("txt", e.output)}`).join("\n\n"),
    `## ${h.run.title}`,
    h.run.body,
    h.run.rules.map((r) => `- \`${r.name}\`: ${r.text}`).join("\n"),
    `${h.run.caption} \`$ ${run.command}\` (${run.model}):`,
    steps.join("\n"),
    `${run.seconds}s · ${run.modelCalls} model calls · ${run.toolCalls} tool calls (${run.modelToolCalls} asked for by the model, ${run.toolCalls - run.modelToolCalls} by the pipeline) · $${run.cost}. It replays in ${run.replayMs} ms, for $0. [${h.run.more.text}](${h.run.more.link})`,
    `## ${h.plan.title}`,
    h.plan.body,
    fence("txt", `$ ${d.plan.cmd}\n${d.plan.text}`),
    `${h.plan.replay} [${h.plan.more.text}](${h.plan.more.link})`,
    `## ${h.minute.title}`,
    `${h.minute.body} [Watch the video](${h.minute.video}).`,
    `## ${h.start.title}`,
    h.start.body,
    fence("bash", h.start.commands.map((c) => `${c.cmd}${c.comment ? `   # ${c.comment}` : ""}`).join("\n")),
    "## Where next",
    h.next.map((n) => `- [${n.text}](${n.link}): ${n.about}`).join("\n"),
  ]
    .join("\n\n")
    .replace(/\]\((\/|#)/g, (_, c: string) => `](${origin}${c === "#" ? "/#" : "/"}`);
}
