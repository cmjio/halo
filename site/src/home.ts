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
  title: "AI agents that do real work, inside rules you write",
  lede: "Halo is a small programming language for building AI agents: programs where a model such as Claude, GPT or Gemini decides what to do and uses tools like GitHub, Slack, your files or a browser. You write down what each agent may do, and Halo checks every action against those rules before it happens.",
  proof: [
    { label: "Rules it can't skip", text: "Every tool call is checked against the agent's rules first. A call the rules don't allow never runs, and anything you mark for approval waits for a person." },
    { label: "Cost up front", text: "`halo plan` lists everything a run could do and the most it could cost, without calling a model." },
    { label: "Free replays", text: "Every run is recorded. `halo replay` plays one back exactly, with no model calls and no cost." },
  ],
  install: [
    { label: "macOS · Linux", prompt: "$", lines: ["curl -fsSL https://halolang.com/install.sh | sh"] },
    { label: "Windows", prompt: ">", lines: ["irm https://halolang.com/install.ps1 | iex"] },
    { label: "From source", prompt: "$", lines: ["git clone https://github.com/cmjio/halo && cd halo", "bun install && bun link"], comment: "`halo` now runs the source" },
  ],
  installNote: "Installs one program, `halo`, with nothing else needed. The script checks it against the release's `SHA256SUMS`; [read the script](/install.sh) before piping it to a shell.",
  /** One sentence per example file, shown under it: what it does, for someone who can't read Halo yet. */
  examplesAbout: {
    "triage.halo": "An agent that reads a GitHub issue, labels it and drafts a reply. Posting the reply waits for a person, and the run stops at 25¢. `halo plan` shows all of that before anything runs.",
    "typo.halo": "Mistakes are caught before anything runs or costs money: here, a rule and a tool that were never defined.",
    "hello.halo": "The smallest program: one model call. `halo test` runs it with the model faked, so it needs no account and costs nothing.",
  } as Record<string, string>,
  examplesCaption: "The output is the real `halo` command, run on these files when this site was built.",
  terms: {
    kicker: "new to AI agents?",
    title: "Five words you'll see on this site",
    items: [
      { term: "Model", text: "An AI model such as Claude, GPT or Gemini. Halo calls it with your API key from Anthropic, OpenAI or Google." },
      { term: "Agent", text: "A model with a name and a job. Give it tools and it works step by step, choosing which to use, until it has an answer." },
      { term: "Tool", text: "Something an agent can use: GitHub, Slack, files, the web, a database. Each action is labelled `read`, `write` (changes something here) or `external` (acts on the outside world)." },
      { term: "Policy", text: "The rules attached to an agent: which tools it may use, what needs a person's approval, how much it may spend. Halo enforces them on every call." },
      { term: "Pipeline", text: "The program you run. Its steps are joined with `|>`, each passing its result to the next." },
    ],
  },
  can: {
    kicker: "what agents can do",
    title: "Real computers, real browsers, runs that last for days.",
    body: "Halo isn't only a chat wrapper. Agents get machines to work on, wait as long as a person needs, run on schedules, and work in teams, all under the same rules.",
    items: [
      { title: "A computer of their own", code: 'sandbox: "auto"', text: "A coding agent gets a throwaway Linux machine for each run: Docker on your computer, or an E2B or Daytona cloud sandbox. It writes, runs and fixes, it can reach only the hosts you list, and nothing reaches your folder until you've read the diff.", link: "/guide/coding-agents" },
      { title: "Runs that wait for days", code: '|! yield("Ship it?")', text: "A run that needs a person, or an event, is saved to disk and stops. It survives restarts, and picks up where it left off when someone answers in the terminal, by a link or with Slack buttons.", link: "/guide/architecture/human-in-the-loop" },
      { title: "Always on", code: "halo serve", text: "Run programs on a schedule, from webhooks or incoming email, or when a URL's contents change. One process gives you an HTTP API, approval links, an MCP server and Studio to watch runs.", link: "/guide/production/serving" },
      { title: "A real browser", code: 'Chrome(allow: ["example.com"])', text: "Agents open pages, run their JavaScript, click, type and take screenshots, only on the sites you allow.", link: "/stdlib/chrome" },
      { title: "Teams of agents", code: "|* { A(), B() }", text: "Specialists working in parallel, a lead that merges their work, or several attempts at once in separate sandboxes, keeping the best.", link: "/guide/architecture/multi-agent-swarms" },
      { title: "Go back to any step", code: "halo rewind", text: "Rewind a run to any step, sandbox files included, and try a different prompt from there. Compare two runs side by side.", link: "/guide/plan-and-replay" },
      { title: "Memory between runs", code: "@thread", text: "Keep a chat's messages, a ticket's notes or what an assistant knows about someone, from one run to the next.", link: "/guide/thread-state" },
      { title: "Any model, even local", code: "ollama/llama3.1", text: "Anthropic, OpenAI, Google, OpenRouter, Together and Replicate, or a model on your own machine with Ollama. Mix them in one program.", link: "/guide/quickstart" },
      { title: "Plug in your tools", code: "MCP(url: ...)", text: "Built-in tools for GitHub, Slack, email, SQL and files; any MCP server; packages for Stripe, Notion, Jira and Sentry; machines over SSH; or your own TypeScript.", link: "/reference/providers" },
      { title: "Images, PDFs, audio, video", code: "photo: Image", text: "Agents read pictures, documents, recordings and video: from a pipeline's input, an email's attachments or a tool's result.", link: "/guide/files" },
    ],
  },
  run: {
    kicker: "rules",
    title: "The agent decides what to do. Your rules decide what it may do.",
    body: "Give an agent a list of tools and it works on its own, calling them until it has an answer. Before any call runs, Halo checks it against the agent's policies. These are the rules you can set:",
    rules: [
      { name: "AllowTools / AllowEffects", text: "Which tools it can use at all, or which kinds: only reading, say, and nothing that acts on the outside world." },
      { name: "DenyArgs", text: "Refuses particular calls, such as a file path outside one folder." },
      { name: "ApproveTools", text: "Asks a person first, in the terminal, by a link or with Slack buttons. The run is saved and waits until someone answers." },
      { name: "Redact / Block", text: "Hides or refuses text that matches, such as API keys or personal details, before the model sees it or a tool is called." },
    ],
    more: { text: "Agents with tools", link: "/guide/agents-with-tools" },
    caption: "A real recording: an agent fixing two bugs in a small project ([example 74](/examples/software-team)). Each step shows what the model asked for and what happened.",
  },
  plan: {
    kicker: "before and after a run",
    title: "Know what a run could do and cost before it starts.",
    body: "`halo plan` reads your program and lists every model call with the most it could cost, every tool each agent could use and whether that reads or changes anything, and what will wait for a person. Nothing runs and no model is called.",
    replay: "Afterwards, every run is kept as a recording. `halo replay <file> <run>` plays it back exactly, with no model or tool calls, so you can debug a run or show it to someone for free.",
    more: { text: "Plan and replay", link: "/guide/plan-and-replay" },
  },
  minute: {
    kicker: "the trailer",
    title: "Refused before it runs. Planned before it starts. Replayed for $0.",
    body: "Halo, in 16 seconds. Every frame is the real thing: an agent's rules refusing two edits, `halo plan` pricing the run before it starts, and its recording played back for nothing.",
    video: "/video/halo-loop.mp4",
    poster: "/video/halo-loop.jpg",
  },
  start: {
    kicker: "try it",
    title: "Your first agent, with no API key.",
    body: "After [installing](#install), create a project and test it with the model and tools faked, so it needs no account and costs nothing. When you want real answers, set an API key and use `halo run`.",
    commands: [
      { cmd: "halo init my-flow && cd my-flow" },
      { cmd: "halo test main.halo --arg topic=tides", comment: "no key needed: the model is faked" },
      { cmd: "halo run main.halo --arg topic=tides", comment: "with ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY set" },
    ],
  },
  next: [
    { text: "Quickstart", link: "/guide/quickstart", about: "Install, write your first program, run it" },
    { text: "Examples", link: "/examples/", about: "Working programs, from hello world to a team of agents" },
    { text: "Playground", link: "/playground", about: "Edit a program in your browser and see what Halo says" },
    { text: "Language reference", link: "/guide/reference", about: "Every part of the language" },
    { text: "CLI", link: "/reference/cli", about: "Every `halo` command and option" },
    { text: "Tool providers", link: "/reference/providers", about: "Every built-in tool, and what each action does" },
    { text: "Policies", link: "/stdlib/policies", about: "Every rule Halo can enforce" },
    { text: "Packages", link: "/packages", about: "Tools for Stripe, Notion, Jira, Sentry, GitHub; publish your own" },
    { text: "Serving", link: "/guide/production/serving", about: "Run agents on a schedule, from webhooks, or behind an HTTP API" },
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
    `## ${h.terms.title}`,
    h.terms.items.map((t) => `- **${t.term}**: ${t.text}`).join("\n"),
    `## ${h.can.title}`,
    h.can.body,
    h.can.items.map((c) => `- **[${c.title}](${c.link})** (\`${c.code}\`): ${c.text}`).join("\n"),
    "## Install",
    h.install.map((i) => `${i.label}:\n\n${fence(i.prompt === ">" ? "powershell" : "bash", i.lines.join("\n"))}`).join("\n\n"),
    h.installNote,
    "## What it looks like",
    h.examplesCaption,
    d.examples.map((e) => `${e.file}: ${h.examplesAbout[e.file] ?? ""}\n\n${fence("halo", e.source)}\n\n${fence("txt", e.output)}`).join("\n\n"),
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
    `${h.minute.body} [Watch the trailer](${h.minute.video}).`,
    `## ${h.start.title}`,
    h.start.body,
    fence("bash", h.start.commands.map((c) => `${c.cmd}${c.comment ? `   # ${c.comment}` : ""}`).join("\n")),
    "## Where next",
    h.next.map((n) => `- [${n.text}](${n.link}): ${n.about}`).join("\n"),
  ]
    .join("\n\n")
    .replace(/\]\((\/|#)/g, (_, c: string) => `](${origin}${c === "#" ? "/#" : "/"}`);
}
