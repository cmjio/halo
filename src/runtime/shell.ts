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

export type ShellSpot = (
  | { kind: "word" | "single" | "double" | "ansi" | "escaped" | "backtick" | "comment" | "arith" }
  | { kind: "heredoc"; delimiter: string; expands: boolean }
) &
  SpotCheck;

/** What the command does with a placeholder's value after the outer bash has read it (see reparseChecks). */
export interface SpotCheck {
  /** The placeholder as written, e.g. "{{v}}", for messages. */
  name?: string;
  /** Set when a second shell parses the value (bash -c, eval, ssh): why, and what to do instead. */
  reparse?: string;
  /** Set when the value starts an argument word with no `--` before it, so a leading "-" would read as an option. */
  option?: string;
}

interface Heredoc {
  delimiter: string;
  expands: boolean;
  stripTabs: boolean;
  /** How many constructs were open at the `<<`: a heredoc inside $(...) has its body at that depth. */
  depth?: number;
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
    if (doc && open.length >= doc.depth! && open.slice(doc.depth).every((f) => f.k === "${")) return { kind: "heredoc", delimiter: doc.delimiter, expands: doc.expands };
    return { kind: "word" };
  };

  /** Commands (and so `((`, `[[` and comments) start after these. */
  const commandStart = (i: number) => {
    const before = cmd.slice(0, i);
    return /(?:^|[;&|\n(]|(?:^|[\s;&|(])(?:if|then|elif|else|while|until|do|!))[ \t]*$/.test(before);
  };

  for (let i = 0; i < cmd.length; i++) {
    // A heredoc ends at a line that is just its delimiter.
    if (doc && lineStart && open.length === doc.depth) {
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
    // A heredoc's body starts on the line after its `<<`, at the depth the `<<` was at (top level, or inside $(...)).
    const body = doc !== undefined && open.length === doc.depth;
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
        pending.push({ ...h.doc, depth: open.length });
        i = h.end - 1;
      }
    } else if (c === "\n" && pending.length && open.length === pending[0]!.depth) {
      doc = pending.shift();
      lineStart = true;
    }
  }
  for (const [at, check] of reparseChecks(cmd).spots) {
    const spot = spots.get(at);
    if (spot) spots.set(at, { ...spot, ...check });
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
  // Escaping is for the outer bash only: a shell that reads the text again would run what's in it.
  if (spot?.reparse) throw new HaloError(spot.reparse, { code: "TOOL_ARGUMENT" });
  if (spot?.option && value.startsWith("-")) throw new HaloError(`${spot.name} is ${JSON.stringify(value.slice(0, 40))}, which ${spot.option}`, { code: "TOOL_ARGUMENT" });
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

// ── What happens to a value after the outer bash reads it ──
//
// quoteFor makes the outer bash read a value as one piece of data. Some commands
// then parse that data again as shell code (bash -c '...', eval, ssh's remote
// command, a script fed to bash on stdin), and no quoting survives that. Others
// read a word that starts with "-" as an option (git log '--output=f'). This pass
// splits the command into simple commands and words, to find both.

interface Word {
  start: number;
  end: number;
}

interface SimpleCommand {
  words: Word[];
  /** Here-strings (<<< word) and heredoc bodies: what the command reads on stdin. */
  stdin: Word[];
}

/** Shells whose -c argument is code. */
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "mksh", "ash", "fish", "su"]);
/** Commands that run the command after them: ssh, eval or a shell is still the command there. */
const WRAPPERS = new Set(["sudo", "doas", "env", "exec", "command", "builtin", "nohup", "time", "nice", "timeout", "xargs", "sshpass", "stdbuf", "setsid"]);
/** Reserved words and others after which the next word is still the command name. */
const PREFIXES = new Set(["if", "then", "elif", "else", "do", "while", "until", "!", "{", "fi", "done", "}", "esac"]);
/** Commands whose arguments aren't options, or whose options do no harm. */
const NO_OPTIONS = new Set(["echo", "for", "case", "select", "in", "[[", "((", "[", "test", ":", "true", "false", "function"]);
/** ssh options that take a value. */
const SSH_ARG = new Set("BbcDEeFIiJLlmOoPpQRSWw");
const ASSIGNMENT = /^([A-Za-z_]\w*)(?:\[[^\]]*\])?\+?=/;
const REDIRECT = /\d*(<<<|<<-|<<|&>>|&>|>>|<>|>\||<&|>&|<\(|>\(|<|>)/y;

/** Split a command into simple commands and their words, including those inside $(...), `...` and (...). */
function simpleCommands(cmd: string): SimpleCommand[] {
  const out: SimpleCommand[] = [];
  const pending: Array<{ doc: Heredoc; owner: SimpleCommand }> = [];
  let i = 0;
  let backticks = 0;

  const placeholder = () => {
    PLACEHOLDER.lastIndex = i;
    const m = PLACEHOLDER.exec(cmd);
    if (m) i += m[0].length;
    return !!m;
  };
  /** At a newline with heredocs waiting: their bodies come next, a line at a time, up to each end marker. */
  const bodies = () => {
    let p = i + 1;
    while (pending.length && p <= cmd.length) {
      const { doc, owner } = pending.shift()!;
      const from = p;
      for (;;) {
        const e = cmd.indexOf("\n", p);
        const end = e < 0 ? cmd.length : e;
        const line = cmd.slice(p, end);
        if ((doc.stripTabs ? line.replace(/^\t+/, "") : line) === doc.delimiter || end === cmd.length) {
          owner.stdin.push({ start: from, end: (doc.stripTabs ? line.replace(/^\t+/, "") : line) === doc.delimiter ? p : end });
          p = end + 1;
          break;
        }
        p = end + 1;
      }
    }
    pending.length = 0;
    i = p;
  };
  const skipParens = () => {
    // At "((": arithmetic, read to its matching "))".
    let depth = 0;
    for (; i < cmd.length; i++) {
      if (cmd[i] === "(") depth++;
      else if (cmd[i] === ")" && --depth === 0) return void i++;
    }
  };
  const single = () => {
    const e = cmd.indexOf("'", i + 1);
    i = e < 0 ? cmd.length : e + 1;
  };
  const dollar = () => {
    // At $ or `.
    if (cmd[i] === "`") {
      i++;
      backticks++;
      list("`");
      backticks--;
      return;
    }
    const n = cmd[i + 1];
    if (n === "(" && cmd[i + 2] === "(") (i++, skipParens());
    else if (n === "(") ((i += 2), list(")"));
    else if (n === "{") {
      i += 2;
      while (i < cmd.length && cmd[i] !== "}") {
        if (placeholder()) continue;
        const c = cmd[i];
        if (c === "\\") i += 2;
        else if (c === "'") single();
        else if (c === '"') ((i += 1), double());
        else if (c === "$" || c === "`") dollar();
        else i++;
      }
      i++;
    } else if (n === "[") {
      const e = cmd.indexOf("]", i);
      i = e < 0 ? cmd.length : e + 1;
    } else i++;
  };
  const double = () => {
    // After an opening ".
    while (i < cmd.length && cmd[i] !== '"') {
      if (placeholder()) continue;
      const c = cmd[i];
      if (c === "\\") i += 2;
      else if (c === "$" || (c === "`" && !backticks)) dollar();
      else if (c === "`") return;
      else i++;
    }
    i++;
  };
  const word = () => {
    while (i < cmd.length) {
      if (placeholder()) continue;
      const c = cmd[i]!;
      if (/[\s;&|<>()]/.test(c) || (c === "`" && backticks)) return;
      if (c === "\\") i += 2;
      else if (c === "'") single();
      else if (c === "$" && cmd[i + 1] === "'") {
        i += 2;
        while (i < cmd.length && cmd[i] !== "'") i += cmd[i] === "\\" ? 2 : 1;
        i++;
      } else if (c === '"') ((i += 1), double());
      else if (c === "$" || c === "`") dollar();
      else i++;
    }
  };
  const list = (close?: string) => {
    let cur: SimpleCommand = { words: [], stdin: [] };
    out.push(cur);
    const next = () => {
      if (cur.words.length || cur.stdin.length) out.push((cur = { words: [], stdin: [] }));
    };
    let target: "file" | "stdin" | undefined;
    while (i < cmd.length) {
      const c = cmd[i]!;
      if (close && c === close) return void i++;
      if (c === " " || c === "\t" || c === "\r") i++;
      else if (c === "\\" && cmd[i + 1] === "\n") i += 2;
      else if (c === "\n") {
        next();
        if (pending.length) bodies();
        else i++;
      } else if (c === ";" || c === "|" || (c === "&" && cmd[i + 1] !== ">") || c === ")") {
        next();
        i++;
      } else if (c === "(" && cmd[i + 1] === "(") skipParens();
      else if (c === "(") {
        i++;
        next();
        list(")");
        next();
      } else if (c === "#") {
        const e = cmd.indexOf("\n", i);
        i = e < 0 ? cmd.length : e;
      } else {
        REDIRECT.lastIndex = i;
        const r = REDIRECT.exec(cmd);
        if (r && (r[1] === "<(" || r[1] === ">(")) {
          const start = i;
          i += r[0].length;
          list(")");
          cur.words.push({ start, end: i });
        } else if (r && (r[1] === "<<" || r[1] === "<<-")) {
          const h = heredocWord(cmd, i + r[0].length - (r[1] === "<<-" ? 1 : 0));
          if (h) pending.push({ doc: h.doc, owner: cur });
          i = h ? h.end : i + r[0].length;
        } else if (r) {
          i += r[0].length;
          target = r[1] === "<<<" ? "stdin" : "file";
        } else {
          const start = i;
          word();
          if (i === start) i++;
          const w = { start, end: i };
          if (target === "stdin") cur.stdin.push(w);
          else if (!target) cur.words.push(w);
          target = undefined;
        }
      }
    }
  };
  list();
  return out.filter((c) => c.words.length || c.stdin.length);
}

/** A word's text with its quotes taken off, or undefined if it expands anything (a variable, $(...), a placeholder). */
function literal(cmd: string, w: Word | undefined): string | undefined {
  if (!w) return undefined;
  const text = cmd.slice(w.start, w.end);
  if (/[$`]|\{\{/.test(text)) return undefined;
  return text.replace(/\\(.)|['"]/g, "$1");
}

/** Variables a piece of shell text expands outside '...', where the expansion would then be parsed again. */
function expandedNames(text: string): string[] {
  const names: string[] = [];
  let dq = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") i++;
    else if (c === "'" && !dq) {
      const e = text.indexOf("'", i + 1);
      i = e < 0 ? text.length : e;
    } else if (c === '"') dq = !dq;
    else if (c === "$") {
      const m = /^\$\{?([A-Za-z_]\w*)/.exec(text.slice(i));
      if (m) names.push(m[1]!);
    }
  }
  return names;
}

/**
 * For each placeholder: is its value parsed again by a second shell (refused
 * whatever it holds), or does it start an argument where a leading "-" would be
 * read as an option (refused when the value starts with "-")? Also says which
 * commands run code (eval, bash -c), for `halo validate`.
 */
export function reparseChecks(cmd: string): { spots: Map<number, SpotCheck>; runsCode: string[] } {
  const spots = new Map<number, SpotCheck>();
  const runsCode = new Set<string>();
  const commands = simpleCommands(cmd);
  const placeholders = (from: number, to: number) => [...cmd.slice(from, to).matchAll(PLACEHOLDERS)].map((m) => ({ at: from + m.index, name: m[0] }));
  const base = (w: Word | undefined) => literal(cmd, w)?.replace(/^.*\//, "");

  // Variables set from a placeholder (msg={{v}}), and from those (b=$msg): their values are the placeholder's.
  const taint = new Map<string, Set<number>>();
  const assigned: Array<{ name: string; text: string; at: number[] }> = [];
  for (const c of commands) {
    for (const w of c.words) {
      const text = cmd.slice(w.start, w.end);
      const m = ASSIGNMENT.exec(text);
      if (m) assigned.push({ name: m[1]!, text, at: placeholders(w.start, w.end).map((p) => p.at) });
    }
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const a of assigned) {
      const from = new Set(a.at);
      for (const n of expandedNames(a.text.slice(a.name.length))) for (const at of taint.get(n) ?? []) from.add(at);
      const had = taint.get(a.name) ?? new Set<number>();
      if ([...from].some((at) => !had.has(at))) {
        taint.set(a.name, new Set([...had, ...from]));
        changed = true;
      }
    }
  }
  const nameAt = (at: number) => cmd.slice(at).match(PLACEHOLDER.source)![0];

  /** Refuse every placeholder in these words, and every one that reaches them through a variable. */
  const refuse = (words: Word[], why: (name: string) => string, via: (name: string, variable: string) => string) => {
    for (const w of words) {
      for (const p of placeholders(w.start, w.end)) spots.set(p.at, { name: p.name, reparse: why(p.name) });
      for (const v of expandedNames(cmd.slice(w.start, w.end))) {
        for (const at of taint.get(v) ?? []) if (!spots.get(at)?.reparse) spots.set(at, { name: nameAt(at), reparse: via(nameAt(at), v) });
      }
    }
  };

  for (const c of commands) {
    const { words } = c;
    let n = 0;
    while (n < words.length && (PREFIXES.has(literal(cmd, words[n]) ?? "") || ASSIGNMENT.test(cmd.slice(words[n]!.start, words[n]!.end)))) n++;
    if (n >= words.length && !c.stdin.length) continue;
    const name = base(words[n]);
    /** Is word j the command, or the command a wrapper (sudo, env, xargs ...) runs? */
    const runs = (j: number) => j === n || WRAPPERS.has(name ?? "");
    let positional = Infinity;

    for (let j = n; j < words.length; j++) {
      const word = base(words[j]);
      if (word === "eval" && (j === n || name === "builtin" || name === "command")) {
        runsCode.add("eval");
        refuse(
          words.slice(j + 1),
          (p) => `${p} is an argument of eval, which runs it as shell code, so it can't be escaped; use the value in the command itself instead of through eval`,
          (p, v) => `${p} is stored in $${v}, and eval runs $${v} as shell code, so it can't be escaped; use the value in the command itself instead of through eval`,
        );
        break;
      }
      if (word === "ssh" && runs(j)) {
        let k = j + 1;
        for (; k < words.length; k++) {
          const opt = literal(cmd, words[k]);
          if (!opt?.startsWith("-") || opt === "-") break;
          if (opt === "--") {
            k++;
            break;
          }
          const letters = [...opt.slice(1)];
          const takes = letters.findIndex((l) => SSH_ARG.has(l));
          if (takes === letters.length - 1) k++;
        }
        const remote = words.slice(k + 1);
        if (remote.length) runsCode.add("ssh");
        refuse(
          remote,
          (p) => `${p} is in the command ssh runs on the remote host, which a second shell reads there, so it can't be escaped; send the value on stdin instead, e.g. printf '%s' ${p} | ssh host 'cat > file'`,
          (p, v) => `${p} is stored in $${v}, which is in the command ssh runs on the remote host, where a second shell reads it, so it can't be escaped; send the value on stdin instead`,
        );
        if (!remote.length) {
          refuse(
            c.stdin,
            (p) => `${p} is in the script ssh sends to the remote host's shell on stdin, so it can't be escaped; pass the value as data instead`,
            (p, v) => `${p} is stored in $${v}, which is in the script ssh sends to the remote host's shell on stdin, so it can't be escaped; pass the value as data instead`,
          );
        }
        positional = k + 1;
        break;
      }
      if (word && SHELLS.has(word)) {
        let k = j + 1;
        let code: Word | undefined;
        let stdin = false;
        for (; k < words.length; k++) {
          const opt = literal(cmd, words[k]);
          if (word === "su") {
            if (opt === "-c" || opt === "--command" || opt === "--session-command") code = words[k + 1];
            else if (opt?.startsWith("--command=")) code = words[k];
            if (code) break;
            continue;
          }
          if (opt === undefined || !/^[-+]/.test(opt) || opt === "-" || opt === "--") break;
          if (/^[-+][oO]$/.test(opt)) k++;
          else if (opt === "--command" || /^-[A-Za-z]*c[A-Za-z]*$/.test(opt)) {
            code = words[k + 1];
            break;
          } else if (/^-[A-Za-z]*s[A-Za-z]*$/.test(opt)) stdin = true;
        }
        if (code) {
          runsCode.add(`${word} -c`);
          const fix = word === "su" || word === "fish" ? "restructure the command so the value isn't in that string" : `pass it as an argument instead: ${word} -c '... "$1"' _ {{value}}`;
          refuse(
            [code],
            (p) => `${p} is inside a string that a second shell runs (${word} -c), so it can't be escaped; ${fix.replace("{{value}}", p)}`,
            (p, v) => `${p} is stored in $${v}, which is inside a string that a second shell runs (${word} -c), so it can't be escaped; ${fix.replace("{{value}}", p)}`,
          );
          // After the code string come $0, $1, ...: not options.
          positional = words.indexOf(code) + 1;
          break;
        }
        if (runs(j) && (stdin || k >= words.length)) {
          runsCode.add(word);
          const fix = (p: string) => `pass it as an argument instead: ${word} -s -- ${p} <<'EOF' ... "$1"`;
          refuse(
            c.stdin,
            (p) => `${p} is in a script that a second shell reads on stdin (${word} <<EOF), so it can't be escaped; ${fix(p)}`,
            (p, v) => `${p} is stored in $${v}, which is in a script that a second shell reads on stdin (${word} <<EOF), so it can't be escaped; ${fix(p)}`,
          );
          positional = k;
        }
        break;
      }
    }

    // A value at the start of an argument word reads as an option if it starts with "-", unless `--` came first.
    if (NO_OPTIONS.has(name ?? "") || (name === undefined && words[n] && /^\[\[|^\(\(/.test(cmd.slice(words[n]!.start)))) continue;
    for (let k = n + 1; k < words.length && k < positional; k++) {
      const w = words[k]!;
      if (literal(cmd, w) === "--") break;
      if (name === "printf" && k > n + 1) break;
      const first = placeholders(w.start, w.end)[0];
      if (!first || !/^(?:["']|\$')*$/.test(cmd.slice(w.start, first.at)) || spots.has(first.at)) continue;
      const before = cmd.slice(words[n]!.start, w.start).replace(/\s+/g, " ").trim();
      spots.set(first.at, { name: first.name, option: `${name ?? "the command"} would read as an option; put -- before it to end the options (${before} -- ${first.name}), or join it to the option it is the value of (--option=${first.name})` });
    }
  }
  return { spots, runsCode: [...runsCode] };
}
