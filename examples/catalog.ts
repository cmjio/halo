/**
 * The examples, section by section, in reading order. The folder layout is defined here
 * and nowhere else: the tests, the docs site, and the playground all read it.
 *
 * learn/ is a path to read in order, so its files are numbered (01-hello.halo). Every
 * other folder is a domain, and its files are named for what they do. File names are
 * unique across folders, so `software-team.halo` names one example wherever it lives,
 * and its docs page is /examples/software-team.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { IconName } from "../site/src/icons.ts";

export interface Section {
  /** Folder under examples/. */
  folder: string;
  title: string;
  /** A Tabler icon (site/src/icons.ts). */
  icon: IconName;
  /** One line on what the section is for. */
  blurb: string;
}

export const SECTIONS: Section[] = [
  { folder: "learn", title: "Learn", icon: "seedling", blurb: "Start here. One idea per file, in order: agents, pipes, policies, tools, gates, stores, directives." },
  { folder: "patterns", title: "Patterns", icon: "puzzle", blurb: "Features in context: people in the loop, schemas, memory, model routing, thread state, built-in tools, remote sandboxes." },
  { folder: "engineering", title: "Engineering", icon: "tool", blurb: "Code review, CI, incidents, migrations, and agents that write code until the tests pass." },
  { folder: "product", title: "Product & design", icon: "compass", blurb: "A day's work for a founder, a PM, a designer, and a researcher." },
  { folder: "security", title: "Security & IT", icon: "lock", blurb: "Alert triage, phishing, access requests, leaked secrets, and dependency watch." },
  { folder: "data-research", title: "Data & research", icon: "microscope", blurb: "Text to SQL, anomaly explainers, research assistants, and an analyst swarm." },
  { folder: "support", title: "Customer support", icon: "message-circle", blurb: "Refunds, rebooking, billing disputes, ticket routing, and moderation." },
  { folder: "sales-marketing", title: "Sales & marketing", icon: "trending-up", blurb: "Outbound email, CRM hygiene, lead scoring, ads budgets, and content briefs." },
  { folder: "finance", title: "Finance & insurance", icon: "coin", blurb: "Invoices, reconciliation, KYC, claims, fraud review, and a SQLite ledger." },
  { folder: "legal-hr", title: "Legal, HR & compliance", icon: "scale", blurb: "Contract review, screening, onboarding, privacy requests, and regulatory change." },
  { folder: "healthcare", title: "Healthcare", icon: "stethoscope", blurb: "Intake, scribing, prior authorization, coding, and an FDA recall monitor." },
  { folder: "operations", title: "Operations", icon: "truck", blurb: "Freight, warehouses, field service, maintenance, energy, and travel." },
  { folder: "personal", title: "Personal & everyday", icon: "home", blurb: "Email, calendars, tutoring, shopping, sport, and dinner." },
];

const root = import.meta.dir;

/** Every example file, as a path from examples/, in reading order. */
export function exampleFiles(): string[] {
  return SECTIONS.flatMap((s) =>
    readdirSync(join(root, s.folder))
      .filter((f) => f.endsWith(".halo"))
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
