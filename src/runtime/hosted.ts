/**
 * The `halo#hosted` tool provider: runs a package's hosted pipeline on the publisher's server.
 *
 * The linker gives every hosted pipeline a tool on this provider (src/linker/hosted.ts),
 * declared with the endpoint, package, version, pipeline and auth from the installed
 * package. A call is the wire protocol in src/registry/contract.ts:
 *
 *   POST <endpoint>/api/pipelines/<Pipeline>/runs
 *   Halo-Package: @acme/support-kit@1.2.0
 *   Authorization: Bearer <key>          (or "<hosted.auth.name>: <key>")
 *   { "args": { ... }, "wait": true }
 *
 * and answers the run's `output`. Its one method, `run`, is `external`: the consumer's
 * inputs leave the machine.
 */

import { HOSTED_PACKAGE_HEADER } from "../registry/contract.js";
import { HaloError, HttpError } from "./errors.js";
import type { ProviderInfo, ToolCall, ToolProvider, ToolServices } from "./tools.js";

export { HOSTED_PROVIDER } from "../linker/hosted.js";

export const HOSTED_PROVIDER_INFO: ProviderInfo = {
  description: "A pipeline a package runs on its publisher's server (hosted export).",
  methods: [{ name: "run", description: "Run the hosted pipeline on the publisher's server with these arguments.", effect: "external" }],
};

const text = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));

export const hostedProvider: ToolProvider = async (call: ToolCall, services: ToolServices) => {
  const endpoint = text(call.config("endpoint")).replace(/\/+$/, "");
  const pkg = text(call.config("package"));
  const version = text(call.config("version"));
  const pipeline = text(call.config("pipeline"));
  const auth = text(call.config("auth"));
  const envName = text(call.config("env"));
  const header = text(call.config("header"));
  const label = `${pipeline} (hosted by ${pkg})`;
  if (!endpoint || !pkg || !version || !pipeline) throw new HaloError(`${label}: the hosted pipeline's declaration is incomplete; run halo install`, { code: "TOOL_CONFIG" });

  const headers: Record<string, string> = { "Content-Type": "application/json", [HOSTED_PACKAGE_HEADER]: `${pkg}@${version}` };
  if (auth) {
    const key = (services.env ?? Bun.env)[envName];
    if (!key) {
      throw new HaloError(`${label} runs on ${endpoint} and needs a key from the publisher: set ${envName} (${pkg} reads it to authenticate)`, { code: "NO_API_KEY" });
    }
    if (auth === "header") headers[header || "X-Halo-Key"] = key;
    else headers.Authorization = `Bearer ${key}`;
  }

  // Positional arguments fill the parameters in order; the linker's stub passes them by name.
  const args: Record<string, unknown> = { ...call.named };
  const url = `${endpoint}/api/pipelines/${encodeURIComponent(pipeline)}/runs`;
  let res: Response;
  try {
    // Never follow a redirect: it would re-send the key and the inputs to wherever it points.
    res = await services.fetch(url, { method: "POST", headers, body: JSON.stringify({ args, wait: true }), signal: call.signal, redirect: "manual" });
  } catch (err) {
    if (call.signal.aborted) throw err;
    throw new HaloError(`${label}: can't reach ${endpoint}: ${err instanceof Error ? err.message : String(err)}`, { code: "HTTP_ERROR", retryable: true, cause: err });
  }
  if (res.status >= 300 && res.status < 400) {
    const to = res.headers.get("location");
    throw new HttpError(`${label}: ${endpoint} answered a redirect (${res.status}${to ? ` to ${to}` : ""}); hosted calls don't follow redirects, so the key isn't sent anywhere else. Ask ${pkg}'s publisher to fix hosted.endpoint`, res.status, "");
  }
  const body = await res.text();
  let parsed: { output?: unknown; status?: string; error?: string; code?: string } | undefined;
  try {
    parsed = body ? JSON.parse(body) : undefined;
  } catch {
    parsed = undefined;
  }
  const said = parsed?.error ? `: ${parsed.error}` : body ? `: ${body.slice(0, 300)}` : "";
  if (res.status === 410) {
    throw new HttpError(`${label}: ${endpoint} no longer serves ${pkg}@${version}${said}. Run \`halo update ${pkg}\` to move to a version it serves`, 410, body);
  }
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(`${label}: ${endpoint} refused the key in ${envName || "(none)"} (${res.status})${said}`, res.status, body);
  }
  if (!res.ok) throw new HttpError(`${label}: ${endpoint} answered ${res.status}${said}`, res.status, body);
  if (!parsed || typeof parsed !== "object") throw new HaloError(`${label}: ${endpoint} didn't answer JSON`, { code: "HTTP_ERROR" });
  if (parsed.status !== "completed") {
    throw new HaloError(`${label}: the run on ${endpoint} ended ${parsed.status ?? "without a status"}${parsed.error ? `: ${parsed.error}` : ""}`, { code: "HOSTED_RUN" });
  }
  return parsed.output;
};
