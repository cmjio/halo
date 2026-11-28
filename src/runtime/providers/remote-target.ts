/**
 * What a `Remote(...)` declaration names, read without running anything: which backend, and an SSH
 * host. No node:* imports: `halo plan` (and so the browser playground) reads this file.
 */

export interface SshTarget {
  user?: string;
  host: string;
  port?: number;
}

/** Parse "user@host", "host", "ssh://user@host:port" (and "[::1]" hosts). */
export function parseSshTarget(text: string): SshTarget {
  let rest = text.trim().replace(/^ssh:\/\//i, "");
  // Values can't become ssh options, or carry anything a shell or ssh would read specially.
  if (!rest || rest.startsWith("-") || /[\s'"`$;|&<>\\\0]/.test(rest)) throw new Error(`"${text}" is not an SSH host`);
  let user: string | undefined;
  const at = rest.lastIndexOf("@");
  if (at >= 0) {
    user = rest.slice(0, at);
    rest = rest.slice(at + 1);
    if (!user || user.startsWith("-")) throw new Error(`"${text}" is not an SSH host`);
  }
  let port: number | undefined;
  const bracket = /^\[([^\]]+)\](?::(\d+))?$/.exec(rest);
  if (bracket) {
    rest = bracket[1]!;
    if (bracket[2]) port = Number(bracket[2]);
  } else {
    const m = /^([^:]+):(\d+)$/.exec(rest);
    if (m) {
      rest = m[1]!;
      port = Number(m[2]);
    }
  }
  if (!rest || rest.startsWith("-") || rest.includes("/")) throw new Error(`"${text}" is not an SSH host`);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error(`"${text}" has a bad port`);
  return { user, host: rest, port };
}

/** Which backend a declaration names; "auto" is resolved when the sandbox is made. */
export function backendOf(spec: unknown): "ssh" | "e2b" | "daytona" | "docker" | "auto" | undefined {
  if (typeof spec !== "string" || !spec.trim()) return undefined;
  const s = spec.trim().toLowerCase();
  return s === "e2b" || s === "daytona" || s === "docker" || s === "auto" ? s : "ssh";
}
