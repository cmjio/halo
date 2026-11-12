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

/**
 * A URL that's safe in href, or undefined. Takes the raw (unescaped) source text of the URL,
 * never HTML. Refuses anything with characters that could end or confuse an attribute or that
 * a browser strips or rewrites while parsing (controls, whitespace, quotes, angle brackets,
 * backticks, backslashes, the renderer's private-use sentinels), then allows only http(s),
 * mailto, and relative URLs that aren't protocol-relative.
 */
export function safeUrl(raw: string): string | undefined {
  const url = raw.trim();
  if (!url || /[\u0000- \u007f-\u009f<>"'`\\-]/.test(url)) return undefined;
  const lower = url.toLowerCase();
  if (/^(https?:\/\/[^/?#]|mailto:[^/])/.test(lower)) return url;
  if (lower.startsWith("//")) return undefined;
  // Any other scheme (javascript:, data:, vbscript:, …), or a colon before the path that a
  // browser could read as one.
  if (/^[^/?#]*:/.test(lower)) return undefined;
  return url;
}

const anchor = (url: string, innerHtml: string) => `<a href="${escapeHtml(url)}" rel="nofollow noopener ugc">${innerHtml}</a>`;

// Finished HTML (code spans, links) is held out of the text while emphasis runs, behind
// private-use sentinels removed from the source first. Attributes are only ever built by
// `anchor`, from a URL taken from the raw source and checked by `safeUrl`; held HTML is put
// back once, at the end, and never passes through a URL or attribute.
const OPEN = "";
const CLOSE = "";
const SENTINELS = /[\u0000]/g;
const MAX_LABEL = 1000;
const MAX_DEST = 2048;

interface LinkSyntax {
  label: string;
  dest: string;
  end: number;
}

/** `[label](dest "title")` or `![label](dest)` starting at `start`, from raw text; undefined if it isn't one. */
function parseLink(s: string, start: number): LinkSyntax | undefined {
  let i = s[start] === "!" ? start + 2 : start + 1;
  const labelStart = i;
  let depth = 1;
  for (; i < s.length && i - labelStart <= MAX_LABEL; i++) {
    if (s[i] === "[") depth++;
    else if (s[i] === "]" && --depth === 0) break;
  }
  if (depth !== 0 || s[i] !== "]" || s[i + 1] !== "(") return undefined;
  const label = s.slice(labelStart, i);
  i += 2;
  while (i < s.length && /[ \t\n]/.test(s[i]!)) i++;
  let dest: string;
  if (s[i] === "<") {
    const close = s.indexOf(">", i + 1);
    if (close < 0 || close - i > MAX_DEST) return undefined;
    dest = s.slice(i + 1, close);
    if (/[<\n]/.test(dest)) return undefined;
    i = close + 1;
  } else {
    const destStart = i;
    let parens = 0;
    for (; i < s.length && i - destStart <= MAX_DEST; i++) {
      const c = s[i]!;
      if (c <= " " || c === "\u007f") break;
      if (c === "(") parens++;
      else if (c === ")") {
        if (parens === 0) break;
        parens--;
      }
    }
    if (parens !== 0 || i - destStart > MAX_DEST) return undefined;
    dest = s.slice(destStart, i);
  }
  // An optional title, which isn't rendered.
  const ws = /^[ \t\n]*/.exec(s.slice(i, i + 64))![0];
  if (ws && /["'(]/.test(s[i + ws.length] ?? "")) {
    const open = s[i + ws.length]!;
    const close = s.indexOf(open === "(" ? ")" : open, i + ws.length + 1);
    if (close < 0 || close - i > MAX_DEST) return undefined;
    i = close + 1;
  }
  while (i < s.length && /[ \t\n]/.test(s[i]!)) i++;
  if (s[i] !== ")") return undefined;
  return { label, dest, end: i + 1 };
}

/**
 * Inline Markdown from raw text to HTML. A single left-to-right scan: code spans, autolinks and
 * links become finished HTML (held behind sentinels); everything else is escaped text. Emphasis
 * then runs on the escaped text, and the held HTML goes back in.
 */
function inline(src: string, links = true): string {
  const s = src.replace(SENTINELS, "");
  const held: string[] = [];
  const hold = (html: string) => `${OPEN}${held.push(html) - 1}${CLOSE}`;
  const noClose = new Set<number>(); // backtick run lengths with no closing run left
  const tick = /`+/y;
  const ticks = /`+/g;
  const autolink = /<(https?:\/\/[^\s<>]+)>/iy;
  let out = "";
  let text = "";
  const flush = () => {
    out += escapeHtml(text);
    text = "";
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === "`") {
      tick.lastIndex = i;
      const run = tick.exec(s)![0].length;
      let close = -1;
      if (!noClose.has(run)) {
        ticks.lastIndex = i + run;
        for (let m: RegExpExecArray | null; (m = ticks.exec(s)); )
          if (m[0].length === run) {
            close = m.index;
            break;
          }
        if (close < 0) noClose.add(run);
      }
      if (close >= 0 && s.slice(i + run, close).trim()) {
        flush();
        out += hold(`<code>${escapeHtml(s.slice(i + run, close).trim())}</code>`);
        i = close + run;
      } else {
        text += s.slice(i, i + run);
        i += run;
      }
      continue;
    }
    if (links && c === "<") {
      autolink.lastIndex = i;
      const m = autolink.exec(s);
      const url = m ? safeUrl(m[1]!) : undefined;
      if (m && url) {
        flush();
        out += hold(anchor(url, escapeHtml(m[1]!)));
        i += m[0].length;
        continue;
      }
    }
    if (links && (c === "[" || (c === "!" && s[i + 1] === "["))) {
      const link = parseLink(s, i);
      if (link) {
        flush();
        const image = c === "!";
        // No links inside a link's label.
        const label = inline(image ? link.label || "image" : link.label, false);
        const url = safeUrl(link.dest);
        // Images render as links: a page never loads a third-party asset.
        out += hold(url ? anchor(url, image ? `[image: ${label}]` : label) : label);
        i = link.end;
        continue;
      }
    }
    text += c;
    i++;
  }
  flush();
  return inlineEmphasis(out).replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, "g"), (_, n: string) => held[Number(n)]!);
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
