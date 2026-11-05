/**
 * Skills: packaged instructions an agent loads when a task calls for them.
 *
 * A skill is a folder with a SKILL.md: YAML-style frontmatter (`name`, `description`) and
 * Markdown instructions, plus any supporting files (templates, references, examples). It's
 * the same layout as Agent Skills, so skills written for other agents work here too.
 *
 *   skills/
 *     code-review/
 *       SKILL.md
 *       checklist.md
 *
 * A single `<name>.md` file with the same frontmatter is a skill too.
 *
 * Halo ships a few skills of its own (`src/skills/`, bundled into the
 * CLI so the standalone binary has them): see BUILTIN_SKILLS.
 */

import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import codeReview from "../skills/code-review/SKILL.md" with { type: "text" };
import writeTests from "../skills/write-tests/SKILL.md" with { type: "text" };
import webResearch from "../skills/web-research/SKILL.md" with { type: "text" };
import dataExtraction from "../skills/data-extraction/SKILL.md" with { type: "text" };
import releaseNotes from "../skills/release-notes/SKILL.md" with { type: "text" };
import incidentPostmortem from "../skills/incident-postmortem/SKILL.md" with { type: "text" };
import bugTriage from "../skills/bug-triage/SKILL.md" with { type: "text" };

export interface Skill {
  name: string;
  description: string;
  /** The Markdown body of SKILL.md (without the frontmatter). */
  instructions: string;
  /** "builtin", or the folder the skill was found in. */
  source: string;
  /** The skill's own folder, for reading supporting files (absent for built-ins and single-file skills). */
  dir?: string;
}

const MAX_SKILL_BYTES = 200_000;
const MAX_FILE_BYTES = 1_000_000;
const MAX_SKILLS = 500;
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/** Split `---\nkey: value\n---\nbody` into its fields and body. Values may be quoted; `>`/`|` blocks are folded. */
export function parseFrontmatter(text: string): { fields: Record<string, string>; body: string } {
  const m = text.replace(/^﻿/, "").match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!m) return { fields: {}, body: text };
  const fields: Record<string, string> = {};
  const lines = m[1]!.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i]!.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2]!.trim();
    if (value === ">" || value === "|" || value === ">-" || value === "|-" || value === "") {
      const block: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]!)) block.push(lines[++i]!.trim());
      value = block.join(value.startsWith("|") ? "\n" : " ");
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[kv[1]!.toLowerCase()] = value;
  }
  return { fields, body: m[2]!.trim() };
}

export function parseSkill(text: string, fallbackName: string, source: string, dir?: string): Skill {
  const { fields, body } = parseFrontmatter(text);
  const name = fields.name || fallbackName;
  const firstLine = body.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() ?? "";
  return { name, description: fields.description || firstLine.slice(0, 300), instructions: body, source, ...(dir ? { dir } : {}) };
}

export const BUILTIN_SKILLS: readonly Skill[] = [codeReview, writeTests, webResearch, dataExtraction, releaseNotes, incidentPostmortem, bugTriage].map((text, i) =>
  parseSkill(text as string, ["code-review", "write-tests", "web-research", "data-extraction", "release-notes", "incident-postmortem", "bug-triage"][i]!, "builtin"),
);

const dirCache = new Map<string, { mtime: number; skills: Skill[] }>();

function readSmall(path: string, max: number): string | undefined {
  try {
    const st = statSync(path);
    if (!st.isFile() || st.size > max) return undefined;
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/** Every skill in a folder: `<dir>/<name>/SKILL.md` and `<dir>/<name>.md`. Missing folders have none. */
export function loadSkillDir(dir: string): Skill[] {
  const root = resolve(dir);
  let mtime: number;
  try {
    mtime = statSync(root).mtimeMs;
  } catch {
    return [];
  }
  const cached = dirCache.get(root);
  if (cached && cached.mtime === mtime) return cached.skills;
  const skills: Skill[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (skills.length >= MAX_SKILLS || e.name.startsWith(".")) continue;
    if (e.isDirectory()) {
      const text = readSmall(join(root, e.name, "SKILL.md"), MAX_SKILL_BYTES) ?? readSmall(join(root, e.name, "skill.md"), MAX_SKILL_BYTES);
      if (text !== undefined) skills.push(parseSkill(text, e.name, root, join(root, e.name)));
    } else if (e.isFile() && e.name.endsWith(".md") && !/^readme\.md$/i.test(e.name)) {
      const text = readSmall(join(root, e.name), MAX_SKILL_BYTES);
      if (text !== undefined && /^﻿?---/.test(text)) skills.push(parseSkill(text, basename(e.name, ".md"), root));
    }
  }
  dirCache.set(root, { mtime, skills });
  return skills;
}

/** Skills from these folders (earlier folders win on a name clash), then the built-ins unless turned off. */
export function skillCatalog(dirs: string[], builtin: boolean): Skill[] {
  const byName = new Map<string, Skill>();
  for (const d of dirs) for (const s of loadSkillDir(d)) if (!byName.has(s.name.toLowerCase())) byName.set(s.name.toLowerCase(), s);
  if (builtin) for (const s of BUILTIN_SKILLS) if (!byName.has(s.name.toLowerCase())) byName.set(s.name.toLowerCase(), s);
  return [...byName.values()];
}

export function findSkill(catalog: Skill[], name: string): Skill | undefined {
  const key = name.trim().toLowerCase();
  return catalog.find((s) => s.name.toLowerCase() === key);
}

/** The files a skill folder carries besides SKILL.md (relative paths, at most 200). */
export function skillFiles(skill: Skill): string[] {
  if (!skill.dir) return [];
  const out: string[] = [];
  const walk = (d: string, depth: number) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (out.length >= 200 || e.name.startsWith(".") || e.name === "node_modules") continue;
      const full = join(d, e.name);
      if (e.isDirectory() && depth < 4) walk(full, depth + 1);
      else if (e.isFile() && !(d === skill.dir && /^skill\.md$/i.test(e.name))) out.push(relative(skill.dir!, full).split(sep).join("/"));
    }
  };
  walk(skill.dir, 0);
  return out;
}

/** Read a supporting file inside a skill's folder. Paths can't leave the folder (symlinks included). */
export function readSkillFile(skill: Skill, path: string): string {
  if (!skill.dir) throw new Error(`skill "${skill.name}" has no other files`);
  if (!path || path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.split(/[\\/]/).includes("..")) throw new Error(`"${path}" is not a path inside the skill`);
  const root = realpathSync(skill.dir);
  let full: string;
  try {
    full = realpathSync(join(root, path));
  } catch {
    throw new Error(`skill "${skill.name}" has no file "${path}"`);
  }
  if (!full.startsWith(root + sep)) throw new Error(`"${path}" is not a path inside the skill`);
  const text = readSmall(full, MAX_FILE_BYTES);
  if (text === undefined) throw new Error(`"${path}" is not a readable file under 1MB`);
  return text;
}

/** The text an agent's system prompt gets for skills it was told to use. */
export function skillPrompt(skills: Skill[]): string {
  return skills.map((s) => `<skill name="${s.name}">\n${s.instructions}\n</skill>`).join("\n\n");
}

export function validSkillName(name: string): boolean {
  return NAME.test(name);
}
