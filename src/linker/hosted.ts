/**
 * Hosted pipelines, the consumer's side of the linker. A package's `hosted.exports` have no
 * source in the package, only interfaces (ResolvedPackage.hosted). For each one the linker
 * adds two declarations to the program:
 *
 *   tool     @acme/kit/hosted#DraftReply : halo#hosted(endpoint: ..., package: ..., version: ..., pipeline: ..., auth...)
 *   pipeline @acme/kit#DraftReply(<params>) -> <returns>:
 *     @acme/kit/hosted#DraftReply.run(<each param>: context.input.<param>)
 *
 * The pipeline is what `use "@acme/kit" { DraftReply }` imports, so calling it reads like a
 * local pipeline (`DraftReply(ticket: t)`) and validate checks its arguments. The tool is
 * the remote call: the runtime's `halo#hosted` provider POSTs to the publisher's server,
 * mocks and recordings see it as a tool call, and `halo plan` shows it as `external`. Both
 * show as `DraftReply`, so a consumer mocks it as `"DraftReply"` (or `"DraftReply.run"`).
 *
 * Schemas the interface names come along as `@acme/kit/hosted#<Schema>`, unless one of the
 * package's exported files declares a schema of that name (then that one is used).
 * Pure: no Node or Bun APIs.
 */

import type { Arg, CallStage, PipelineDeclaration, SchemaDeclaration, ToolDeclaration } from "../parser/types.js";
import { SCHEMA_TYPES } from "../parser/builtins.js";
import type { HostedPipelineInterface, ResolvedPackage } from "../registry/contract.js";

/** The runtime provider behind hosted pipeline stubs. `#` keeps it out of reach of `tool X : ...` in source. */
export const HOSTED_PROVIDER = "halo#hosted";

/** The method a hosted stub's tool is called with. */
export const HOSTED_METHOD = "run";

/** Internal name of the tool that calls a hosted pipeline. */
export const hostedToolName = (pkg: string, pipeline: string) => `${pkg}/hosted#${pipeline}`;

const hostedSchemaName = (pkg: string, schema: string) => `${pkg}/hosted#${schema}`;

const BUILTIN = new Set<string>([...SCHEMA_TYPES, "Integer", "Float", "Bool", "Date"]);

export interface HostedDeclarations {
  pipelines: PipelineDeclaration[];
  tools: ToolDeclaration[];
  schemas: SchemaDeclaration[];
  /** Hosted pipeline name → its stub pipeline's internal name. */
  stubs: Map<string, string>;
  /** Schema name → internal name, for schemas only the interfaces declare (importable too). */
  schemaNames: Map<string, string>;
  /** Internal names → display names for the tools (each shows as its pipeline). */
  toolOf: Map<string, string>;
  problems: string[];
}

const str = (value: string): Arg["value"] => ({ kind: "string", value });

/**
 * The stub declarations for a package's hosted pipelines. `exportedSchemas` maps schema
 * names the package's exported files declare to their internal names.
 */
export function hostedDeclarations(pkg: ResolvedPackage, exportedSchemas: Map<string, string>, file?: string): HostedDeclarations {
  const out: HostedDeclarations = { pipelines: [], tools: [], schemas: [], stubs: new Map(), schemaNames: new Map(), toolOf: new Map(), problems: [] };
  const hosted = pkg.manifest.hosted;
  if (!hosted) return out;
  const loc = file ? { line: 1, column: 0, file } : undefined;
  const interfaces = pkg.hosted ?? {};

  // Schemas the interfaces name: the package's exported ones, else declared here from the interface.
  const fields = new Map<string, Record<string, string>>();
  for (const i of Object.values(interfaces)) for (const [name, f] of Object.entries(i.schemas ?? {})) if (!fields.has(name)) fields.set(name, f);
  const schemaRef = (name: string) => exportedSchemas.get(name) ?? (fields.has(name) ? hostedSchemaName(pkg.name, name) : undefined);
  const type = (t: string) => t.replace(/[A-Za-z_]\w*/g, (n) => (BUILTIN.has(n) ? n : (schemaRef(n) ?? n)));
  for (const [name, f] of fields) {
    if (exportedSchemas.has(name)) continue;
    const q = hostedSchemaName(pkg.name, name);
    out.schemaNames.set(name, q);
    out.schemas.push({ name: q, fields: Object.entries(f).map(([n, t]) => ({ name: n, type: type(t) })), ...(loc ? { loc } : {}) });
  }

  const auth = hosted.auth;
  for (const name of hosted.exports) {
    const i: HostedPipelineInterface | undefined = interfaces[name];
    if (!i) {
      out.problems.push(`${pkg.name}: hosted pipeline ${name} has no interface in the installed package (it was not published with halo publish); ask the publisher, or run halo install`);
      continue;
    }
    const toolName = hostedToolName(pkg.name, name);
    const argList: Arg[] = [
      { name: "endpoint", value: str(hosted.endpoint) },
      { name: "package", value: str(pkg.name) },
      { name: "version", value: str(pkg.version) },
      { name: "pipeline", value: str(name) },
      ...(auth ? [{ name: "auth", value: str(auth.type) }, { name: "env", value: str(auth.env) }, ...(auth.name ? [{ name: "header", value: str(auth.name) }] : [])] : []),
    ];
    out.tools.push({
      name: toolName,
      provider: HOSTED_PROVIDER,
      args: [],
      namedArgs: Object.fromEntries(argList.map((a) => [a.name!, JSON.stringify((a.value as { value: string }).value)])),
      argList,
      ...(loc ? { loc } : {}),
    });
    const callArgs: Arg[] = i.params.map((p) => ({ name: p.name, value: { kind: "context", path: ["input", p.name] } }));
    const call: CallStage = {
      kind: "call",
      callee: toolName,
      method: HOSTED_METHOD,
      args: [],
      namedArgs: Object.fromEntries(i.params.map((p) => [p.name, `context.input.${p.name}`])),
      argList: callArgs,
      alias: name,
      ...(loc ? { loc } : {}),
    };
    const q = `${pkg.name}#${name}`;
    out.pipelines.push({
      name: q,
      params: i.params.map((p) => ({ name: p.name, type: type(p.type) })),
      returnType: i.returns ? type(i.returns) : "",
      pipeline: [call],
      directives: [],
      ...(loc ? { loc } : {}),
    });
    out.stubs.set(name, q);
    out.toolOf.set(toolName, q);
  }
  return out;
}

/**
 * Problems with a call to a hosted pipeline: arguments it doesn't take, and ones it needs
 * but doesn't get. Types are checked by validate (the stub's parameters are typed).
 */
export function hostedCallProblems(call: CallStage, shown: string, i: HostedPipelineInterface): string[] {
  const problems: string[] = [];
  const params = i.params.map((p) => p.name);
  const signature = `${shown}(${i.params.map((p) => `${p.name}: ${p.type}`).join(", ")})`;
  const positional = call.argList.filter((a) => !a.name).length;
  if (positional > params.length) problems.push(`${shown} takes ${params.length} argument${params.length === 1 ? "" : "s"}, but ${positional} are given: ${signature}`);
  for (const a of call.argList) {
    if (a.name && !params.includes(a.name)) problems.push(`${shown} has no parameter "${a.name}": ${signature}`);
  }
  // With no arguments, the flowing value fills the first parameter.
  const missing = i.params.filter((p, idx) => (call.argList.length ? idx >= positional : idx > 0) && !call.argList.some((a) => a.name === p.name));
  if (missing.length) problems.push(`${shown}(...) needs ${missing.map((p) => `"${p.name}"`).join(", ")}: ${signature} runs on the publisher's server, which refuses a call without them`);
  return problems;
}
