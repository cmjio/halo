/**
 * Linking from disk, for the CLI, `halo serve` and the LSP: files come from the file system,
 * packages from `.halo/packages` (through installedResolver), and model slots from the
 * project's halo.json `models`.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { installedResolver } from "../registry/resolver.js";
import type { ModelSlot, PackageResolver } from "../registry/contract.js";
import { link, type LinkedProgram } from "./index.js";

export interface LinkFileOptions {
  /** The project folder (halo.json, .halo/packages). Default: the nearest folder up from the file with a halo.json, else the file's folder. */
  root?: string;
  /** Unsaved text for some files (an editor's open buffers), by absolute path. */
  overrides?: Map<string, string> | Record<string, string>;
  resolver?: PackageResolver;
  projectModels?: Record<string, string | ModelSlot>;
}

/** The folder a file's project lives in: the nearest one up with a halo.json. */
export function projectRoot(file: string): string {
  let dir = dirname(resolve(file));
  for (;;) {
    if (existsSync(join(dir, "halo.json"))) return dir;
    const up = dirname(dir);
    if (up === dir) return dirname(resolve(file));
    dir = up;
  }
}

/** halo.json `models` in a folder, if any. */
export function projectModels(root: string): Record<string, string | ModelSlot> | undefined {
  const file = join(root, "halo.json");
  if (!existsSync(file)) return undefined;
  try {
    const json = JSON.parse(readFileSync(file, "utf8")) as { models?: Record<string, string | ModelSlot> };
    return json.models && typeof json.models === "object" ? json.models : undefined;
  } catch {
    return undefined;
  }
}

export function readTextFile(path: string): string | undefined {
  try {
    return statSync(path).isFile() ? readFileSync(path, "utf8") : undefined;
  } catch {
    return undefined;
  }
}

/** Link a .halo file from disk. */
export function linkFile(file: string, options: LinkFileOptions = {}): LinkedProgram {
  const path = resolve(file);
  const root = resolve(options.root ?? projectRoot(path));
  const overrides = options.overrides instanceof Map ? options.overrides : new Map(Object.entries(options.overrides ?? {}));
  return link(path, {
    readFile: (p) => overrides.get(p) ?? readTextFile(p),
    resolver: options.resolver ?? installedResolver(root),
    projectModels: options.projectModels ?? projectModels(root),
    root,
  });
}
