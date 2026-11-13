/**
 * The playground's editor: CodeMirror 6 with Halo highlighting, indentation-aware folding,
 * search, multiple cursors, completion, and problems drawn inline and in the gutter.
 */

import { autocompletion, closeBrackets, closeBracketsKeymap, completeAnyWord, completionKeymap, type CompletionSource } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  foldService,
  HighlightStyle,
  indentOnInput,
  indentService,
  indentUnit,
  StreamLanguage,
  syntaxHighlighting,
  type StringStream,
} from "@codemirror/language";
import { lintGutter, lintKeymap } from "@codemirror/lint";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  Decoration,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
  type KeyBinding,
} from "@codemirror/view";
import { Tag, tags as t } from "@lezer/highlight";

export const KEYWORDS = ["policy", "tool", "store", "schema", "agent", "pipeline", "equips", "requires", "system", "as", "each", "in", "else", "context", "yield", "listen", "loop"];
const KEYWORD_SET = new Set(KEYWORDS);
const LITERALS = new Set(["true", "false", "null"]);
const DECLARES = new Set(["agent", "pipeline", "tool", "store", "policy", "schema"]);

const model = Tag.define();
const decl = Tag.define();
const placeholder = Tag.define();

interface HaloState {
  /** Inside a string: its opening quote, so it can span lines when it's a """ block. */
  str: string | null;
  comment: boolean;
  prevWord: string;
}

/** The same token rules as highlight.ts (which the cheat sheet still uses), as a line-by-line tokenizer. */
const halo = StreamLanguage.define<HaloState>({
  name: "halo",
  startState: () => ({ str: null, comment: false, prevWord: "" }),
  copyState: (s) => ({ ...s }),
  token(stream: StringStream, s: HaloState): string | null {
    if (s.comment) {
      if (stream.skipTo("*/")) {
        stream.pos += 2;
        s.comment = false;
      } else stream.skipToEnd();
      return "comment";
    }
    if (s.str) return inString(stream, s);
    if (stream.eatSpace()) return null;
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      s.comment = true;
      return this.token!(stream, s);
    }
    const q = stream.match('"""') ? '"""' : stream.match('"') ? '"' : stream.match("'") ? "'" : null;
    if (q) {
      s.str = q;
      s.prevWord = "";
      return "string";
    }
    if (stream.match(/^(?:\|<>|\|>|\|\?|\|\*|\|!|~>|=>|->|&&|\|\||[=!<>]=|&)/)) {
      s.prevWord = "";
      return "operator";
    }
    if (stream.match(/^@[A-Za-z_]\w*/)) return "meta";
    if (stream.match(/^\d+(?:\.\d+)?(?:ms|[smhd])?\b/)) return "number";
    if (stream.match(/^[a-zA-Z_][\w.]*(?:[-/][\w.]+)+/)) {
      s.prevWord = stream.current();
      return "model";
    }
    if (stream.match(/^[A-Za-z_]\w*/)) {
      const w = stream.current();
      const prev = s.prevWord;
      s.prevWord = w;
      if (KEYWORD_SET.has(w)) return "keyword";
      if (LITERALS.has(w)) return "bool";
      if (DECLARES.has(prev)) return "decl";
      if (/^[A-Z]/.test(w)) return "typeName";
      return null;
    }
    stream.next();
    s.prevWord = "";
    return null;
  },
  tokenTable: { model, decl, placeholder },
  languageData: {
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    closeBrackets: { brackets: ["(", "[", "{", '"'] },
    indentOnInput: /^\s*[\]})]$/,
  },
});

/** The rest of a string on this line, with {{placeholders}} as their own tokens. */
function inString(stream: StringStream, s: HaloState): string {
  if (stream.match("{{")) {
    stream.skipTo("}}") ? (stream.pos += 2) : stream.skipToEnd();
    return "placeholder";
  }
  const q = s.str!;
  while (!stream.eol()) {
    if (stream.match(q)) {
      s.str = null;
      return "string";
    }
    if (stream.match("{{", false)) return "string";
    const ch = stream.next();
    if (ch === "\\" && q !== '"""') stream.next();
  }
  // A plain string ends with its line, closed or not.
  if (q !== '"""') s.str = null;
  return "string";
}

/** Colors come from the .t-* classes in the docs' CSS, so light and dark match the code blocks. */
const haloHighlight = HighlightStyle.define([
  { tag: t.keyword, class: "t-kw" },
  { tag: t.operator, class: "t-op" },
  { tag: t.string, class: "t-string" },
  { tag: t.comment, class: "t-comment" },
  { tag: [t.number, t.bool], class: "t-number" },
  { tag: t.meta, class: "t-directive" },
  { tag: t.typeName, class: "t-type" },
  { tag: model, class: "t-model" },
  { tag: decl, class: "t-decl" },
  { tag: placeholder, class: "t-ph" },
]);

const indentOf = (text: string) => text.match(/^\s*/)![0].length;
const blank = (text: string) => !text.trim();

/** A line folds when the lines after it are indented deeper: a pipeline's body, an agent's prompt, a tool's methods. */
const indentFold = foldService.of((state, from) => {
  const line = state.doc.lineAt(from);
  if (blank(line.text)) return null;
  const base = indentOf(line.text);
  let end = line;
  for (let n = line.number + 1; n <= state.doc.lines; n++) {
    const next = state.doc.line(n);
    if (blank(next.text)) continue;
    // A closing bracket at the header's indent belongs to the block (`{` … `}`).
    if (indentOf(next.text) <= base) {
      if (indentOf(next.text) === base && /^\s*[\]})]/.test(next.text)) end = next;
      break;
    }
    end = next;
  }
  return end.number > line.number ? { from: line.to, to: end.to } : null;
});

/** Keep the previous line's indent; a line ending in ":" or an open bracket opens a block. */
const haloIndent = indentService.of((cx, pos) => {
  // With Enter, the context simulates the break: the "line" at pos is the text before the cursor.
  const before = cx.lineAt(pos, -1);
  let prev = before.from < pos ? before.text.slice(0, pos - before.from) : "";
  if (blank(prev)) {
    // From the nearest line above that has something on it.
    let n = cx.state.doc.lineAt(before.from).number - 1;
    while (n > 0 && blank(cx.state.doc.line(n).text)) n--;
    if (n < 1) return 0;
    prev = cx.state.doc.line(n).text;
  }
  const code = prev.replace(/\/\/.*$/, "").trimEnd();
  const after = cx.textAfterPos(pos).trimStart();
  let indent = indentOf(prev) + (/[:([{]$/.test(code) ? cx.unit : 0);
  if (/^[\]})]/.test(after)) indent = Math.max(0, indent - cx.unit);
  return indent;
});

const completeKeywords: CompletionSource = (cx) => {
  const word = cx.matchBefore(/[A-Za-z_]\w*/);
  if (!word || (word.from === word.to && !cx.explicit)) return null;
  return { from: word.from, options: KEYWORDS.map((label) => ({ label, type: "keyword" })), validFor: /^\w*$/ };
};

/** A line that lights up for a moment, after a jump to it. */
const flashEffect = StateEffect.define<number | null>();
const flashField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects)
      if (e.is(flashEffect)) deco = e.value === null ? Decoration.none : Decoration.set([Decoration.line({ class: "cm-flash" }).range(e.value)]);
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function flashLine(view: EditorView, line: number) {
  const pos = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines)).from;
  view.dispatch({ effects: flashEffect.of(pos) });
  setTimeout(() => view.dispatch({ effects: flashEffect.of(null) }), 900);
}

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "var(--halo-code-bg)", color: "var(--vp-c-text-1)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--vp-font-family-mono)", lineHeight: "1.6" },
  ".cm-content": { padding: "12px 0", caretColor: "var(--vp-c-brand-1)" },
  ".cm-line": { padding: "0 16px 0 6px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--vp-c-brand-1)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--vp-c-brand-soft) !important" },
  ".cm-gutters": { backgroundColor: "var(--halo-code-bg)", color: "var(--vp-c-text-3)", border: "none", borderRight: "1px solid var(--vp-c-divider)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 6px 0 10px", minWidth: "32px", fontSize: "12px" },
  // A bar, not a fill: any tint behind the current line costs the token colours their 4.5:1.
  ".cm-activeLine": { backgroundColor: "transparent", boxShadow: "inset 2px 0 var(--halo-name)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--vp-c-text-1)" },
  ".cm-foldGutter .cm-gutterElement": { padding: "0 4px", cursor: "pointer", color: "var(--vp-c-text-3)" },
  ".cm-foldGutter .cm-gutterElement:hover": { color: "var(--vp-c-brand-1)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--vp-c-default-soft)", border: "1px solid var(--vp-c-divider)", color: "var(--vp-c-text-2)", borderRadius: "4px", padding: "0 6px", margin: "0 4px" },
  ".cm-matchingBracket": { backgroundColor: "var(--vp-c-default-soft)", outline: "1px solid var(--vp-c-divider)" },
  ".cm-selectionMatch": { backgroundColor: "color-mix(in srgb, var(--vp-c-brand-1) 14%, transparent)" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--halo-model) 30%, transparent)", outline: "1px solid var(--halo-model)" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "color-mix(in srgb, var(--halo-keyword) 40%, transparent)" },
  ".cm-flash": { animation: "pg-flash-line 0.9s ease-out" },
  ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy var(--halo-external)", textUnderlineOffset: "3px" },
  ".cm-lintRange-warning": { backgroundImage: "none", textDecoration: "underline wavy var(--halo-write)", textUnderlineOffset: "3px" },
  ".cm-panels": { backgroundColor: "var(--vp-c-bg)", color: "var(--vp-c-text-1)" },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--vp-c-divider)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--vp-c-divider)" },
  ".cm-panel.cm-search": { padding: "6px 10px", fontSize: "13px" },
  ".cm-panel.cm-search input, .cm-panel.cm-search button": { fontSize: "12.5px" },
  ".cm-textfield": { border: "1px solid var(--vp-c-divider)", borderRadius: "6px", backgroundColor: "var(--vp-c-bg-soft)", color: "var(--vp-c-text-1)", padding: "3px 6px" },
  ".cm-button": { backgroundImage: "none", backgroundColor: "var(--vp-c-bg-soft)", border: "1px solid var(--vp-c-divider)", borderRadius: "6px", color: "var(--vp-c-text-1)" },
  ".cm-tooltip": { backgroundColor: "var(--vp-c-bg)", border: "1px solid var(--vp-c-divider)", borderRadius: "8px", boxShadow: "var(--vp-shadow-2)", color: "var(--vp-c-text-1)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--vp-c-brand-soft)", color: "var(--vp-c-text-1)" },
  ".cm-diagnostic": { fontSize: "12.5px", padding: "4px 8px" },
  ".cm-diagnostic-error": { borderLeftColor: "var(--halo-external)" },
  ".cm-diagnostic-warning": { borderLeftColor: "var(--halo-write)" },
});

/** Everything a Halo editor needs; `keys` are the playground's own bindings, which win over the defaults. */
export function haloEditor(keys: readonly KeyBinding[], onChange: (view: EditorView) => void): Extension {
  return [
    lineNumbers(),
    foldGutter({ openText: "▾", closedText: "▸" }),
    lintGutter(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    indentUnit.of("  "),
    EditorState.tabSize.of(2),
    halo,
    haloIndent,
    indentFold,
    syntaxHighlighting(haloHighlight),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ override: [completeKeywords, completeAnyWord] }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    flashField,
    keymap.of([...keys, ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap, indentWithTab]),
    theme,
    EditorView.contentAttributes.of({ "aria-label": "Halo source", spellcheck: "false", autocapitalize: "off", autocorrect: "off" }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange(u.view);
    }),
  ];
}

const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = mac ? "⌘" : "Ctrl";
const ALT = mac ? "⌥" : "Alt";

/** The shortcuts the help panel lists. */
export const SHORTCUTS: Array<[string, string]> = [
  [`${MOD} S`, "Copy a share link"],
  [`${MOD} Enter`, "Show the plan"],
  [`${MOD} F`, "Find"],
  [`${MOD} G`, "Next match"],
  [`${MOD} D`, "Select next occurrence"],
  [`${MOD} Shift L`, "Select all occurrences"],
  [`${MOD} click / ${ALT} drag`, "Add a cursor / box select"],
  [`${MOD} /`, "Toggle line comment"],
  [`Shift ${ALT} A`, "Toggle block comment"],
  ["Tab / Shift Tab", "Indent / outdent"],
  [`${ALT} ↑ / ${ALT} ↓`, "Move line up / down"],
  [`Shift ${ALT} ↑ / ↓`, "Copy line up / down"],
  [`Shift ${MOD} K`, "Delete line"],
  [mac ? "⌘ ⌥ [ / ]" : "Ctrl Shift [ / ]", "Fold / unfold block"],
  [`Ctrl ${ALT} [ / ]`, "Fold all / unfold all"],
  [`${MOD} Shift \\`, "Jump to matching bracket"],
  [`${MOD} L`, "Select line"],
  [`${MOD} Shift M`, "Show problems inline"],
  [`F8`, "Next problem"],
  ["Ctrl Space", "Complete a word"],
  [`${MOD} Z / ${MOD} Shift Z`, "Undo / redo"],
  ["Esc", "Back to one cursor"],
];
