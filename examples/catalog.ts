/**
 * The examples, section by section, in reading order. The folder layout is defined here
 * and nowhere else: the tests, the docs site, and the playground all read it.
 *
 * Files keep a global number (01–80, casebook 001–100), so `74-software-team.halo` names
 * one example wherever it lives and the docs' URLs don't change when a file moves.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

export interface Section {
  /** Folder under examples/. */
  folder: string;
  title: string;
  emoji: string;
  /** One line on what the section is for. */
  blurb: string;
}

export const SECTIONS: Section[] = [
  { folder: "learn", title: "Learn", emoji: "🌱", blurb: "One idea per file: agents, pipes, policies, tools, gates, stores, directives." },
  { folder: "roles", title: "Roles", emoji: "🧑‍💼", blurb: "A day's work for a founder, an engineer, a designer, a researcher, QA, and a PM." },
  { folder: "systems", title: "Systems", emoji: "⚙️", blurb: "Bigger shapes: moderation routing, agent swarms, model routers, people in the loop, memory." },
  { folder: "industries", title: "Industries", emoji: "🏥", blurb: "Healthcare, legal, e-commerce, fintech, real estate, insurance, recruiting." },
  { folder: "everyday", title: "Everyday", emoji: "🍳", blurb: "Hiring, homework, shopping, team reports, sport, and dinner." },
  { folder: "real-world", title: "Real world", emoji: "🚀", blurb: "Run these for real: GitHub triage, security watch, a team of agents that writes code." },
  { folder: "casebook", title: "Casebook", emoji: "📚", blurb: "100 agent designs from real work, each with what it may do freely, must confirm, or must never do." },
];

const root = import.meta.dir;

/** Every example file, as a path from examples/, in reading order. */
export function exampleFiles(): string[] {
  return SECTIONS.flatMap((s) =>
    readdirSync(join(root, s.folder))
      .filter((f) => /^\d+-.*\.halo$/.test(f))
      .sort()
      .map((f) => `${s.folder}/${f}`),
  );
}

/** An example's path from examples/, by its file name (`"06-gates.halo"` → `"learn/06-gates.halo"`). */
export function examplePath(name: string): string {
  const found = exampleFiles().find((f) => f === name || f.endsWith(`/${name}`));
  if (!found) throw new Error(`No example named ${name}`);
  return join(root, found);
}
