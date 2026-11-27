/**
 * `halo migrate`: bring a project written for an older Halo up to this one.
 *
 * A project records the Halo it was written for in halo.json:
 *
 *   { "halo": "^1.4.0" }
 *
 * Every change to Halo that can alter what an existing project does ships with a migration
 * in MIGRATIONS, tagged with the version that made the change. `halo migrate` runs the ones
 * newer than the project's version (all of them when halo.json doesn't say), and shows what
 * each found. `--write` applies the ones that can be applied in code and records the new
 * version; the rest are a person's to decide, and are listed with the file and line.
 *
 * A migration finds its cases in the files themselves, so running it twice changes nothing.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse } from "../parser/index.js";
import type { LoopStage, ParseResult, PipelineStage } from "../parser/types.js";
import { validate, type Diagnostic } from "../parser/validate.js";
import { readProjectConfig, writeProjectConfig } from "../registry/config.js";
import { HALO_VERSION, installProject } from "../registry/install.js";
import { readAnyLock } from "../registry/lockfile.js";
import { compare, parseRange, parseVersion, satisfies } from "../registry/semver.js";
import { BASH_BASE_ENV } from "../runtime/integrations.js";
import { argRules } from "../runtime/tool-rules.js";
import { AdapterRegistry } from "../runtime/adapter.js";
import { priceOf, type Prices } from "../runtime/prices.js";
import { hasLegacyTrust } from "../registry/trust.js";

export interface ProjectFile {
  /** Relative to the project, with forward slashes. */
  path: string;
  ast: ParseResult;
}

export interface Project {
  root: string;
  /** halo.json, or {} when there is none. */
  config: Record<string, unknown>;
  /** Every .halo file outside dot-folders and node_modules. */
  files: ProjectFile[];
}

export interface Finding {
  file: string;
  line?: number;
  message: string;
}

export interface ApplyOptions {
  /** Allow packages that run their own code, as `halo install --trust` does. */
  trust?: boolean;
}

export interface Migration {
  id: string;
  /** The Halo version that made the change. */
  since: string;
  title: string;
  /** What changed, and what to do about it. */
  detail: string;
  find(project: Project): Finding[];
  /** Rewrites the project. A migration without it is a person's to act on. */
  apply?(project: Project, options: ApplyOptions): Promise<void>;
}

const names = (v: unknown[]) => v.join(", ");

// ── 1.9.0: names that did nothing are errors ──

/** The validator's errors since 1.9.0 for a name that, misspelled, used to be a warning and do nothing. */
const STRICT_NAME = [
  /is not a policy rule/,
  /is not a category it can detect/,
  /\) is not something it can check/,
  /\) can't be checked; only Enforce\(JSON\) is/,
  /^@\w+ is not a directive/,
  /Vault has no setting/,
  /which is not a declared tool; did you mean/,
  /is not a Vault tool; did you mean/,
  /loop\(\.\.\.\) has no option/,
];

interface NameFix {
  file: string;
  line: number;
  /** The name as written, and what it should be (undefined: no close match, a person decides). */
  from: string;
  to?: string;
  message: string;
}

function strictNames(project: Project): NameFix[] {
  const out: NameFix[] = [];
  for (const file of project.files) {
    if (file.ast.errors.length) continue;
    for (const d of validate(file.ast) as Diagnostic[]) {
      if (d.severity !== "error" || !STRICT_NAME.some((r) => r.test(d.message))) continue;
      const to = /did you mean @?([\w.]+)\?/.exec(d.message)?.[1];
      out.push({ file: file.path, line: d.line ?? 1, from: d.token ?? "", ...(to ? { to } : {}), message: d.message });
    }
  }
  return out;
}

/** Each source line of every stage in a pipeline, nested arms and fan-outs included. */
function stagesOf(ast: ParseResult): PipelineStage[] {
  const out: PipelineStage[] = [];
  for (const p of ast.pipelines) for (const st of p.pipeline) out.push(st);
  return out;
}

/** Rewrites each file `edit` changes, and keeps the change only if the file still parses. */
function rewrite(project: Project, files: string[], edit: (text: string) => string, same: (before: ParseResult, after: ParseResult) => boolean): void {
  const refused: string[] = [];
  for (const path of files) {
    const full = join(project.root, path);
    const text = readFileSync(full, "utf8");
    const next = edit(text);
    if (next === text) continue;
    const before = parse(text);
    const after = parse(next);
    if (after.errors.length || !same(before, after)) {
      refused.push(path);
      continue;
    }
    writeFileSync(full, next);
  }
  if (refused.length) throw new Error(`left ${names(refused)} as they were: the rewrite didn't read back the same; change them by hand`);
}

const loops = (ast: ParseResult) => stagesOf(ast).filter((s): s is LoopStage => s.kind === "loop");

export const MIGRATIONS: Migration[] = [
  {
    id: "lockfile-v2",
    since: "1.0.0",
    title: "halo.lock is in the 0.x format",
    detail: "Packages are now dependencies in halo.json, pinned by a version 2 halo.lock. This installs the same packages again and rewrites both files.",
    find(project) {
      const any = readAnyLock(project.root);
      if (any.version !== 1) return [];
      const tools = Object.keys(any.lock.tools);
      return [{ file: "halo.lock", message: tools.length ? `lists ${names(tools)} in the old format` : "is in the old format" }];
    },
    async apply(project, options) {
      await installProject({ root: project.root, trust: options.trust });
    },
  },
  {
    id: "post-path-locked",
    since: "1.4.0",
    title: "A model can no longer choose a POST tool's path",
    detail:
      'An agent that calls a POST tool reaches only the address the tool declares; a call that sets path is refused. Calls a pipeline makes itself still pass path:. If the tool has one endpoint, nothing needs to change, or write & Fixed("path", "/the/endpoint") to send a path on every call. To let the model choose again, as before 1.4.0, add & Unlocked("path").',
    find(project) {
      const equipped = new Set(project.files.flatMap((f) => f.ast.agents.flatMap((a) => a.equips ?? [])));
      const out: Finding[] = [];
      for (const file of project.files) {
        for (const tool of file.ast.tools) {
          if (tool.provider !== "POST" || !equipped.has(tool.name)) continue;
          // Any rule that names path means its author has already decided.
          const decided = (tool.rules ?? []).some((r) => r.args.some((a) => a.kind === "string" && a.value === "path"));
          if (decided || !argRules(tool).locked.has("path")) continue;
          out.push({ file: file.path, line: tool.loc?.line, message: `tool ${tool.name} is equipped by an agent and has no rule for path` });
        }
      }
      return out;
    },
  },
  {
    id: "screenshot-image",
    since: "1.6.0",
    title: "Chrome.screenshot returns an image, not base64",
    detail:
      "Without a path, Chrome.screenshot used to return { mimeType, base64 }. It now returns { image }, an image value: a model the result reaches is sent the picture itself, and the text reads [image: screenshot.png #abc123]. Read .image instead of .base64; to keep the file, pass path: as before.",
    find(project) {
      const out: Finding[] = [];
      for (const file of project.files) {
        if (!file.ast.tools.some((t) => t.provider === "Chrome")) continue;
        const lines = readFileSync(join(project.root, file.path), "utf8").split("\n");
        for (const [i, line] of lines.entries()) {
          if (/\.base64\b|\bmimeType\b/.test(line.replace(/\/\/.*$/, ""))) out.push({ file: file.path, line: i + 1, message: "reads a screenshot's base64 or mimeType" });
        }
      }
      return out;
    },
  },
  {
    id: "bash-clean-env",
    since: "1.7.0",
    title: "Bash commands no longer see Halo's whole environment",
    detail:
      'A Bash command used to inherit every variable Halo was started with, API keys included, so an agent with a shell could print them. It now sees only PATH, HOME, USER, LOGNAME, SHELL, LANG, LC_ALL, LC_CTYPE, TMPDIR, TZ and TERM. Pass on what its commands need by name: Bash(env: ["DATABASE_URL"]). A variable read only by a script the command runs can\'t be found here, so check those too.',
    find(project) {
      const base = new Set<string>(BASH_BASE_ENV);
      const out: Finding[] = [];
      for (const file of project.files) {
        const tools = file.ast.tools.filter((t) => t.provider === "Bash" && !t.argList.some((a) => a.name === "env"));
        if (!tools.length) continue;
        const lines = readFileSync(join(project.root, file.path), "utf8").split("\n");
        for (const tool of tools) {
          // Variables named in the commands of this tool's calls, the ones a reader can see.
          const call = new RegExp(`\\b${tool.name}\\.\\w+\\s*\\(`);
          const used = new Set<string>();
          for (const line of lines) {
            if (!call.test(line)) continue;
            for (const m of line.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)/g)) if (!base.has(m[1]!)) used.add(m[1]!);
          }
          const names = [...used].sort();
          const message = names.length ? `tool ${tool.name} has no env:, and its commands read ${names.map((n) => `$${n}`).join(", ")}` : `tool ${tool.name} has no env:`;
          out.push({ file: file.path, line: tool.loc?.line, message });
        }
      }
      return out;
    },
  },
  {
    id: "misspelled-names",
    since: "1.9.0",
    title: "A misspelled policy rule, category, directive, Vault setting or loop option is an error",
    detail:
      "Before 1.9.0 these were warnings, and the misspelled name did nothing: maxspend(0.25) ran with no spend cap, Block(PromptInjecton) blocked nothing, @retyr(3) never retried. Now the file doesn't load. --write renames each one to the name it was close to, which turns that rule on: check that a newly enforced cap, block or retry is what you want.",
    find(project) {
      return strictNames(project)
        .filter((f) => f.to)
        .map((f) => ({ file: f.file, line: f.line, message: `${f.from} → ${f.to}` }));
    },
    async apply(project) {
      const fixes = strictNames(project).filter((f) => f.to && f.from);
      const byFile = new Map<string, NameFix[]>();
      for (const f of fixes) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
      for (const [path, list] of byFile) {
        const full = join(project.root, path);
        const lines = readFileSync(full, "utf8").split("\n");
        for (const f of list) {
          // The diagnostic points at the declaration. The name is on that line, a few after it (a policy can
          // span lines), or just before it (a directive sits above its agent or pipeline): nearest first.
          const word = new RegExp(`(?<![\\w])${f.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`);
          const at = f.line - 1;
          const order = [at, ...Array.from({ length: 30 }, (_, k) => [at + k + 1, at - k - 1]).flat()].filter((i) => i >= 0 && i < lines.length);
          for (const i of order) {
            if (!word.test(lines[i]!.replace(/\/\/.*$/, ""))) continue;
            lines[i] = lines[i]!.replace(word, f.to!);
            break;
          }
        }
        writeFileSync(full, lines.join("\n"));
      }
      const left = strictNames(loadProject(project.root)).filter((f) => f.to);
      if (left.length) throw new Error(`couldn't find ${names(left.map((f) => `${f.from} (${f.file}:${f.line})`))} to rename; change them by hand`);
    },
  },
  {
    id: "unknown-names",
    since: "1.9.0",
    title: "A policy rule or check Halo can't apply is an error",
    detail:
      "Before 1.9.0 these were warnings, and the runtime ignored them, so they never ran. Now the file doesn't load. None of them is close to a name Halo has, so there's nothing to rename: remove the rule, or replace it with one that is enforced (see the Policies page). For a person's approval, use |! yield.",
    find(project) {
      return strictNames(project)
        .filter((f) => !f.to)
        .map((f) => ({ file: f.file, line: f.line, message: f.message }));
    },
  },
  {
    id: "loop-condition",
    since: "1.9.0",
    title: "A loop's condition is written in parentheses, like a gate's",
    detail:
      'loop(Coder, "context.data.tests.exitCode != 0") becomes loop(Coder, (context.data.tests.exitCode != 0)). The quoted form still works, so nothing changes in how a run behaves; --write rewrites it to the form the docs use and the editor checks as you type.',
    find(project) {
      return project.files.flatMap((f) => loops(f.ast).filter((l) => l.quoted).map((l) => ({ file: f.path, line: l.loc?.line, message: `loop(${l.target}, "${l.condition}")` })));
    },
    async apply(project) {
      const files = project.files.filter((f) => loops(f.ast).some((l) => l.quoted)).map((f) => f.path);
      rewrite(
        project,
        files,
        (text) =>
          text.replace(/(loop\(\s*\w+\s*,\s*)"(?!"")((?:[^"\\\n]|\\.)*)"/g, (whole, head: string, cond: string) => {
            // Inside the quotes, \" was a quote and \\ a backslash; in parentheses they're written as they are.
            return `${head}(${cond.replace(/\\(.)/g, "$1")})`;
          }),
        (a, b) => JSON.stringify(loops(a).map((l) => l.expr)) === JSON.stringify(loops(b).map((l) => l.expr)),
      );
    },
  },
  {
    id: "gate-arrow",
    since: "1.9.0",
    title: "A => after a gate's condition does nothing",
    detail:
      "|? (cond) => was allowed and did nothing: a gate stops the run when the condition is false, and doesn't choose what runs next. It is a warning now. --write removes the =>. If you meant to do something only in some cases and carry on either way, that's a branch: |? { (cond) => Call(), else => Call() }.",
    find(project) {
      return project.files.flatMap((f) => stagesOf(f.ast).filter((s) => s.kind === "gate" && s.arrow).map((s) => ({ file: f.path, line: s.loc?.line, message: `|? (${(s as { condition: string }).condition}) =>` })));
    },
    async apply(project) {
      const files = project.files.filter((f) => stagesOf(f.ast).some((s) => s.kind === "gate" && s.arrow)).map((f) => f.path);
      rewrite(
        project,
        files,
        (text) => text.replace(/^(\s*\|\?\s*\(.*\))[ \t]*=>[ \t]*$/gm, "$1"),
        (a, b) => stagesOf(a).length === stagesOf(b).length && !stagesOf(b).some((s) => s.kind === "gate" && s.arrow),
      );
    },
  },
  {
    id: "result-type-checked",
    since: "1.9.0",
    title: "Result<T> is checked as T",
    detail:
      "Before 1.9.0, Result<T> was accepted but T was ignored, so -> Result<Reply> checked nothing. Now the output is checked as T, the same as -> Reply, and a run whose output doesn't match fails with a SchemaValidationError. Check that each pipeline's output matches; to keep it unchecked, write -> Result. Result takes one type: Result<A, B> is an error.",
    find(project) {
      const out: Finding[] = [];
      for (const file of project.files) {
        for (const p of file.ast.pipelines) {
          const where = [p.returnType, ...p.params.map((x) => x.type)].filter((t) => /\bResult\s*</.test(t));
          for (const t of where) out.push({ file: file.path, line: p.loc?.line, message: `${p.name}: ${t}` });
        }
        for (const sc of file.ast.schemas) {
          for (const f of sc.fields) if (/\bResult\s*</.test(f.type)) out.push({ file: file.path, line: sc.loc?.line, message: `schema ${sc.name}: ${f.name}: ${f.type}` });
        }
      }
      return out;
    },
  },
  {
    id: "package-trust-moved",
    since: "1.10.0",
    title: "Package trust is kept on this machine, outside the project",
    detail:
      "Before 1.10.0, trust for packages that run their own code was kept in the project's .halo/trust.json, so a repo could ship its own trust and have its code run by halo test or by opening a file in an editor. Now it is in ~/.config/halo/trust.json, keyed by the project's folder, and .halo/trust.json is ignored. Run halo install --trust once in this project (check halo.lock first), and delete .halo/trust.json.",
    find(project) {
      const out: Finding[] = [];
      if (hasLegacyTrust(project.root)) out.push({ file: ".halo/trust.json", message: "ignored now: run halo install --trust here, then delete it" });
      const lock = readAnyLock(project.root);
      if (lock.version === 2) {
        for (const [name, entry] of Object.entries(lock.lock.packages)) {
          if (entry.permissions?.code) out.push({ file: "halo.lock", message: `${name} runs its own code, so it needs halo install --trust on this machine` });
        }
      }
      return out;
    },
  },
  {
    id: "maxspend-needs-a-price",
    since: "1.10.0",
    title: "MaxSpend refuses a model Halo can't price",
    detail:
      "Before 1.10.0, MaxSpend counted spend with prices guessed from the model's name, or a flat rate for OpenRouter and Together, or nothing for a generic OpenAI-compatible endpoint, so a budget could let a run spend many times its cap. Now prices are exact, and an agent under MaxSpend whose model has no price is refused before the call is sent. Add each model listed here to \"prices\" in halo.json, in USD per million tokens: {\"prices\": {\"openrouter/openai/o1-pro\": {\"input\": <USD>, \"output\": <USD>}}}. Reported costs change too: claude-haiku-4-5 is counted at its real $1/$5.",
    find(project) {
      const registry = new AdapterRegistry();
      const prices = (project.config.prices ?? {}) as Prices;
      const slots = (project.config.models ?? {}) as Record<string, string>;
      const out: Finding[] = [];
      for (const file of project.files) {
        const capped = new Set(file.ast.policies.filter((p) => p.rules.some((r) => r.name === "MaxSpend")).map((p) => p.name));
        for (const agent of file.ast.agents) {
          if (!(agent.requires ?? []).some((r) => capped.has(r))) continue;
          const model = agent.modelId.startsWith("models.") ? slots[agent.modelId.slice(7)] : agent.modelId;
          if (!model) continue;
          if (!priceOf(model, 0, registry.findAdapter(model), prices)) out.push({ file: file.path, line: agent.loc?.line, message: `${agent.name} (${model}) has MaxSpend and no price: add ${model} to "prices"` });
        }
      }
      return out;
    },
  },
  {
    id: "query-locked",
    since: "1.10.0",
    title: "A model can't set query: on a GET, REST or POST tool",
    detail:
      "query: is a raw query string, so a model could put any parameter in it, past the tool's Locked, Fixed and Match rules. Now a model's call can't set it unless the tool says & Unlocked(\"query\"), and a key in it that one of those rules names is refused for any call. The tools listed are ones an agent equips: if a model should be able to pass extra parameters, give the tool & Unlocked(\"query\"), or better, name each parameter.",
    find(project) {
      const out: Finding[] = [];
      for (const file of project.files) {
        const equipped = new Set(file.ast.agents.flatMap((a) => a.equips ?? []));
        for (const tool of file.ast.tools) {
          if (!["GET", "REST", "POST"].includes(tool.provider) || !equipped.has(tool.name)) continue;
          if (!argRules(tool).locked.has("query")) continue;
          out.push({ file: file.path, line: tool.loc?.line, message: `${tool.name} (${tool.provider}): an agent's call can't set query: now` });
        }
      }
      return out;
    },
  },
  {
    id: "bash-second-shell",
    since: "1.10.0",
    title: "A Bash placeholder that a second shell would read is refused",
    detail:
      "Halo escapes a {{placeholder}} for the bash that runs the command, but a value inside bash -c '...', sh -c \"...\", eval or an ssh command is read again by another shell, which can run it. A value that starts with - is also refused where a command would read it as an option, unless -- comes first. These commands now fail before they run: pass the value as an argument (bash -c '... \"$1\"' _ {{x}}), through an exported variable, or after --.",
    find(project) {
      const out: Finding[] = [];
      for (const file of project.files) {
        for (const d of validate(file.ast)) {
          if (d.severity === "warning" && /as shell code, so the run will refuse it|would read as an option/.test(d.message)) out.push({ file: file.path, line: d.line, message: d.message });
        }
      }
      return out;
    },
  },
  {
    id: "workspace-no-git",
    since: "1.10.0",
    title: "A Workspace can't read or write inside .git",
    detail:
      "A repository's .git/config names programs git runs on ordinary calls, so a Workspace that could write it could run commands. Paths inside a .git folder are now refused, and so is a Workspace rooted in one. Listed: Workspaces rooted in a .git folder. If a tool really must reach .git, declare it with git: true.",
    find(project) {
      const out: Finding[] = [];
      for (const file of project.files) {
        for (const tool of file.ast.tools) {
          if (tool.provider !== "Workspace") continue;
          const root = tool.args?.[0] as { kind?: string; value?: unknown } | undefined;
          if (root?.kind === "string" && typeof root.value === "string" && root.value.split(/[\\/]/).some((p) => p.toLowerCase() === ".git")) out.push({ file: file.path, line: tool.loc?.line, message: `${tool.name} is rooted in .git` });
        }
      }
      return out;
    },
  },
  {
    id: "secrets-not-in-urls",
    since: "1.10.0",
    title: "halo serve doesn't take the API token or a webhook secret from the URL",
    detail:
      "URLs end up in logs and proxies. The API (and /mcp) now needs Authorization: Bearer <token>; ?token= gets 401. A webhook's secret must come in the x-halo-secret header (or a GitHub signature); ?secret= is accepted only for a webhook with \"secretInQuery\": true, for senders that can only put it in the URL. Listed: webhooks with a secret.",
    find(project) {
      const hooks = Array.isArray(project.config.webhooks) ? (project.config.webhooks as Array<{ path?: string; secret?: unknown; secretInQuery?: boolean }>) : [];
      return hooks.filter((h) => h.secret && !h.secretInQuery).map((h) => ({ file: "halo.json", message: `webhook /hooks/${h.path}: send the secret as x-halo-secret, or add "secretInQuery": true` }));
    },
  },
  {
    id: "env-values-masked",
    since: "1.12.0",
    title: "A value read from Env is masked when a tool sends it back",
    detail:
      "A service that echoes a key it was sent (an error page quoting the Authorization header) put the key in the terminal, telemetry, recordings and the model's context. Halo now replaces each value it read from Env.NAME with [secret NAME] in tool results and errors. Values under 8 characters, numbers, booleans, words like us-east-1, host names, paths and plain URLs are left alone unless the variable's name says it's a secret. A pipeline that compared a tool's result with such a value (an account ID it also sends) now sees [secret NAME]. Listed: Env variables read by tools whose names don't say they're secrets. Redact(APIKey) also finds more kinds of secret (Bearer tokens, passwords in URLs, named hex secrets).",
    find(project) {
      const out: Finding[] = [];
      const secret = /KEY|TOKEN|SECRET|PASS|PWD|AUTH|CRED|PRIVATE|SIGN|SALT|DSN|WEBHOOK|COOKIE|SESSION/i;
      for (const file of project.files) {
        for (const tool of file.ast.tools) {
          const names = new Set([...JSON.stringify([tool.argList, tool.rules ?? []]).matchAll(/Env\.(\w+)|"path":\["Env","(\w+)"/g)].map((m) => m[1] ?? m[2]!));
          for (const n of names) if (!secret.test(n)) out.push({ file: file.path, line: tool.loc?.line, message: `${tool.name} reads Env.${n}: if a service sends its value back, the run sees [secret ${n}]` });
        }
      }
      return out;
    },
  },
  {
    id: "mcp-private-cwd",
    since: "1.12.0",
    title: "A stdio MCP server starts in a private empty folder",
    detail:
      "Bun and many dotenv libraries load .env from the folder a program starts in, so a server started in the project could read its keys. Without cwd:, a stdio MCP server now starts in a new empty folder, and relative paths in its command (./server.ts, server.ts, .) are made absolute against the project first. A server that needs to start in the project (python -m, uv run, a node_modules/.bin program, one that reads settings from its folder) needs cwd: \".\". Listed: each MCP tool with a command and no cwd:.",
    find(project) {
      const out: Finding[] = [];
      for (const file of project.files) {
        for (const tool of file.ast.tools) {
          if (tool.provider !== "MCP" || tool.argList.some((a) => a.name === "cwd" || a.name === "url")) continue;
          const first = tool.argList.find((a) => !a.name)?.value;
          if (first?.kind !== "string" || /^https?:\/\//i.test(first.value.trim())) continue;
          out.push({ file: file.path, line: tool.loc?.line, message: `${tool.name} ("${first.value}") starts in an empty folder; add cwd: "." if it needs the project's` });
        }
      }
      return out;
    },
  },
  {
    id: "mcp-unknown-settings",
    since: "1.12.0",
    title: "An MCP setting Halo doesn't read is an error",
    detail:
      "Before 1.12.0, MCP(\"...\", timeout: 5) loaded and the setting did nothing: the call still waited the default 60 seconds. Now the file doesn't load. Rename each one to the setting you meant (timeout_ms, apiKey, ...) or remove it.",
    find(project) {
      const out: Finding[] = [];
      for (const file of project.files) {
        if (file.ast.errors.length) continue;
        for (const d of validate(file.ast)) {
          if (d.severity === "error" && /MCP has no setting|MCP takes one server/.test(d.message)) out.push({ file: file.path, line: d.line, message: d.message });
        }
      }
      return out;
    },
  },
  {
    id: "mail-oauth-broker",
    since: "1.12.0",
    title: "Gmail and Outlook tokens go through the OAuth broker, and a rotated refresh token is kept",
    detail:
      "An Email tool with via: \"gmail\" or \"outlook\" that signs in with clientId: (a refresh token, or an app's client secret) now gets its tokens from Halo's OAuth broker. Its settings work as before. What changes: when the provider sends a new refresh token (Microsoft does on every refresh), Halo keeps it outside the project, in ~/.config/halo/credentials.json or the macOS Keychain, keyed by this project and the tool's name, and spends it next time instead of the one in Env (which Halo used to keep sending, until the provider refused it). A new value put in Env wins over the kept one. halo auth list shows it. Where nothing can answer a Keychain prompt (CI on a Mac), set HALO_CREDENTIALS_STORE=file. You can also move the tool to auth: with an OAuth declaration and connect it once with halo auth login. Listed: each such Email tool.",
    find(project) {
      const out: Finding[] = [];
      for (const file of project.files) {
        for (const tool of file.ast.tools) {
          if (tool.provider !== "Email" || !tool.argList.some((a) => a.name === "clientId") || tool.argList.some((a) => a.name === "auth" || a.name === "accessToken")) continue;
          const via = tool.argList.find((a) => a.name === "via")?.value;
          const service = via?.kind === "string" ? via.value.toLowerCase() : "";
          if (service !== "gmail" && service !== "outlook") continue;
          out.push({ file: file.path, line: tool.loc?.line, message: `${tool.name} (Email via ${service}) signs in through the OAuth broker: a refresh token the provider rotates is kept outside the project and used next time` });
        }
      }
      return out;
    },
  },
];

export interface MigrationResult {
  id: string;
  since: string;
  title: string;
  detail: string;
  /** Whether `--write` can apply it. */
  automatic: boolean;
  findings: Finding[];
  applied: boolean;
  /** Why applying it failed. */
  error?: string;
}

export interface MigrationReport {
  root: string;
  /** This Halo. */
  halo: string;
  /** The version the project was written for, when halo.json (or --from) says. */
  from?: string;
  /** Set when the project is for a newer Halo than this one: the range it asks for. Nothing else is checked. */
  needsUpgrade?: string;
  /** Migrations that found something, oldest first. */
  results: MigrationResult[];
  /** The `halo` range to record in halo.json, when it is behind. */
  stamp?: { before?: string; after: string; written: boolean };
}

export interface MigrateOptions extends ApplyOptions {
  /** Apply what can be applied, and record the version. */
  write?: boolean;
  /** Treat the project as written for this version, whatever halo.json says. */
  from?: string;
  haloVersion?: string;
  migrations?: Migration[];
}

export class MigrateError extends Error {}

const core = (version: string) => {
  const v = parseVersion(version);
  return v ? `${v.major}.${v.minor}.${v.patch}` : version;
};

/** The range a project written with this Halo records: "^1.4.0" for 1.4.0 and for its next and nightly builds. */
export const haloRange = (version: string = HALO_VERSION) => `^${core(version)}`;

/** The lowest version a range accepts ("^1.3.0" is 1.3.0), or undefined when it has no lower bound. */
export function minVersion(range: string): string | undefined {
  let lowest: string | undefined;
  for (const set of parseRange(range)) {
    const lower = set.filter((c) => c.op === ">=" || c.op === "=" || c.op === ">").map((c) => core(c.v.raw));
    if (!lower.length) return undefined;
    const bound = lower.sort(compare).at(-1)!;
    if (!lowest || compare(bound, lowest) < 0) lowest = bound;
  }
  return lowest;
}

export function loadProject(root: string): Project {
  root = resolve(root);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new MigrateError(`${root} is not a folder`);
  const files: ProjectFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".halo")) files.push({ path: relative(root, full).split("\\").join("/"), ast: parse(readFileSync(full, "utf8")) });
    }
  };
  walk(root);
  return { root, config: readProjectConfig(root), files };
}

/** Check a project against this Halo, and with `write`, bring it up to date. */
export async function migrateProject(root: string, options: MigrateOptions = {}): Promise<MigrationReport> {
  const halo = options.haloVersion ?? HALO_VERSION;
  // Changes from a Halo newer than this one aren't this one's to make.
  const migrations = [...(options.migrations ?? MIGRATIONS)].filter((m) => compare(m.since, core(halo)) <= 0).sort((a, b) => compare(a.since, b.since));
  let project = loadProject(root);
  const report: MigrationReport = { root: project.root, halo, results: [] };

  const range = typeof project.config.halo === "string" ? project.config.halo : undefined;
  let written: string | undefined;
  if (range !== undefined) {
    try {
      written = minVersion(range);
    } catch {
      throw new MigrateError(`halo.json: "halo" is "${range}", which is not a version range (write one like "^${core(halo)}")`);
    }
    // Checked against this Halo's release, so a next or nightly build of 1.5.0 runs a project written for 1.5.0.
    if (written && !satisfies(core(halo), range) && compare(written, core(halo)) > 0) {
      report.needsUpgrade = range;
      return report;
    }
  }
  if (options.from !== undefined && !parseVersion(options.from)) throw new MigrateError(`--from takes a Halo version like 1.2.0, not "${options.from}"`);
  const from = options.from !== undefined ? core(options.from) : written;
  if (from) report.from = from;

  let failed = false;
  for (const m of migrations) {
    if (from && compare(m.since, from) <= 0) continue;
    const findings = m.find(project);
    if (!findings.length) continue;
    const result: MigrationResult = { id: m.id, since: m.since, title: m.title, detail: m.detail, automatic: !!m.apply, findings, applied: false };
    report.results.push(result);
    if (!options.write || !m.apply) continue;
    try {
      await m.apply(project, options);
      result.applied = true;
      // A later migration reads the files as this one left them.
      project = loadProject(root);
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      failed = true;
    }
  }

  // The lowest Halo the project is now right for: the newest change it has been checked against.
  const newest = migrations.at(-1)?.since;
  if (newest && (!written || compare(written, newest) < 0)) {
    report.stamp = { ...(range !== undefined ? { before: range } : {}), after: `^${newest}`, written: false };
    if (options.write && !failed) {
      const config = readProjectConfig(project.root);
      writeProjectConfig(project.root, { ...config, halo: report.stamp.after });
      report.stamp.written = true;
    }
  }
  return report;
}

/**
 * What `halo validate` and `halo serve` say about a project that is behind or ahead of this
 * Halo, or undefined when there is nothing to say. Never throws: it is a hint.
 */
export async function migrationHint(root: string, haloVersion?: string): Promise<string | undefined> {
  try {
    const report = await migrateProject(root, { haloVersion });
    if (report.needsUpgrade) return `This project is written for Halo ${report.needsUpgrade}, and this is Halo ${report.halo}. Run \`halo upgrade\`.`;
    const n = report.results.reduce((sum, r) => sum + r.findings.length, 0);
    if (!n) return undefined;
    const since = report.from ? `since Halo ${report.from}` : "in newer versions of Halo";
    return `${n} thing(s) in this project are affected by changes ${since}. Run \`halo migrate\` to see them.`;
  } catch {
    return undefined;
  }
}
