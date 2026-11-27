/**
 * Halo's state (.halo: recordings, paused runs, checkpoints, telemetry, the serve secret) holds
 * prompts, tool results and keys that sign approval links. On a machine with other users it must
 * be this user's alone: folders 0700, files 0600. A folder another user can't enter keeps
 * everything in it private, whatever the files' own modes; the file modes are the second wall.
 */

import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const done = new Set<string>();

/** Make a state folder (and, when it is inside a `.halo` folder, that `.halo` folder) private to this user. */
export function privateDir(dir: string): void {
  const abs = resolve(dir);
  if (done.has(abs)) return;
  try {
    mkdirSync(abs, { recursive: true, mode: 0o700 });
    chmodSync(abs, 0o700);
    // `.halo/recordings` and the like: the `.halo` above them is state too.
    for (let d = dirname(abs); d !== dirname(d); d = dirname(d)) {
      if (basename(d) === ".halo") {
        chmodSync(d, 0o700);
        break;
      }
    }
    done.add(abs);
  } catch {
    // A folder this user doesn't own (or a read-only mount) is left as it is.
  }
}

/** Make a state file readable by this user only (after it exists). */
export function privateFile(path: string): void {
  try {
    if (existsSync(path)) chmodSync(path, 0o600);
  } catch {}
}
