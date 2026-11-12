/**
 * Hosted endpoints on the public registry must be public: https, on a host that isn't this
 * machine, a private network or a link-local address. A package page says "Hosted by <host>"
 * and `halo` sends the user's inputs there, so a published endpoint pointing at localhost or
 * 10.0.0.5 would aim every installer's inputs at whatever listens on their own network.
 *
 * This checks the URL's text, not DNS: a public name that resolves to a private address is the
 * installer's network's business. `ALLOW_LOCAL_HOSTED_ENDPOINTS` turns the check off for local
 * registries (the e2e test's hosted fixture is http://localhost:4573).
 */

import { hostedEndpointConcern } from "../../../src/registry/contract.ts";

const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".lan", ".home.arpa", ".intranet", ".corp", ".private"];

/**
 * Why `endpoint` can't be a hosted endpoint on a public registry, or undefined when it can.
 * First the shared `hostedEndpointConcern` (the same words the CLI warns with), then a stricter
 * pass for what it lets through: trailing-dot names (`localhost.`), the rest of 0.0.0.0/8,
 * 192.0.0.0/24, 198.18.0.0/15, multicast and reserved IPv4, IPv4-compatible and NAT64 IPv6,
 * site-local, multicast and documentation IPv6, `.home.arpa` and similar names, credentials.
 */
export function hostedEndpointProblem(endpoint: string): string | undefined {
  const concern = hostedEndpointConcern(endpoint);
  if (concern) return `hosted.endpoint ${concern}; the public registry only accepts https endpoints on public hosts`;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return `hosted.endpoint is not a URL: ${endpoint}`;
  }
  if (url.protocol !== "https:") return `hosted.endpoint must be https on this registry (got ${url.protocol.replace(/:$/, "")})`;
  if (url.username || url.password) return "hosted.endpoint must not carry credentials";
  // WHATWG URL parsing already normalised the host: lowercase, IPv4 in dotted decimal (so
  // 2130706433 and 0x7f.1 are 127.0.0.1), IPv6 compressed and in brackets.
  const host = url.hostname.replace(/\.$/, "");
  const why = `hosted.endpoint must be a public host; ${url.hostname} is`;
  if (host.startsWith("[")) {
    const ip = parseIpv6(host.slice(1, -1));
    if (!ip) return `${why} not an IPv6 address this registry understands`;
    const reason = privateIpv6(ip);
    return reason ? `${why} ${reason}` : undefined;
  }
  const v4 = parseIpv4(host);
  if (v4) {
    const reason = privateIpv4(v4);
    return reason ? `${why} ${reason}` : undefined;
  }
  if (host === "localhost" || LOCAL_SUFFIXES.some((s) => host.endsWith(s))) return `${why} a local name`;
  if (!host.includes(".")) return `${why} a single-label (intranet) name`;
  return undefined;
}

function parseIpv4(host: string): number[] | undefined {
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return undefined;
  return parts.map(Number);
}

function privateIpv4([a, b, c]: number[]): string | undefined {
  if (a === 0) return "in 0.0.0.0/8 (this network)";
  if (a === 10) return "private (10.0.0.0/8)";
  if (a === 100 && b! >= 64 && b! <= 127) return "carrier-grade NAT (100.64.0.0/10)";
  if (a === 127) return "loopback (127.0.0.0/8)";
  if (a === 169 && b === 254) return "link-local (169.254.0.0/16)";
  if (a === 172 && b! >= 16 && b! <= 31) return "private (172.16.0.0/12)";
  if (a === 192 && b === 0 && c === 0) return "reserved (192.0.0.0/24)";
  if (a === 192 && b === 168) return "private (192.168.0.0/16)";
  if (a === 198 && (b === 18 || b === 19)) return "a benchmarking network (198.18.0.0/15)";
  if (a! >= 224) return "multicast or reserved (224.0.0.0/3)";
  return undefined;
}

/** Eight 16-bit groups, or undefined. Accepts the forms URL parsing produces (and a trailing dotted IPv4). */
export function parseIpv6(text: string): number[] | undefined {
  let s = text.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  const tail: number[] = [];
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (dotted) {
    const v4 = parseIpv4(dotted[1]!);
    if (!v4) return undefined;
    tail.push((v4[0]! << 8) | v4[1]!, (v4[2]! << 8) | v4[3]!);
    s = s.slice(0, -dotted[1]!.length);
    if (s.endsWith(":") && !s.endsWith("::")) s = s.slice(0, -1);
  }
  const halves = s.split("::");
  if (halves.length > 2) return undefined;
  const group = (h: string) => (h ? h.split(":") : []);
  const head = group(halves[0]!);
  const rest = halves.length === 2 ? group(halves[1]!) : [];
  if (![...head, ...rest].every((g) => /^[0-9a-f]{1,4}$/.test(g))) return undefined;
  const explicit = head.length + rest.length + tail.length;
  if (halves.length === 1 ? explicit !== 8 : explicit > 7) return undefined;
  const zeros = new Array<number>(8 - explicit).fill(0);
  return [...head.map((g) => parseInt(g, 16)), ...(halves.length === 2 ? zeros : []), ...rest.map((g) => parseInt(g, 16)), ...tail];
}

function privateIpv6(g: number[]): string | undefined {
  const embedded = () => [g[6]! >> 8, g[6]! & 255, g[7]! >> 8, g[7]! & 255];
  if (g.every((x) => x === 0)) return "the unspecified address (::)";
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return "loopback (::1)";
  // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (IPv4-compatible): judge the IPv4 address.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    const r = privateIpv4(embedded());
    return r ? `an IPv4-mapped address that is ${r}` : g[5] === 0 ? "an IPv4-compatible address (::/96)" : undefined;
  }
  // 64:ff9b::/96 (NAT64): the IPv4 address inside.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    const r = privateIpv4(embedded());
    return r ? `a NAT64 address of one that is ${r}` : undefined;
  }
  if ((g[0]! & 0xfe00) === 0xfc00) return "unique local (fc00::/7)";
  if ((g[0]! & 0xffc0) === 0xfe80) return "link-local (fe80::/10)";
  if ((g[0]! & 0xffc0) === 0xfec0) return "site-local (fec0::/10)";
  if ((g[0]! & 0xff00) === 0xff00) return "multicast (ff00::/8)";
  if (g[0] === 0x2001 && g[1] === 0x0db8) return "documentation (2001:db8::/32)";
  return undefined;
}
