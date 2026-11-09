/**
 * A unified diff of two texts, line by line, for showing a person what changed (`halo evolve`).
 * Longest-common-subsequence based: fine for .halo files, which are hundreds of lines, not tens of thousands.
 */

type Op = { kind: " " | "-" | "+"; line: string; a: number; b: number };

/** A last line without a newline after it is marked, so it differs from the same line with one. */
const NO_EOL = "\u0000";

function toLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  else lines[lines.length - 1] += NO_EOL;
  return lines;
}

function ops(a: string[], b: string[]): Op[] {
  // Trim the common prefix and suffix first: most rewrites change a few lines in the middle.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  // lcs[i][j]: length of the LCS of a[start+i..endA) and b[start+j..endB).
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[start + i] === b[start + j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: Op[] = [];
  for (let k = 0; k < start; k++) out.push({ kind: " ", line: a[k]!, a: k, b: k });
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[start + i] === b[start + j]) {
      out.push({ kind: " ", line: a[start + i]!, a: start + i, b: start + j });
      i++;
      j++;
    } else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      // Removals before additions, as git shows them.
      out.push({ kind: "-", line: a[start + i]!, a: start + i, b: start + j });
      i++;
    } else {
      out.push({ kind: "+", line: b[start + j]!, a: start + i, b: start + j });
      j++;
    }
  }
  for (let k = 0; k < a.length - endA; k++) out.push({ kind: " ", line: a[endA + k]!, a: endA + k, b: endB + k });
  return out;
}

/** `git diff`-style output with `context` lines around each change; empty when the texts are the same. */
export function unifiedDiff(before: string, after: string, names: { a: string; b: string }, context = 3): string {
  const all = ops(toLines(before), toLines(after));
  const changed = all.map((o, k) => (o.kind === " " ? -1 : k)).filter((k) => k >= 0);
  if (!changed.length) return "";
  // Group changes whose context windows touch into hunks.
  const hunks: Array<[number, number]> = [];
  for (const k of changed) {
    const lo = Math.max(0, k - context);
    const hi = Math.min(all.length - 1, k + context);
    const prev = hunks.at(-1);
    if (prev && lo <= prev[1] + 1) prev[1] = hi;
    else hunks.push([lo, hi]);
  }
  const lines = [`--- ${names.a}`, `+++ ${names.b}`];
  for (const [lo, hi] of hunks) {
    const slice = all.slice(lo, hi + 1);
    const aLen = slice.filter((o) => o.kind !== "+").length;
    const bLen = slice.filter((o) => o.kind !== "-").length;
    const aStart = slice[0]!.a + (aLen ? 1 : 0);
    const bStart = slice[0]!.b + (bLen ? 1 : 0);
    lines.push(`@@ -${aStart},${aLen} +${bStart},${bLen} @@`);
    for (const o of slice) {
      if (o.line.endsWith(NO_EOL)) lines.push(`${o.kind}${o.line.slice(0, -1)}`, "\\ No newline at end of file");
      else lines.push(`${o.kind}${o.line}`);
    }
  }
  return lines.join("\n") + "\n";
}

/** Lines added and removed. */
export function diffStat(before: string, after: string): { added: number; removed: number } {
  const all = ops(toLines(before), toLines(after));
  return { added: all.filter((o) => o.kind === "+").length, removed: all.filter((o) => o.kind === "-").length };
}
