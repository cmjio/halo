/**
 * Hosted exports, the publisher's side: what `halo publish` writes for a package whose
 * halo.json has `hosted`, and what `halo serve --package` serves.
 *
 * Which files ship. A hosted package's file holds exactly the `.halo` files that its
 * `exports` reach (the exported files and the files they `use` by relative path), plus
 * everything that isn't `.halo` (README, halo.json, skills). Every other `.halo` file in the
 * folder is a *hosted source*: it stays on the publisher's machine. So:
 *
 *   - put hosted pipelines in files that `exports` doesn't list and the exported files don't `use`
 *     (for example `hosted/replies.halo`);
 *   - a hosted pipeline declared in a shipped file is refused (its source would ship);
 *   - a `.halotool` that already holds unreachable `.halo` files is refused by publish.
 *
 * For each pipeline in `hosted.exports`, publish links the file that declares it (with the
 * package's own dependencies from .halo/packages and its model slots' suggestions) and writes
 * a HostedPipelineInterface: its description (the `//` comment lines just above it), its
 * parameters and return type, and the schemas they name, flattened to field → type.
 *
 * Hosted pipelines can't pause in this version: one that can reach `|! yield`, `~> listen`,
 * or an agent whose policies ask for approval (ApproveTools, ApproveEffects) is refused, by
 * publish and by `halo serve --package`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Glob } from "bun";
import { checkLinked, type LinkedProgram } from "../linker/index.js";
import { linkFile } from "../linker/node.js";
import { dirnameOf, joinPath, normalizePath } from "../linker/paths.js";
import { parse } from "../parser/index.js";
import { SCHEMA_TYPES } from "../parser/builtins.js";
import type { CallStage, ParseResult, PipelineDeclaration } from "../parser/types.js";
import {
  checkPackageManifest,
  PACK_EXCLUDE,
  PACKAGE_FORMAT_V2,
  PROJECT_FILE,
  type HostedPipelineInterface,
  type PackageFileV2,
  type PackageManifest,
} from "./contract.js";
import { pack, PackageError, sha256, type PackageData, type Packed } from "./format.js";
import { hostOf } from "./manifest.js";

export interface HostedSources {
  /** Hosted pipeline → the file (relative to the package folder) that declares it. */
  sources: Record<string, string>;
  /** The `.halo` files that ship: those the exports reach. */
  shipped: string[];
  /** The `.halo` files that stay with the publisher. */
  excluded: string[];
}

/** The .halo files in a package folder (relative, POSIX), as pack would see them. */
function haloFiles(dir: string): string[] {
  return [...new Glob("**/*.halo").scanSync({ cwd: dir, dot: false, onlyFiles: true })]
    .map((p) => p.split("\\").join("/"))
    .filter((p) => !PACK_EXCLUDE.some((re) => re.test(p)))
    .sort();
}

/** The .halo files `exports` reach through relative `use` lines. `text` reads a file (relative path). */
export function reachableFromExports(manifest: PackageManifest, text: (path: string) => string | undefined): string[] {
  const seen: string[] = [];
  const visit = (path: string) => {
    if (seen.includes(path)) return;
    const source = text(path);
    if (source === undefined) return;
    seen.push(path);
    for (const use of parse(source).uses ?? []) {
      if (!use.source.startsWith("./") && !use.source.startsWith("../")) continue;
      const target = joinPath(dirnameOf(path), use.source);
      if (!target.startsWith("../")) visit(target);
    }
  };
  for (const e of manifest.exports ?? []) visit(normalizePath(e));
  return seen;
}

/** Where each hosted pipeline is declared, and which .halo files ship. Throws PackageError on a problem. */
export function hostedSources(dir: string, manifest: PackageManifest): HostedSources {
  const hosted = manifest.hosted;
  if (!hosted) throw new PackageError(`${manifest.name} has no "hosted" in ${PROJECT_FILE}`);
  const all = haloFiles(dir);
  const read = (p: string) => (all.includes(p) ? readFileSync(join(dir, p), "utf8") : undefined);
  const shipped = reachableFromExports(manifest, read);
  const excluded = all.filter((p) => !shipped.includes(p));
  const problems: string[] = [];
  const sources: Record<string, string> = {};
  for (const name of hosted.exports) {
    const inShipped = shipped.filter((p) => parse(read(p)!).pipelines.some((d) => d.name === name));
    if (inShipped.length) {
      problems.push(`hosted pipeline ${name} is declared in ${inShipped.join(", ")}, which ships to consumers (exports reach it). Move it to a file that "exports" doesn't list and the exported files don't use, e.g. hosted/${name.replace(/^./, (c) => c.toLowerCase())}.halo`);
      continue;
    }
    const found = excluded.filter((p) => parse(read(p)!).pipelines.some((d) => d.name === name));
    if (!found.length) problems.push(`hosted pipeline ${name} isn't declared in any .halo file in the package folder`);
    else if (found.length > 1) problems.push(`hosted pipeline ${name} is declared in more than one file (${found.join(", ")})`);
    else sources[name] = found[0]!;
  }
  if (!hosted.auth) problems.push(`hosted.auth is required: halo serve --package only answers consumers with a key, e.g. "auth": { "type": "bearer", "env": "ACME_HALO_KEY" }`);
  if (problems.length) throw new PackageError(`${manifest.name}: hosted exports:\n  - ${problems.join("\n  - ")}`);
  return { sources, shipped, excluded };
}

// ── Pauses ──

/**
 * How `pipeline` can pause, as a chain of names (`DraftReply → Review → |! yield`), or
 * undefined when it can't. Follows calls into other pipelines; an agent whose policies
 * ask for approval counts as a pause.
 */
export function pausePath(program: ParseResult, pipeline: string): string | undefined {
  const pipelines = new Map(program.pipelines.map((p) => [p.name, p]));
  const agents = new Map(program.agents.map((a) => [a.name, a]));
  const policies = new Map(program.policies.map((p) => [p.name, p]));
  const show = (n: string) => program.names?.[n] ?? n;
  const approves = (agent: string) =>
    (agents.get(agent)?.requires ?? []).find((p) => (policies.get(p)?.rules ?? []).some((r) => r.name === "ApproveTools" || r.name === "ApproveEffects"));
  const visit = (p: PipelineDeclaration, chain: string[], seen: Set<string>): string | undefined => {
    const call = (c: CallStage): string | undefined => {
      const isPipeline = !c.method || (c.implicit && !agents.has(c.callee) && pipelines.has(c.callee));
      if (isPipeline) {
        const next = pipelines.get(c.callee);
        if (!next || seen.has(next.name)) return undefined;
        seen.add(next.name);
        return visit(next, [...chain, show(next.name)], seen);
      }
      const policy = agents.has(c.callee) ? approves(c.callee) : undefined;
      return policy ? [...chain, `${show(c.callee)}.${c.method} (policy ${show(policy)} asks for approval)`].join(" → ") : undefined;
    };
    for (const s of p.pipeline) {
      let hit: string | undefined;
      if (s.kind === "interrupt") hit = [...chain, "|! yield"].join(" → ");
      else if (s.kind === "listen") hit = [...chain, `~> listen(${show(s.target)})`].join(" → ");
      else if (s.kind === "call") hit = call(s);
      else if (s.kind === "fanout") for (const c of s.stages) hit ??= call(c);
      else if (s.kind === "branch") for (const a of s.arms) hit ??= call(a.call);
      else if (s.kind === "each") hit = call(s.call);
      if (hit) return hit;
    }
    return undefined;
  };
  const root = pipelines.get(pipeline);
  return root ? visit(root, [show(pipeline)], new Set([pipeline])) : undefined;
}

// ── Interfaces ──

const BUILTIN_TYPES = new Set<string>([...SCHEMA_TYPES, "Integer", "Float", "Bool", "Date"]);

/** The `//` comment lines just above a declaration (directive lines in between are skipped). */
export function docComment(source: string, line: number): string | undefined {
  const lines = source.split("\n");
  let i = line - 2;
  while (i >= 0 && /^\s*@\w/.test(lines[i]!)) i--;
  const out: string[] = [];
  for (; i >= 0 && /^\s*\/\//.test(lines[i]!); i--) out.unshift(lines[i]!.replace(/^\s*\/\/\/?\s?/, ""));
  const text = out.join("\n").trim();
  return text || undefined;
}

/** A linked program's view of one hosted pipeline: its interface. Names are display names. */
export function interfaceOf(linked: LinkedProgram, pipeline: string, source?: string): HostedPipelineInterface {
  const program = linked.program;
  const decl = program.pipelines.find((p) => p.name === pipeline);
  if (!decl) throw new PackageError(`No pipeline ${pipeline} in ${linked.entry}`);
  const show = (t: string) => t.replace(/[@A-Za-z_][\w@./-]*#\w+|[A-Za-z_]\w*/g, (n) => program.names?.[n] ?? n);
  const schemas = new Map(program.schemas.map((s) => [s.name, s]));
  const out: Record<string, Record<string, string>> = {};
  const collect = (type: string) => {
    for (const m of type.matchAll(/[@A-Za-z_][\w@./-]*#\w+|[A-Za-z_]\w*/g)) {
      const name = m[0];
      if (BUILTIN_TYPES.has(name)) continue;
      const schema = schemas.get(name);
      const shown = show(name);
      if (!schema || out[shown]) continue;
      out[shown] = {};
      for (const f of schema.fields) out[shown][f.name] = show(f.type);
      for (const f of schema.fields) collect(f.type);
    }
  };
  for (const p of decl.params) collect(p.type);
  if (decl.returnType) collect(decl.returnType);
  const description = source && decl.loc ? docComment(source, decl.loc.line) : undefined;
  return {
    ...(description ? { description } : {}),
    params: decl.params.map((p) => ({ name: p.name, type: show(p.type || "Any") })),
    ...(decl.returnType ? { returns: show(decl.returnType) } : {}),
    ...(Object.keys(out).length ? { schemas: out } : {}),
  };
}

export interface HostedBuild {
  interfaces: Record<string, HostedPipelineInterface>;
  sources: HostedSources;
}

/**
 * Link every hosted pipeline of the package in `dir` and build its interface. Refuses link
 * errors, pauses, and hosted pipelines whose source would ship.
 */
export function buildHosted(dir: string, manifest: PackageManifest): HostedBuild {
  const sources = hostedSources(dir, manifest);
  const interfaces: Record<string, HostedPipelineInterface> = {};
  const problems: string[] = [];
  for (const [name, file] of Object.entries(sources.sources)) {
    const { linked, errors } = linkHosted(dir, manifest, file);
    if (errors.length) {
      problems.push(`${file}: ${errors.join("; ")}`);
      continue;
    }
    const pause = pausePath(linked.program, name);
    if (pause) {
      problems.push(`hosted pipeline ${name} can pause (${pause}). Hosted pipelines can't pause yet: the consumer has no way to answer`);
      continue;
    }
    interfaces[name] = interfaceOf(linked, name, readFileSync(join(dir, file), "utf8"));
  }
  if (problems.length) throw new PackageError(`${manifest.name}: hosted exports:\n  - ${problems.join("\n  - ")}`);
  return { interfaces, sources };
}

/** Link one hosted source file of a package, as the publisher's server runs it. */
export function linkHosted(dir: string, manifest: PackageManifest, file: string): { linked: LinkedProgram; errors: string[] } {
  const root = resolve(dir);
  const linked = linkFile(join(root, file), { root, projectModels: manifest.models });
  const errors = checkLinked(linked)
    .filter((d) => d.severity === "error")
    .map((d) => `${d.line ? `line ${d.line}: ` : ""}${d.message}`);
  return { linked, errors };
}

/** Read a package folder's halo.json (checked). */
export function readManifest(dir: string): PackageManifest {
  const file = join(dir, PROJECT_FILE);
  if (!existsSync(file)) throw new PackageError(`No ${PROJECT_FILE} in ${dir}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new PackageError(`${file} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return checkPackageManifest(raw);
}

/**
 * Pack a package folder. For a hosted package: leaves out the hosted sources and adds the
 * hosted pipelines' interfaces. Other packages pack exactly as `pack` does.
 */
export function packWithHosted(dir: string): Packed & { build?: HostedBuild } {
  const packed = pack(dir);
  const manifest = packed.pkg.manifest;
  if (!manifest.hosted || packed.pkg.format !== PACKAGE_FORMAT_V2) return packed;
  const build = buildHosted(dir, manifest);
  const files = Object.fromEntries(Object.entries(packed.pkg.files).filter(([p]) => !build.sources.excluded.includes(p)));
  const file: PackageFileV2 = { format: PACKAGE_FORMAT_V2, manifest, files, hosted: build.interfaces };
  const bytes = new TextEncoder().encode(JSON.stringify(file));
  return { bytes, sha256: sha256(bytes), pkg: { ...packed.pkg, files, hosted: build.interfaces }, build };
}

/** Problems with an already-packed hosted package (a .halotool given to publish). */
export function hostedPackageProblems(pkg: PackageData): string[] {
  const h = pkg.manifest.hosted;
  if (!h) return [];
  const problems: string[] = [];
  for (const name of h.exports) if (!pkg.hosted?.[name]) problems.push(`hosted: no interface for ${name}; pack it with halo pack or halo publish from the package folder`);
  const text = (p: string) => (pkg.files[p] === undefined ? undefined : Buffer.from(pkg.files[p]!, "base64").toString("utf8"));
  const shipped = reachableFromExports(pkg.manifest, text);
  for (const p of Object.keys(pkg.files).filter((f) => f.endsWith(".halo") && !shipped.includes(f))) {
    problems.push(`${p} isn't reached by exports, so it would be a hosted source; hosted sources must not be in the package`);
  }
  for (const p of shipped) {
    const ast = parse(text(p)!);
    for (const n of ast.pipelines.map((d) => d.name).filter((n) => h.exports.includes(n))) problems.push(`${p} declares hosted pipeline ${n}; its source must not be in the package`);
    // Shipped files run on the consumer's machine and keys, hosted package or not.
    for (const a of ast.agents) {
      if (a.modelId && !a.modelId.startsWith("models.")) problems.push(`${p}: agent ${a.name} hard-codes the model "${a.modelId}". It ships to consumers and runs on their keys: declare a slot in halo.json "models" and use [models.<slot>] (only hosted sources may name models)`);
    }
  }
  if (!h.auth) problems.push("hosted.auth is required");
  return problems;
}

/** Lines describing a package's hosted pipelines, for publish --dry-run and pack. */
export function describeHosted(manifest: PackageManifest, interfaces: Record<string, HostedPipelineInterface> | undefined): string[] {
  const h = manifest.hosted;
  if (!h) return [];
  const auth = h.auth ? (h.auth.type === "bearer" ? `Authorization: Bearer $${h.auth.env}` : `${h.auth.name}: $${h.auth.env}`) : "no key";
  const lines = [`hosted on ${hostOf(h.endpoint)} (${h.endpoint}; consumers send ${auth})`];
  for (const name of h.exports) {
    const i = interfaces?.[name];
    if (!i) {
      lines.push(`  ${name}: no interface`);
      continue;
    }
    lines.push(`  ${name}(${i.params.map((p) => `${p.name}: ${p.type}`).join(", ")})${i.returns ? ` -> ${i.returns}` : ""}${i.description ? `  // ${i.description.split("\n")[0]}` : ""}`);
    for (const [schema, fields] of Object.entries(i.schemas ?? {})) lines.push(`    schema ${schema} { ${Object.entries(fields).map(([f, t]) => `${f}: ${t}`).join(", ")} }`);
  }
  return lines;
}
