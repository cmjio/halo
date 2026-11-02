/**
 * Quoting {{placeholders}} in Bash commands.
 *
 * A value has to be escaped for the spot it lands in: wrapping it in single
 * quotes is right for a bare word, but inside "..." or '...' or a heredoc it
 * would end the surrounding quotes and let `$(...)` in the value run. So the
 * command is scanned first, and each placeholder is escaped for where it sits.
 *
 * Some spots can't hold arbitrary text safely at all. Bash evaluates
 * arithmetic (`$((...))`, `[[ x -eq y ]]`, array subscripts, `let`) as code
 * even when quoted, so a value there must be a plain number or name. Inside
 * backticks the quoting rules change again, so placeholders there are refused.
 */

import { HaloError } from "./errors.js";

export type ShellSpot =
  | { kind: "word" | "single" | "double" | "ansi" | "escaped" | "backtick" | "comment" | "arith" }
  | { kind: "heredoc"; delimiter: string; expands: boolean };

interface Heredoc {
  delimiter: string;
  expands: boolean;
  stripTabs: boolean;
}

/**
 * Open constructs, innermost last: quotes, `$(`/`(` command groups, `((`/`$[`
 * arithmetic, `p` plain parens inside arithmetic, `${` expansions and `[[` tests.
 */
interface Frame {
  k: "'" | '"' | "$'" | "`" | "(" | "((" | "$[" | "p" | "${" | "[[";
  start: number;
  /** Placeholders directly inside a `[[ ]]`, upgraded to arithmetic once its operators are known. */
  spots?: number[];
}

const PLACEHOLDER = /\{\{\s*[\w.]+\s*\}\}/y;
const PLACEHOLDERS = /\{\{\s*[\w.]+\s*\}\}/g;
const QUOTING = new Set<Frame["k"]>(["'", '"', "$'", "`", "(", "((", "$["]);
const ARITH_TEST = /(?:^|\s)-(?:eq|ne|lt|le|gt|ge|v)\s/;
const ARITH_COMMAND = /^\s*(?:let\b|(?:declare|typeset|local)\s+(?:-\w+\s+)*-\w*i)/;

/** Where each {{placeholder}} in a command sits, by its offset in the command. */
export function placeholderSpots(cmd: string): Map<number, ShellSpot> {
  const spots = new Map<number, ShellSpot>();
  const open: Frame[] = [];
  const pending: Heredoc[] = [];
  let doc: Heredoc | undefined;
  let lineStart = false;

  /** The innermost construct that decides how quotes and escapes read. */
  const quoting = () => {
    for (let j = open.length - 1; j >= 0; j--) if (QUOTING.has(open[j]!.k)) return open[j]!.k;
    return undefined;
  };
  const push = (k: Frame["k"], start: number) => open.push(k === "[[" ? { k, start, spots: [] } : { k, start });

  /** Is the spot evaluated as arithmetic, before any `$(` resets the context? */
  const arithmetic = (at: number) => {
    for (let j = open.length - 1; j >= 0; j--) {
      const f = open[j]!;
      if (f.k === "(" || f.k === "`") break;
      if (f.k === "((" || f.k === "$[") return true;
      if (f.k === "${") {
        // ${a[i]} subscripts and ${s:offset:length} are arithmetic; ${v:-word} and the like are not.
        const rest = cmd.slice(f.start + 2, at).replace(/^[!#]?(?:\w+|[@*#?$!-])/, "");
        if (rest.startsWith("[") && !rest.includes("]")) return true;
        const after = rest.replace(/^\[[^\]]*\]/, "");
        if (after.startsWith(":") && !/^:[-=+?]/.test(after)) return true;
      }
    }
    const before = cmd.slice(0, at);
    const command = before.slice(Math.max(...[";", "&", "|", "\n", "(", "`"].map((s) => before.lastIndexOf(s))) + 1);
    return ARITH_COMMAND.test(command);
  };

  const classify = (at: number, escaping: boolean): ShellSpot => {
    const q = quoting();
    if (escaping) return { kind: "escaped" };
    if (open.some((f) => f.k === "`")) return { kind: "backtick" };
    if (q === "'") return { kind: "single" };
    if (q === "$'") return { kind: "ansi" };
    if (arithmetic(at)) return { kind: "arith" };
    if (q === '"') return { kind: "double" };
    if (doc && open.every((f) => f.k === "${")) return { kind: "heredoc", delimiter: doc.delimiter, expands: doc.expands };
    return { kind: "word" };
  };

  /** Commands (and so `((`, `[[` and comments) start after these. */
  const commandStart = (i: number) => {
    const before = cmd.slice(0, i);
    return /(?:^|[;&|\n(]|(?:^|[\s;&|(])(?:if|then|elif|else|while|until|do|!))[ \t]*$/.test(before);
  };

  for (let i = 0; i < cmd.length; i++) {
    // A heredoc ends at a line that is just its delimiter.
    if (doc && lineStart && open.length === 0) {
      const end = cmd.indexOf("\n", i);
      const line = cmd.slice(i, end < 0 ? cmd.length : end);
      if ((doc.stripTabs ? line.replace(/^\t+/, "") : line) === doc.delimiter) {
        doc = pending.shift();
        if (end < 0) break;
        i = end;
        continue;
      }
    }
    lineStart = false;

    const c = cmd[i]!;
    const next = cmd[i + 1];
    const top = open.at(-1);
    const q = quoting();
    const body = doc !== undefined && open.length === 0;
    // A backslash would escape the value's first character (its opening quote, or the escape before a $).
    const escaping = c === "\\" && q !== "'" && !(body && !doc!.expands);
    const at = escaping ? i + 1 : i;
    PLACEHOLDER.lastIndex = at;
    const m = PLACEHOLDER.exec(cmd);
    if (m) {
      spots.set(at, classify(at, escaping));
      const test = open.findLast((f) => f.k === "[[");
      if (test && open.indexOf(test) >= open.findLastIndex((f) => f.k === "(" || f.k === "`")) test.spots!.push(at);
      i = at + m[0].length - 1;
      continue;
    }

    if (body) {
      // Heredoc body: plain text, except that an unquoted delimiter lets $(...), ${...}, `...` and \ work.
      if (!doc!.expands) {
        if (c === "\n") lineStart = true;
      } else if (c === "\\") i++;
      else if (c === "$" && next === "(") cmd[i + 2] === "(" ? (push("((", i), (i += 2)) : (push("(", i), i++);
      else if (c === "$" && next === "{") (push("${", i), i++);
      else if (c === "$" && next === "[") (push("$[", i), i++);
      else if (c === "`") push("`", i);
      else if (c === "\n") lineStart = true;
      continue;
    }
    if (q === "'") {
      if (c === "'") open.pop();
      continue;
    }
    if (q === "$'") {
      if (c === "\\") i++;
      else if (c === "'") open.pop();
      continue;
    }
    if (c === "\\") {
      i++;
    } else if (c === "`") {
      top?.k === "`" ? open.pop() : push("`", i);
    } else if (c === "$" && next === "(") {
      if (cmd[i + 2] === "(") (push("((", i), (i += 2));
      else (push("(", i), i++);
    } else if (c === "$" && next === "{") {
      push("${", i);
      i++;
    } else if (c === "$" && next === "[") {
      push("$[", i);
      i++;
    } else if (c === "$" && next === "'" && q !== '"') {
      push("$'", i);
      i++;
    } else if (c === '"') {
      top?.k === '"' ? open.pop() : push('"', i);
    } else if (q === '"') {
      // Inside "...", a ${...} reads ' as a plain character; only the closing } matters.
      if (c === "}" && top?.k === "${") open.pop();
    } else if (c === "'") {
      push("'", i);
    } else if (c === "}" && top?.k === "${") {
      open.pop();
    } else if (q === "((" || q === "$[") {
      if (c === "(") push("p", i);
      else if (c === ")" && top?.k === "p") open.pop();
      else if (c === ")" && next === ")" && top?.k === "((") (open.pop(), i++);
      else if (c === "]" && top?.k === "$[") open.pop();
    } else if (c === "(" && next === "(" && commandStart(i)) {
      push("((", i);
      i++;
    } else if (c === "[" && next === "[" && commandStart(i)) {
      push("[[", i);
      i++;
    } else if (c === "]" && next === "]" && top?.k === "[[") {
      settleTest(cmd, open.pop()!, i, spots);
      i++;
    } else if (c === "(" && top?.k === "(") {
      push("(", i);
    } else if (c === ")" && top?.k === "(") {
      open.pop();
    } else if (c === "#" && (i === 0 || /[\s;&|()]/.test(cmd[i - 1]!))) {
      // A comment runs to the end of the line, and a newline in a value would end it.
      const end = cmd.indexOf("\n", i);
      const stop = end < 0 ? cmd.length : end;
      for (const p of cmd.slice(i, stop).matchAll(PLACEHOLDERS)) spots.set(i + p.index, { kind: "comment" });
      i = stop - 1;
    } else if (c === "<" && next === "<" && cmd[i + 2] === "<") {
      // <<< is a here-string: an ordinary word follows.
      i += 2;
    } else if (c === "<" && next === "<") {
      const h = heredocWord(cmd, i + 2);
      if (h) {
        pending.push(h.doc);
        i = h.end - 1;
      }
    } else if (c === "\n" && !open.length && pending.length) {
      doc = pending.shift();
      lineStart = true;
    }
  }
  return spots;
}

/** Once a `[[ ]]` closes, placeholders in its arithmetic clauses (-eq, -lt, -v, ...) become arithmetic. */
function settleTest(cmd: string, test: Frame, end: number, spots: Map<number, ShellSpot>) {
  const text = cmd.slice(test.start + 2, end);
  const clauses = [...text.matchAll(/[^&|()!]+/g)].map((m) => ({ from: test.start + 2 + m.index, to: test.start + 2 + m.index + m[0].length, arith: ARITH_TEST.test(` ${m[0]} `) }));
  for (const at of test.spots!) {
    const spot = spots.get(at);
    if (spot?.kind === "escaped" || spot?.kind === "backtick") continue;
    if (clauses.some((c) => c.arith && at >= c.from && at < c.to)) spots.set(at, { kind: "arith" });
  }
}

/** Read a heredoc's delimiter word after `<<`: quoted in any part, it turns expansion off. */
function heredocWord(cmd: string, from: number): { doc: Heredoc; end: number } | undefined {
  let i = from;
  const stripTabs = cmd[i] === "-";
  if (stripTabs) i++;
  while (cmd[i] === " " || cmd[i] === "\t") i++;
  let delimiter = "";
  let quoted = false;
  for (; i < cmd.length && !/[\s;&|<>()]/.test(cmd[i]!); i++) {
    const c = cmd[i]!;
    if (c === "'" || c === '"') {
      const close = cmd.indexOf(c, i + 1);
      if (close < 0) return undefined;
      delimiter += cmd.slice(i + 1, close);
      quoted = true;
      i = close;
    } else if (c === "\\") {
      delimiter += cmd[++i] ?? "";
      quoted = true;
    } else {
      delimiter += c;
    }
  }
  if (!delimiter) return undefined;
  return { doc: { delimiter, expands: !quoted, stripTabs }, end: i };
}

/** Quote a value as a single bash word. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

const refuse = (why: string) => new HaloError(`A {{placeholder}} ${why}`, { code: "TOOL_ARGUMENT" });

/** Escape a value for the spot it fills, so the shell reads it as data. */
export function quoteFor(spot: ShellSpot | undefined, value: string): string {
  switch (spot?.kind ?? "word") {
    case "escaped":
      throw refuse("right after a backslash can't be quoted safely; remove the backslash");
    case "backtick":
      throw refuse("inside `backticks` can't be quoted safely; use $(...) instead");
    case "arith":
      // Bash runs $(...) inside array subscripts when it evaluates arithmetic, quoted or not.
      if (!/^[+-]?(?:\d+|[A-Za-z_]\w*)$/.test(value)) throw refuse(`in arithmetic ($((...)), [[ -eq ]], let, array subscripts) must be a whole number or a name, not ${JSON.stringify(value.slice(0, 40))}`);
      return value;
    case "comment":
      if (/[\r\n]/.test(value)) throw refuse("in a # comment can't hold a line break");
      return value;
    case "single":
      return value.replaceAll("'", `'\\''`);
    case "ansi":
      return value.replace(/[\\']/g, "\\$&");
    case "double":
      return value.replace(/[\\$`"]/g, "\\$&");
    case "heredoc": {
      const { delimiter, expands } = spot as Extract<ShellSpot, { kind: "heredoc" }>;
      if (value.split("\n").some((line) => line.replace(/^\t+/, "") === delimiter)) {
        throw new HaloError(`A value in a heredoc contains its end marker "${delimiter}" on a line of its own`, { code: "TOOL_ARGUMENT" });
      }
      return expands ? value.replace(/[\\$`]/g, "\\$&") : value;
    }
    default:
      return shellQuote(value);
  }
}
