/** Syntax highlighting for Halo source, as HTML spans (classes are styled in styles.css). */

const KEYWORDS = new Set(["use", "with", "policy", "tool", "store", "schema", "agent", "pipeline", "equips", "requires", "system", "as", "each", "in", "else", "context", "yield", "listen", "loop"]);
const LITERALS = new Set(["true", "false", "null"]);

const TOKEN = new RegExp(
  [
    String.raw`(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)`,
    String.raw`(?<string>"""[\s\S]*?(?:"""|$)|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)`,
    String.raw`(?<op>\|<>|\|>|\|\?|\|\*|\|!|~>|=>|->|&&|\|\||[=!<>]=|&)`,
    String.raw`(?<directive>@[A-Za-z_]\w*)`,
    String.raw`(?<number>\b\d+(?:\.\d+)?(?:ms|[smhd])?\b)`,
    String.raw`(?<model>\b[a-zA-Z_][\w.]*(?:[-/][\w.]+)+)`,
    String.raw`(?<word>[A-Za-z_]\w*)`,
  ].join("|"),
  "g",
);

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Placeholders inside strings ({{name}}) get their own color. */
const withPlaceholders = (s: string) => escapeHtml(s).replace(/\{\{[^}]*\}\}/g, (m) => `<span class="t-ph">${m}</span>`);

export function highlight(source: string): string {
  let out = "";
  let last = 0;
  let prevWord = "";
  for (const m of source.matchAll(TOKEN)) {
    out += escapeHtml(source.slice(last, m.index));
    last = m.index! + m[0].length;
    const g = m.groups!;
    const text = m[0];
    if (g.comment) out += `<span class="t-comment">${escapeHtml(text)}</span>`;
    else if (g.string) out += `<span class="t-string">${withPlaceholders(text)}</span>`;
    else if (g.op) out += `<span class="t-op">${escapeHtml(text)}</span>`;
    else if (g.directive) out += `<span class="t-directive">${text}</span>`;
    else if (g.number) out += `<span class="t-number">${text}</span>`;
    else if (g.model) out += `<span class="t-model">${text}</span>`;
    else if (KEYWORDS.has(text)) out += `<span class="t-kw">${text}</span>`;
    else if (LITERALS.has(text)) out += `<span class="t-number">${text}</span>`;
    // The name being declared: `agent Fixer`, `pipeline Build`, `tool Shell`.
    else if (/^(agent|pipeline|tool|store|policy|schema)$/.test(prevWord)) out += `<span class="t-decl">${text}</span>`;
    else if (/^[A-Z]/.test(text)) out += `<span class="t-type">${text}</span>`;
    else out += text;
    if (g.word || g.model) prevWord = text;
    else if (!/^\s*$/.test(text)) prevWord = "";
  }
  return out + escapeHtml(source.slice(last));
}
