/**
 * The project's permission allow-list: `"allow"` in halo.json. Without one, `halo install`
 * shows what each package reaches and asks for --trust only for packages that run their own
 * code. With one, install fails closed: every package, direct or added by another package,
 * must stay inside it, so CI can't pick up a version that reaches somewhere new.
 *
 *   "allow": {
 *     "network": ["*.zendesk.com", "api.stripe.com"],   hosts requests may go to
 *     "env": ["ZENDESK_*", "STRIPE_KEY"],               environment variables packages may read
 *     "hosted": ["halo.acme.com"],                      hosts hosted pipelines may send your inputs to
 *     "spawn": ["npx -y @acme/mcp"],                    commands packages may start
 *     "code": true                                      packages may run their own code (still needs --trust)
 *   }
 *
 * A missing list allows nothing of that kind. In hosts, `*` stands for one DNS label
 * (`*.zendesk.com`); in env names, for any characters. A lone `"*"` allows anything. A
 * package's own wildcard (`{{subdomain}}.zendesk.com` reaches `*.zendesk.com`) is covered
 * only by a pattern at least as broad.
 *
 * Pure: no Node or Bun APIs.
 */

import type { PackagePermissions } from "./contract.js";

export interface AllowList {
  network?: string[];
  env?: string[];
  hosted?: string[];
  spawn?: string[];
  code?: boolean;
}

const LISTS = ["network", "env", "hosted", "spawn"] as const;

/** Problems with halo.json `allow`; empty when it's well-formed (or absent). */
export function allowListProblems(raw: unknown): string[] {
  if (raw === undefined) return [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [`halo.json "allow" must be an object: { "network": [...], "env": [...], "hosted": [...], "spawn": [...], "code": false }`];
  const problems: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key === "code") {
      if (typeof value !== "boolean") problems.push(`halo.json "allow.code" must be true or false`);
    } else if ((LISTS as readonly string[]).includes(key)) {
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v.trim())) problems.push(`halo.json "allow.${key}" must be a list of strings`);
    } else {
      problems.push(`halo.json "allow" has an unknown key "${key}" (it takes network, env, hosted, spawn, code)`);
    }
  }
  return problems;
}

const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

function hostCovered(host: string, patterns: string[]): boolean {
  const h = host.toLowerCase();
  return patterns.some((p) => {
    const pat = p.trim().toLowerCase();
    if (pat === "*") return true;
    // The package's `*` is a literal here: it's covered only where the pattern also has `*`.
    return new RegExp(`^${escape(pat).replace(/\*/g, "[^.]*")}$`).test(h);
  });
}

function envCovered(name: string, patterns: string[]): boolean {
  return patterns.some((p) => p === "*" || new RegExp(`^${escape(p.trim()).replace(/\*/g, ".*")}$`).test(name));
}

/** What a package's permissions need beyond the allow-list, in plain words; empty when it fits. */
export function outsideAllowList(p: PackagePermissions, allow: AllowList): string[] {
  const out: string[] = [];
  const network = p.network.filter((h) => !hostCovered(h, allow.network ?? []));
  if (network.length) out.push(`network: ${network.join(", ")}`);
  const env = p.env.filter((e) => !envCovered(e, allow.env ?? []));
  if (env.length) out.push(`env: ${env.join(", ")}`);
  const hosted = (p.hosted ?? []).filter((h) => !hostCovered(h, allow.hosted ?? []));
  if (hosted.length) out.push(`hosted (sends your inputs to): ${hosted.join(", ")}`);
  const spawn = p.spawn.filter((c) => !(allow.spawn ?? []).some((s) => s === "*" || s === c));
  if (spawn.length) out.push(`spawn: ${spawn.join("; ")}`);
  if (p.code && allow.code !== true) out.push(`code: runs its own code`);
  return out;
}

/** What `next` reaches that `before` didn't, in plain words; empty when it reaches nothing new. */
export function widened(before: PackagePermissions, next: PackagePermissions): string[] {
  const added = (a: string[] = [], b: string[] = []) => b.filter((x) => !a.includes(x));
  const out: string[] = [];
  const network = added(before.network, next.network);
  if (network.length) out.push(`network: ${network.join(", ")}`);
  const env = added(before.env, next.env);
  if (env.length) out.push(`env: ${env.join(", ")}`);
  const hosted = added(before.hosted, next.hosted);
  if (hosted.length) out.push(`hosted (sends your inputs to): ${hosted.join(", ")}`);
  const spawn = added(before.spawn, next.spawn);
  if (spawn.length) out.push(`spawn: ${spawn.join("; ")}`);
  if (next.code && !before.code) out.push(`code: now runs its own code`);
  return out;
}
