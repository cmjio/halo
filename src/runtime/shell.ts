/**
 * Quoting {{placeholders}} in Bash commands.
 *
 * A value has to be escaped for the spot it lands in: wrapping it in single
 * quotes is right for a bare word, but inside "..." or '...' or a heredoc it
 * would end the surrounding quotes and let `$(...)` in the value run. So the
 * command is scanned first, and each placeholder is escaped for where it sits.
 */

import { HaloError } from "./errors.js";

export type ShellSpot =
  | { kind: "word" | "single" | "double" | "escaped" }
  | { kind: "heredoc"; delimiter: string; expands: boolean };

interface Heredoc {
  delimiter: string;
  expands: boolean;
  stripTabs: boolean;
}

const PLACEHOLDER = /\{\{\s*[\w.]+\s*\}\}/y;
const HEREDOC = /<<(-?)[ \t]*(['"]?)(\w+)\2/y;

/** Where each {{placeholder}} in a command sits, by its offset in the command. */
export function placeholderSpots(cmd: string): Map<number, ShellSpot> {
  const spots = new Map<number, ShellSpot>();
  // Open quotes and $(...) / (...) groups, innermost last.
  const open: Array<"'" | '"' | "("> = [];
  const pending: Heredoc[] = [];
  let doc: Heredoc | undefined;
  let lineStart = false;

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

    const c = cmd[i];
    const top = open.at(-1);
    // A backslash would escape the value's first character (its opening quote, or the escape before a $).
    const escaping = c === "\\" && top !== "'" && !(doc && !top && !doc.expands);
    const at = escaping ? i + 1 : i;
    PLACEHOLDER.lastIndex = at;
    const m = PLACEHOLDER.exec(cmd);
    if (m) {
      if (escaping) spots.set(at, { kind: "escaped" });
      else if (top === "'") spots.set(at, { kind: "single" });
      else if (top === '"') spots.set(at, { kind: "double" });
      else if (!top && doc) spots.set(at, { kind: "heredoc", delimiter: doc.delimiter, expands: doc.expands });
      else spots.set(at, { kind: "word" });
      i = at + m[0].length - 1;
      continue;
    }

    if (!top && doc) {
      // Heredoc body: plain text, except that an unquoted delimiter lets $(...) and \ work.
      if (doc.expands && c === "\\") i++;
      else if (doc.expands && c === "$" && cmd[i + 1] === "(") (open.push("("), i++);
      else if (c === "\n") lineStart = true;
      continue;
    }
    if (top === "'") {
      if (c === "'") open.pop();
    } else if (c === "\\") {
      i++;
    } else if (c === "$" && cmd[i + 1] === "(") {
      open.push("(");
      i++;
    } else if (top === '"') {
      if (c === '"') open.pop();
    } else if (c === "'" || c === '"') {
      open.push(c);
    } else if (c === "(" && top === "(") {
      open.push("(");
    } else if (c === ")" && top === "(") {
      open.pop();
    } else if (c === "<" && cmd[i + 1] === "<" && cmd[i + 2] !== "<") {
      HEREDOC.lastIndex = i;
      const h = HEREDOC.exec(cmd);
      if (h) {
        pending.push({ delimiter: h[3]!, expands: !h[2], stripTabs: h[1] === "-" });
        i += h[0].length - 1;
      }
    } else if (c === "\n" && !top && pending.length) {
      doc = pending.shift();
      lineStart = true;
    }
  }
  return spots;
}

/** Quote a value as a single bash word. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Escape a value for the spot it fills, so the shell reads it as data. */
export function quoteFor(spot: ShellSpot | undefined, value: string): string {
  switch (spot?.kind ?? "word") {
    case "escaped":
      throw new HaloError(`A {{placeholder}} right after a backslash can't be quoted safely; remove the backslash`, { code: "TOOL_ARGUMENT" });
    case "single":
      return value.replaceAll("'", `'\\''`);
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
