/**
 * Internal names. The linker gives every declaration from a file other than the entry file
 * a qualified name, `<unit>#<Name>`, so private names from different files and packages
 * never collide in one runtime:
 *
 *   @acme/support-kit#Triager          a declaration in one of a package's exported files
 *   @acme/support-kit/lib/internal#X   a declaration in a package's private file
 *   lib/shared#Careful                 a declaration in another file of the project
 *   @acme/zendesk#Zendesk              a tool provider from a package (qualifiedProvider)
 *
 * The entry file's own declarations keep their names. People never see qualified names:
 * `ParseResult.names` maps each one to its display name, and these helpers translate.
 * Pure: used by the runtime, the CLI, the LSP and the registry Worker.
 */

/** Qualified names always hold a `#`; names written in source never do. */
export const isQualified = (name: string): boolean => name.includes("#");

/** The name after the `#` (or the name itself). */
export const bareName = (name: string): string => name.slice(name.lastIndexOf("#") + 1);

const patterns = new WeakMap<Record<string, string>, RegExp | null>();

function patternFor(names: Record<string, string>): RegExp | null {
  let re = patterns.get(names);
  if (re !== undefined) return re;
  const keys = Object.keys(names).filter((k) => names[k] !== k).sort((a, b) => b.length - a.length);
  re = keys.length ? new RegExp(`(?:${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})(?!\\w)`, "g") : null;
  patterns.set(names, re);
  return re;
}

/** Replace every qualified name in `text` with its display name. */
export function displayText(names: Record<string, string> | undefined, text: string): string {
  if (!names || !text.includes("#")) return text;
  const re = patternFor(names);
  return re ? text.replace(re, (q) => names[q] ?? q) : text;
}

/** The display name of one name (unchanged when it isn't qualified). */
export function displayName(names: Record<string, string> | undefined, name: string): string {
  return names?.[name] ?? name;
}
