/**
 * llms.txt for halolang.com (https://llmstxt.org): what an LLM reads to learn Halo.
 *
 *   /llms.txt         the docs' map: the sidebar's groups, a link and a line per page
 *   /llms-full.txt    every docs page in sidebar order, as one Markdown file
 *   /<page>.md        each page as Markdown, next to its HTML (/guide/quickstart.md)
 *
 * The pages are the docs' own Markdown, cleaned of what only the browser renders: front
 * matter, Vue components (replaced with Markdown of the same data where there is some),
 * HTML tags, VitePress containers and code-block labels. site/build.ts calls buildLlms after
 * the docs are built and writes what it returns into site/dist.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const ORIGIN = "https://halolang.com";

export interface SidebarItem {
  text: string;
  link?: string;
  /** A line about the page, instead of its first paragraph. */
  about?: string;
  items?: SidebarItem[];
}

export interface LlmsInput {
  /** The repository root (docs/ is under it). */
  root: string;
  version: string;
  /** The docs sidebar: groups of pages, in order. */
  sidebar: SidebarItem[];
  /** The examples sidebar: a group per section of examples/. */
  examples: SidebarItem[];
  /** Markdown that stands in for a Vue component, by component name. Others are dropped. */
  components?: Record<string, string>;
  /** What a page's `{{ expression }}` shows, by expression (`data.counts.examples`). */
  values?: Record<string, string>;
}

/** Interactive pages, with nothing to read as text. */
const SKIP = new Set(["/playground"]);

/** The Markdown file a sidebar link is built from. */
export function sourceOf(root: string, link: string): string {
  const path = link.replace(/[#?].*$/, "").replace(/\/$/, "/index");
  return join(root, "docs", `${path}.md`);
}

/** Where a page's Markdown is served, for a sidebar link (/guide/quickstart → /guide/quickstart.md). */
export function mdPath(link: string): string {
  return `${link.replace(/[#?].*$/, "").replace(/\/$/, "/index")}.md`;
}

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#123;": "{", "&#125;": "}", "&#124;": "|", "&nbsp;": " " };
const decode = (s: string) => s.replace(/&(?:lt|gt|amp|quot|nbsp|#39|#123|#125|#124);/g, (e) => ENTITIES[e]!);

/** A link in a page, as an absolute URL: /guide/x and ./x.md (relative to the page) both work in the docs. */
function absolute(href: string, page: string): string {
  if (/^[a-z]+:|^#/i.test(href)) return href;
  if (href.startsWith("/")) return ORIGIN + href;
  const [path, hash = ""] = href.split(/(?=#)/);
  const url = new URL(path!, `${ORIGIN}${page}`);
  return `${url.origin}${url.pathname.replace(/\.md$/, "").replace(/\/index$/, "/")}${hash}`;
}

/** Prose outside code: HTML links become Markdown links, other tags go, and links become absolute. */
function prose(line: string, page: string): string {
  return decode(
    line
      .replace(/<a\s[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
      // A term then its description (<code>x</code><span>…</span>, <dt>x</dt><dd>…</dd>): "x: …".
      .replace(/(<\/(?:code|strong|b)>|<\/dt>)(<span\b[^>]*>|<dd>)/g, "$1: $2")
      // Inline elements set side by side in the HTML keep a space between them.
      .replace(/(<\/(?:b|strong|span|code)>)(<(?:b|strong|code)\b)/g, "$1 $2")
      .replace(/<\/?(?:span|p|div|code|strong|b|em|br|video|img|li|dt|dd|ClientOnly)\b[^>]*>/g, (tag) => (/^<\/?code/.test(tag) ? "`" : /^<\/?(?:strong|b)\b/.test(tag) ? "**" : /^<\/?em/.test(tag) ? "_" : "")),
  ).replace(/\]\(([^)\s]+)\)/g, (_, href: string) => `](${absolute(href, page)})`);
}

/**
 * A docs page as plain Markdown: front matter, components and HTML gone, includes inlined,
 * code-group labels turned into a line of text above each block.
 */
export function cleanPage(file: string, components: Record<string, string> = {}, values: Record<string, string> = {}): string {
  // The page's path in the site, which relative links resolve against: docs/guide/x.md → /guide/x.md.
  const page = `/${file.replace(/\\/g, "/").split("/docs/").pop()}`;
  let text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const title = front?.[1]?.match(/^title:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (front) text = text.slice(front[0].length);
  // A home-layout page's hero is in its front matter: keep its words.
  const hero = front?.[1]?.match(/^hero:\n((?:[ \t]+.*\n?)*)/m)?.[1] ?? "";
  const field = (name: string) => hero.match(new RegExp(`^\\s+${name}:\\s*(.+)$`, "m"))?.[1]?.trim().replace(/^"(.*)"$/, "$1");
  if (field("text") || field("tagline")) text = `# ${title ?? field("name") ?? ""}\n\n${[field("text") && `**${field("text")}.**`, field("tagline")].filter(Boolean).join(" ")}\n\n${text}`;
  text = text.replace(/<!--@include:\s*(.+?)\s*-->/g, (_, rel: string) => {
    const inc = resolve(dirname(file), rel);
    return existsSync(inc) ? readFileSync(inc, "utf8") : "";
  });
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  // A page's own script and style, and drawings, have nothing to read.
  text = text.replace(/^<(script|style)\b[^>]*>[\s\S]*?^<\/\1>\n?/gm, "").replace(/<svg\b[^>]*>[\s\S]*?<\/svg>[ \t]*/g, "");

  const out: string[] = [];
  let fence: string | undefined;
  for (const line of text.split("\n")) {
    const open = /^(\s*)(`{3,}|~{3,})(\S*)\s*(?:\[(.+)\])?\s*$/.exec(line);
    if (fence) {
      out.push(line);
      if (open && open[2]!.startsWith(fence) && !open[3]) fence = undefined;
      continue;
    }
    if (open) {
      fence = open[2]!;
      if (open[4]) out.push(`${open[1]}${decode(open[4])}:`, "");
      out.push(`${open[1]}${open[2]}${open[3]}`);
      continue;
    }
    // A component on its own line: its stand-in, or nothing.
    const component = /^\s*<([A-Z]\w*)[^>]*\/?>\s*$/.exec(line);
    if (component) {
      const stand = components[component[1]!];
      if (stand) out.push("", stand.trimEnd(), "");
      continue;
    }
    // A block's own tags go; the blank line keeps what was inside it a block of its own.
    if (/^\s*<\/?(?:[A-Z]\w*|div|video|section|nav|ol|ul|dl)\b[^>]*>\s*$/.test(line)) {
      out.push("");
      continue;
    }
    const prosed = () => prose(line.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (all, key: string) => values[key] ?? all), page);
    // An HTML heading, list item, or a line that is only a link: their Markdown.
    const heading = /^\s*<h([1-6])\b[^>]*>(.*)<\/h\1>\s*$/.exec(line);
    if (heading) {
      out.push("", `${"#".repeat(Number(heading[1]))} ${prose(heading[2]!, page).trim()}`, "");
      continue;
    }
    if (/^\s*(?:<li\b|<div><dt\b|<a\s[^>]*>.*<\/a>\s*$)/.test(line)) {
      out.push(`- ${prosed().trim()}`);
      continue;
    }
    // ::: tip Title  →  **Title**; a bare ::: (or ::: code-group) goes.
    const container = /^\s*:::\s*(\S+)?\s*(.*)$/.exec(line);
    if (container) {
      if (container[2]) out.push(`**${prose(container[2], page)}**`);
      continue;
    }
    out.push(prosed());
  }
  let body = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!/^#\s/m.test(body) && title) body = `# ${title}\n\n${body}`;
  return body + "\n";
}

/** A page's first paragraph of prose, as one line, for its entry in llms.txt. */
export function summary(markdown: string, max = 220): string {
  const para = markdown
    .replace(/^(\s*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2\s*$/gm, "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    // Not a heading, table, list, quote or bold line, nor a short label like "macOS · Linux:".
    .find((p) => p && !/^(#|\||>|-\s|\*\s|\d+\.\s|\*\*[^*]+\*\*$)/.test(p) && !(p.endsWith(":") && p.length < 40));
  if (!para) return "";
  return clip(para.replace(/\]\([^)]*\)/g, "]").replace(/\[([^\]]*)\]/g, "$1"), max);
}

/** One line of at most max characters, cut at the end of a sentence where there is one. */
function clip(text: string, max = 220): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const stop = cut.search(/[.!?](?=\s)[^.!?]*$/);
  return stop > 60 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

const linksOf = (items: SidebarItem[]): SidebarItem[] => items.flatMap((i) => [...(i.link ? [i] : []), ...linksOf(i.items ?? [])]);

/** llms.txt, llms-full.txt and a .md per page, by path in the site. */
export function buildLlms({ root, version, sidebar, examples, components = {}, values = {} }: LlmsInput): Record<string, string> {
  const files: Record<string, string> = {};
  const pages = new Map<string, string>();
  const page = (link: string): string | undefined => {
    if (SKIP.has(link)) return undefined;
    if (!pages.has(link)) {
      const src = sourceOf(root, link);
      if (!existsSync(src)) return undefined;
      const md = cleanPage(src, components, values);
      pages.set(link, md);
      files[mdPath(link)] = md;
    }
    return pages.get(link);
  };
  const entry = (item: SidebarItem) => {
    const md = item.link ? page(item.link) : undefined;
    if (!md || !item.link) return undefined;
    const about = item.about !== undefined ? clip(item.about) : summary(md);
    return `- [${item.text}](${ORIGIN}${mdPath(item.link)})${about ? `: ${about}` : ""}`;
  };

  const home = page("/");
  const lines = [
    "# Halo",
    "",
    "> A declarative language for AI workflows. A `.halo` file declares agents, tools, policies and schemas, then wires them into pipelines with pipe operators, with gates, branches, loops, parallel calls and human approval built in. The runtime checks every tool call an agent makes against its policies before it runs.",
    "",
    `Current version: ${version}. Install with \`curl -fsSL ${ORIGIN}/install.sh | sh\` (macOS, Linux), \`irm ${ORIGIN}/install.ps1 | iex\` (Windows), or \`npx @halolang/halo\`. \`halo test\` runs a pipeline offline with every model call mocked; \`halo plan\` shows what a run could do before it starts; \`halo replay\` reruns what it did. Halo runs on Bun and is MIT licensed. Source: https://github.com/cmjio/halo.`,
    "",
    `Every link below is a page's Markdown. ${ORIGIN}/llms-full.txt is all of them in one file.`,
    "",
  ];
  if (home) lines.push(`## Overview`, "", `- [Halo](${ORIGIN}/index.md): ${summary(home)}`, "");
  for (const group of sidebar) {
    const entries = linksOf(group.items ?? [group]).map((i) => entry(i)).filter((e): e is string => !!e);
    if (entries.length) lines.push(`## ${group.text}`, "", ...entries, "");
  }
  // The examples are many and long: the index and each section, under Optional (llms.txt's
  // section for what can be skipped when context is short).
  const optional = [entry({ text: "All examples", link: "/examples/" })];
  for (const group of examples) {
    optional.push(...linksOf(group.items ?? []).map((i) => entry({ ...i, text: `${group.text}: ${i.text}` })));
  }
  lines.push("## Optional", "", ...optional.filter((e): e is string => !!e), "");
  files["/llms.txt"] = lines.join("\n");

  // llms-full.txt: the docs (not the examples), in sidebar order.
  const order = ["/", ...linksOf(sidebar).map((i) => i.link!)].filter((l, i, all) => all.indexOf(l) === i);
  const full = order.flatMap((link) => {
    const md = page(link);
    return md ? [`<!-- ${ORIGIN}${link} -->\n\n${md}`] : [];
  });
  files["/llms-full.txt"] = `# Halo ${version}: documentation\n\n> Every page of ${ORIGIN}, in the order of its sidebar. The examples are at ${ORIGIN}/examples/index.md.\n\n${full.join("\n---\n\n")}`;
  return files;
}
