/**
 * A small, safe Markdown renderer for package READMEs.
 *
 * Safety comes first: every character of the source is HTML-escaped before any markup is
 * added, so raw HTML in a README (`<script>`, `<img onerror>`, `<iframe>`) shows as text and
 * never runs. Links are kept only for http(s), mailto, and relative/fragment URLs; images
 * render as links, so a page never loads a third-party asset.
 *
 * Supported: ATX headings, paragraphs, fenced and indented code, blockquotes, flat ordered and
 * unordered lists, horizontal rules, `code`, **strong**, *em* / _em_, ~~strike~~, [links](url),
 * ![images](url) (as links), <https://autolinks>, and simple pipe tables.
 */

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A URL that's safe in href, or undefined. Takes the raw (unescaped) URL. */
export function safeUrl(raw: string): string | undefined {
  const url = raw.trim();
  // Strip anything a browser would ignore when parsing the scheme.
  const probe = url.replace(/[\u0000- \u007f]/g, "").toLowerCase();
  if (/^(https?:|mailto:)/.test(probe)) return url;
  if (/^[a-z][a-z0-9+.-]*:/.test(probe)) return undefined; // javascript:, data:, vbscript:, …
  if (probe.startsWith("//")) return undefined;
  return url;
}

const unescapeHtml = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e]!);

function inline(src: string): string {
  const slots: string[] = [];
  const stash = (html: string) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = src.replace(/\u0000/g, "");

  // Code spans first: their contents are literal.
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _ticks: string, code: string) => stash(`<code>${escapeHtml(code.trim())}</code>`));
  s = escapeHtml(s);
  // Autolinks: &lt;https://…&gt;
  s = s.replace(/&lt;(https?:\/\/[^\s&]+(?:&amp;[^\s&]+)*)&gt;/g, (_, u: string) => {
    const url = safeUrl(unescapeHtml(u));
    return url ? stash(`<a href="${escapeHtml(url)}" rel="nofollow noopener ugc">${u}</a>`) : u;
  });
  // Images (shown as links: no third-party assets) and links.
  s = s.replace(/(!?)\[([^\]]*)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;[^)]*?&quot;)?\s*\)/g, (whole, bang: string, label: string, u: string) => {
    const url = safeUrl(unescapeHtml(u));
    const text = bang ? `${label || "image"}` : label;
    if (!url) return text;
    return stash(`<a href="${escapeHtml(url)}" rel="nofollow noopener ugc">${bang ? "[image: " : ""}${inlineEmphasis(text)}${bang ? "]" : ""}</a>`);
  });
  s = inlineEmphasis(s);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => slots[Number(i)]!).replace(/\u0000(\d+)\u0000/g, (_, i: string) => slots[Number(i)]!);
}

/** Emphasis on already-escaped text. */
function inlineEmphasis(s: string): string {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=\S)([\s\S]*?\S)__/g, "<strong>$1</strong>")
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>")
    .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, "$1<em>$2</em>");
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z#0-9]+;/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const isBlank = (l: string | undefined) => l === undefined || !l.trim();

  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlank(line)) {
      i++;
      continue;
    }
    // Fenced code
    const fence = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/.exec(line);
    if (fence) {
      const close = fence[1]!;
      const lang = fence[2] ?? "";
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trimStart().startsWith(close)) body.push(lines[i++]!);
      i++;
      out.push(`<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }
    // Indented code
    if (/^( {4}|\t)/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && (/^( {4}|\t)/.test(lines[i]!) || (isBlank(lines[i]) && /^( {4}|\t)/.test(lines[i + 1] ?? "")))) body.push(lines[i++]!.replace(/^( {4}|\t)/, ""));
      out.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }
    // Heading
    const h = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const html = inline(h[2]!);
      out.push(`<h${level} id="${escapeHtml(slug(html))}">${html}</h${level}>`);
      i++;
      continue;
    }
    // Rule
    if (/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    // Blockquote
    if (/^ {0,3}>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^ {0,3}>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^ {0,3}> ?/, ""));
      out.push(`<blockquote>${renderMarkdown(body.join("\n"))}</blockquote>`);
      continue;
    }
    // Lists (flat; continuation lines join their item)
    const item = /^ {0,3}([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(line);
    if (item) {
      const ordered = /\d/.test(item[1]!);
      const start = ordered ? parseInt(item[1]!, 10) : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(lines[i]!);
        if (m && /\d/.test(m[1]!) === ordered) {
          items.push(m[2]!);
          i++;
        } else if (!isBlank(lines[i]) && items.length && /^\s+\S/.test(lines[i]!)) {
          items[items.length - 1] += " " + lines[i++]!.trim();
        } else if (isBlank(lines[i]) && /^\s*([-*+]|\d{1,9}[.)])\s+/.test(lines[i + 1] ?? "")) {
          i++;
        } else break;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ""}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }
    // Table: a header row, a --- row, then rows
    if (line.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[i + 1] ?? "")) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i]!.includes("|")) rows.push(cells(lines[i++]!));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_, j) => `<td>${inline(r[j] ?? "")}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }
    // Paragraph
    const para: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^ {0,3}(#{1,6}\s|`{3,}|~{3,}|>|([-*+]|\d{1,9}[.)])\s)/.test(lines[i]!) &&
      !(para.length && /^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(lines[i]!))
    )
      para.push(lines[i++]!.trim());
    if (!para.length) {
      // A line no rule above claimed (e.g. "#hashtag"): show it as text.
      para.push(lines[i++]!.trim());
    }
    out.push(`<p>${inline(para.join("\n"))}</p>`);
  }
  return out.join("\n");
}
