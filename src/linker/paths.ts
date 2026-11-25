/**
 * POSIX path helpers for the linker. No node:path: the linker also runs in the registry
 * Worker and the browser playground. Backslashes are read as slashes.
 */

export function normalizePath(path: string): string {
  const p = path.replace(/\\/g, "/");
  const absolute = p.startsWith("/");
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (out.length && out.at(-1) !== "..") out.pop();
      else if (!absolute) out.push("..");
    } else out.push(seg);
  }
  const joined = out.join("/");
  return absolute ? `/${joined}` : joined || ".";
}

export function dirnameOf(path: string): string {
  const p = normalizePath(path);
  const i = p.lastIndexOf("/");
  if (i < 0) return ".";
  return i === 0 ? "/" : p.slice(0, i);
}

export function joinPath(base: string, rel: string): string {
  if (rel.startsWith("/")) return normalizePath(rel);
  return normalizePath(base === "." ? rel : `${base}/${rel}`);
}

/** `to` relative to the folder `from` (both normalized the same way). */
export function relativePath(from: string, to: string): string {
  const a = normalizePath(from).split("/").filter((s) => s && s !== ".");
  const b = normalizePath(to).split("/").filter((s) => s && s !== ".");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/") || ".";
}

/** Whether `path` is `dir` or inside it. */
export function isInside(dir: string, path: string): boolean {
  const rel = relativePath(dir, path);
  return rel === "." || (!rel.startsWith("../") && rel !== "..");
}
