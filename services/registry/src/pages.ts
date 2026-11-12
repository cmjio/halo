/**
 * Package pages (HTML): the home page with search and recent packages, and a page per package
 * and per version. Plain, accessible, dark-mode aware, with no external assets. Every value
 * from a package is escaped; READMEs go through the safe renderer in markdown.ts.
 */

import type { PackageSummary, VersionDoc } from "../../../src/registry/contract.ts";
import type { Ctx, Env } from "./env.ts";
import { cached, PAGE_HEADERS } from "./http.ts";
import { escapeHtml as e, renderMarkdown } from "./markdown.ts";
import { loadPackage, packageRevision, recentPackages, searchPackages, type PackageView } from "./packages.ts";

const CSS = `
:root { color-scheme: light dark; --bg: #fff; --fg: #1c1c1f; --muted: #5f6068; --line: #e2e2e6; --code: #f4f4f6; --accent: #4b3fd8; --warn: #9a5b00; --bad: #b3261e; --ok: #1d7a3a; }
@media (prefers-color-scheme: dark) { :root { --bg: #131316; --fg: #ececf0; --muted: #a0a0aa; --line: #2c2c33; --code: #1d1d22; --accent: #a79dff; --warn: #f0b04a; --bad: #ff8a80; --ok: #6fd28a; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: var(--accent); }
header.site, main, footer { max-width: 60rem; margin: 0 auto; padding: 0 1rem; }
header.site { display: flex; gap: 1rem; align-items: center; justify-content: space-between; padding-top: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
header.site a.brand { font-weight: 700; text-decoration: none; color: var(--fg); }
form.search { display: flex; gap: .5rem; flex: 1; max-width: 28rem; }
form.search input { flex: 1; min-width: 0; padding: .45rem .6rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); font: inherit; }
form.search button { padding: .45rem .8rem; border: 1px solid var(--line); border-radius: 6px; background: var(--code); color: var(--fg); font: inherit; cursor: pointer; }
main { padding-top: 1.5rem; padding-bottom: 3rem; }
h1 { font-size: 1.7rem; margin: 0 0 .25rem; overflow-wrap: anywhere; }
h2 { font-size: 1.15rem; margin: 2rem 0 .6rem; padding-bottom: .3rem; border-bottom: 1px solid var(--line); }
.lead { color: var(--muted); margin: 0 0 1rem; }
.badge { display: inline-block; font-size: .78rem; padding: .1rem .5rem; border-radius: 99px; border: 1px solid var(--line); margin-right: .35rem; vertical-align: middle; }
.badge.verified { color: var(--ok); border-color: currentColor; }
.badge.hosted { color: var(--accent); border-color: currentColor; }
.badge.warn { color: var(--warn); border-color: currentColor; }
.badge.bad { color: var(--bad); border-color: currentColor; }
pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .9em; }
code { background: var(--code); padding: .1em .3em; border-radius: 4px; }
pre { background: var(--code); padding: .8rem 1rem; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) 17rem; gap: 2rem; }
@media (max-width: 760px) { .grid { grid-template-columns: minmax(0, 1fr); } }
aside dl { margin: 0; }
aside dt { color: var(--muted); font-size: .85rem; margin-top: .8rem; }
aside dd { margin: 0; overflow-wrap: anywhere; }
ul.plain { list-style: none; padding: 0; margin: 0; }
ul.plain li { padding: .15rem 0; }
.perm { border: 1px solid var(--line); border-radius: 8px; padding: .4rem 1rem; }
.perm dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .3rem 1rem; }
.perm dt { color: var(--muted); }
.perm dd { margin: 0; overflow-wrap: anywhere; }
.readme img { max-width: 100%; }
.readme table { border-collapse: collapse; }
.readme th, .readme td { border: 1px solid var(--line); padding: .3rem .6rem; }
.readme blockquote { margin: 0; padding-left: 1rem; border-left: 3px solid var(--line); color: var(--muted); }
table.versions { border-collapse: collapse; width: 100%; }
table.versions td, table.versions th { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
.results li { padding: .8rem 0; border-bottom: 1px solid var(--line); }
.results .name { font-weight: 600; font-size: 1.05rem; }
.muted { color: var(--muted); }
footer { color: var(--muted); font-size: .85rem; padding-bottom: 2rem; }
`;

function layout(title: string, body: string, q = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="site">
  <a class="brand" href="/">Halo packages</a>
  <form class="search" action="/" method="get" role="search">
    <label for="q" class="muted" hidden>Search packages</label>
    <input id="q" name="q" type="search" placeholder="Search packages" value="${e(q)}" aria-label="Search packages">
    <button type="submit">Search</button>
  </form>
</header>
<main>
${body}
</main>
<footer>The Halo package registry. <a href="https://halolang.com">halolang.com</a></footer>
</body>
</html>`;
}

// The router adds PAGE_HEADERS to every HTML response on the way out too (cache hits included).
const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...PAGE_HEADERS } });

function summaryList(items: PackageSummary[]): string {
  if (!items.length) return `<p class="muted">No packages yet.</p>`;
  return `<ul class="plain results">${items
    .map(
      (p) => `<li><a class="name" href="/${e(p.name)}">${e(p.name)}</a> <span class="muted">${e(p.latest)}</span>
  ${p.verified ? `<span class="badge verified" title="The scope's owner verified ${e(p.verified)}">verified: ${e(p.verified)}</span>` : ""}
  <div>${e(p.description)}</div>
  ${p.keywords?.length ? `<div class="muted">${p.keywords.map((k) => e(k)).join(" · ")}</div>` : ""}</li>`,
    )
    .join("")}</ul>`;
}

export async function homePage(url: URL, env: Env): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q) {
    const { results, total } = await searchPackages(env, q, 50, 0);
    return html(layout(`${q} · Halo packages`, `<h1>Search: ${e(q)}</h1><p class="lead">${total} package${total === 1 ? "" : "s"}</p>${summaryList(results)}`, q));
  }
  return cached(env, "", async () => {
    const recent = await recentPackages(env, 20);
    return html(
      layout(
        "Halo packages",
        `<h1>Halo packages</h1>
<p class="lead">Tools, agents, pipelines, policies and schemas to <code>use</code> in your Halo programs.</p>
<pre><code>halo add @scope/name</code></pre>
<h2>Recently updated</h2>
${summaryList(recent)}`,
      ),
    );
  });
}

export async function packagePage(env: Env, ctx: Ctx | undefined, name: string, version?: string): Promise<Response> {
  // Keyed by the package's revision, so a yank or deprecation shows at once in every colo.
  const revision = await packageRevision(env, name, ctx);
  if (revision === undefined) return notFound(`No package ${name}`);
  return cached(
    env,
    version ? `${name}/v/${version}` : name,
    async () => {
      const view = await loadPackage(env, name);
      if (!view) return notFound(`No package ${name}`);
      const v = version ?? view.doc.distTags.latest;
      const doc = v ? view.doc.versions[v] : undefined;
      if (!doc) return notFound(`${name} has no version ${version}`);
      return html(layout(`${name}${version ? `@${version}` : ""} · Halo packages`, renderPackage(view, doc, !!version)));
    },
    { revision },
  );
}

function notFound(message: string): Response {
  return html(layout("Not found · Halo packages", `<h1>Not found</h1><p>${e(message)}</p>`), 404);
}

function exampleUse(name: string, v: VersionDoc): string {
  const x = v.exports;
  const names = [...x.pipelines, ...x.agents, ...x.tools, ...x.providers, ...x.schemas, ...x.policies, ...x.stores].slice(0, 4);
  const slots = Object.entries(v.models);
  const withModels = slots.length ? ` with models(${slots.map(([s, m]) => `${s}: ${m.suggested ?? "<model>"}`).join(", ")})` : "";
  return `use "${name}" { ${names.length ? names.join(", ") : "…"} }${withModels}`;
}

function list(items: string[], empty = "none"): string {
  return items.length ? items.map((i) => `<code>${e(i)}</code>`).join(", ") : `<span class="muted">${empty}</span>`;
}

function renderPackage(view: PackageView, v: VersionDoc, pinned: boolean): string {
  const d = view.doc;
  const latest = d.distTags.latest;
  const hostedHost = v.hosted ? new URL(v.hosted.endpoint).host : undefined;
  const p = v.permissions;
  const parts: string[] = [];

  parts.push(`<h1>${e(d.name)}</h1>
<p class="lead">${e(d.description)}</p>
<p>
  <span class="badge">v${e(v.version)}${v.version === latest ? " · latest" : ""}</span>
  ${d.verified ? `<span class="badge verified" title="The scope's owner verified this domain with a DNS record">verified: ${e(d.verified)}</span>` : ""}
  ${hostedHost ? `<span class="badge hosted">Hosted by ${e(hostedHost)}</span>` : ""}
  ${v.yanked !== undefined ? `<span class="badge bad">yanked: ${e(v.yanked)}</span>` : ""}
  ${v.deprecated ? `<span class="badge warn">deprecated: ${e(v.deprecated)}</span>` : ""}
</p>
${v.version !== latest && latest ? `<p class="muted">This is an older or pre-release version. The latest is <a href="/${e(d.name)}">${e(latest)}</a>.</p>` : ""}
<h2 id="install">Install</h2>
<pre><code>halo add ${e(d.name)}${pinned ? `@${e(v.version)}` : ""}</code></pre>
<pre><code>${e(exampleUse(d.name, v))}</code></pre>
<h2 id="permissions">Permissions</h2>
<div class="perm"><dl>
  <dt>Network</dt><dd>${list(p.network, "none declared")}</dd>
  <dt>Reads env</dt><dd>${list(p.env, "nothing")}</dd>
  <dt>Starts</dt><dd>${list(p.spawn, "nothing")}</dd>
  <dt>Runs its own code</dt><dd>${p.code ? "<strong>yes</strong> (installing needs <code>--trust</code>)" : "no"}</dd>
  ${p.hosted.length ? `<dt>Sends your inputs to</dt><dd>${list(p.hosted)} <span class="muted">(hosted pipelines run there, on the publisher's models)</span></dd>` : ""}
</dl></div>`);

  const x = v.exports;
  const kinds: [string, string[]][] = [
    ["Pipelines", x.pipelines],
    ["Agents", x.agents],
    ["Tools", x.tools],
    ["Providers", x.providers],
    ["Schemas", x.schemas],
    ["Policies", x.policies],
    ["Stores", x.stores],
    ["Skills", x.skills],
  ];
  const hostedSet = new Set(v.hosted?.pipelines ?? []);
  const shown = kinds.filter(([, items]) => items.length);
  parts.push(`<div class="grid"><div>`);
  parts.push(`<h2 id="readme">README</h2><div class="readme">${renderMarkdown(view.readmes[v.version] ?? "")}</div>`);
  parts.push(`<h2 id="versions">Versions</h2>
<table class="versions"><thead><tr><th scope="col">Version</th><th scope="col">Published</th><th scope="col">Notes</th></tr></thead><tbody>
${Object.values(d.versions)
  .map((ver) => {
    const tags = Object.entries(d.distTags)
      .filter(([, tv]) => tv === ver.version)
      .map(([t]) => `<span class="badge">${e(t)}</span>`)
      .join("");
    const notes = [ver.yanked !== undefined ? `<span class="badge bad">yanked</span> ${e(ver.yanked)}` : "", ver.deprecated ? `<span class="badge warn">deprecated</span> ${e(ver.deprecated)}` : ""].filter(Boolean).join(" ");
    return `<tr><td><a href="/${e(d.name)}/v/${e(ver.version)}">${e(ver.version)}</a> ${tags}</td><td>${e(ver.publishedAt.slice(0, 10))}${ver.publishedBy ? ` by @${e(ver.publishedBy)}` : ""}</td><td>${notes}</td></tr>`;
  })
  .join("\n")}
</tbody></table>`);
  parts.push(`</div><aside>`);
  parts.push(`<h2 id="exports">Exports</h2>${
    shown.length
      ? `<dl>${shown.map(([kind, items]) => `<dt>${kind}</dt><dd>${items.map((i) => `<code>${e(i)}</code>${hostedSet.has(i) ? ` <span class="badge hosted">hosted</span>` : ""}`).join(", ")}</dd>`).join("")}</dl>`
      : `<p class="muted">Nothing exported.</p>`
  }`);
  const slots = Object.entries(v.models);
  if (slots.length)
    parts.push(
      `<h2 id="models">Model slots</h2><dl>${slots
        .map(([slot, m]) => `<dt><code>models.${e(slot)}</code></dt><dd>${e(m.description)}${m.suggested ? `<br><span class="muted">Suggested:</span> <code>${e(m.suggested)}</code>` : ""}</dd>`)
        .join("")}</dl>`,
    );
  const deps = Object.entries(v.dependencies);
  parts.push(
    `<h2 id="dependencies">Dependencies</h2>${
      deps.length ? `<ul class="plain">${deps.map(([n, r]) => `<li><a href="/${e(n)}">${e(n)}</a> <code>${e(r)}</code></li>`).join("")}</ul>` : `<p class="muted">None.</p>`
    }`,
  );
  parts.push(`<h2 id="details">Details</h2><dl>
  ${d.license ? `<dt>License</dt><dd>${e(d.license)}</dd>` : ""}
  ${d.repository ? `<dt>Repository</dt><dd>${link(d.repository)}</dd>` : ""}
  ${d.homepage ? `<dt>Homepage</dt><dd>${link(d.homepage)}</dd>` : ""}
  ${v.halo ? `<dt>Halo</dt><dd><code>${e(v.halo)}</code></dd>` : ""}
  <dt>Downloads</dt><dd>${view.downloads}</dd>
  <dt>sha256</dt><dd><code>${e(v.sha256)}</code></dd>
  <dt>Size</dt><dd>${(v.size / 1024).toFixed(1)} KB</dd>
</dl>`);
  parts.push(`</aside></div>`);
  return parts.join("\n");
}

function link(url: string): string {
  return /^https?:\/\//i.test(url) ? `<a href="${e(url)}" rel="nofollow noopener ugc">${e(url)}</a>` : e(url);
}
