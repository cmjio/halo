/**
 * The registry's HTML pages: the home page, browse and search (filtered by what packages export),
 * a page per publisher scope, and a page per package and version.
 *
 * What a package can do comes first on its page: the registry works out the hosts, env vars,
 * processes and code from the source at publish time, so the page states facts rather than claims.
 *
 * The pages have no scripts, no external assets and one inline <style> (see the CSP in http.ts),
 * so tabs are in-page links and copying is `user-select: all`. Every value from a package is
 * escaped; READMEs go through the safe renderer in markdown.ts.
 */

import type { PackageStats, VersionDoc } from "../../../src/registry/contract.ts";
import { isScopeName } from "./auth.ts";
import type { Ctx, Env } from "./env.ts";
import { cached, PAGE_HEADERS } from "./http.ts";
import { escapeHtml as e, renderMarkdown } from "./markdown.ts";
import {
  browsePackages,
  EXPORT_KINDS,
  isExportKind,
  loadPackage,
  packageRevision,
  registryTotals,
  type BrowseOptions,
  type BrowseResult,
  type BrowseSort,
  type ExportKind,
  type PackageCard,
  type PackageView,
} from "./packages.ts";
import { scopeDoc } from "./scopes.ts";
import { packageStats } from "./stats.ts";

// Colours follow halolang.com: amber brand, and its read / write / external effect colours.
const CSS = `
:root { color-scheme: light dark;
  --bg: #fbfaf7; --panel: #fff; --fg: #1b1d21; --muted: #62666f; --line: #e4e1da; --soft: #f3f0ea; --code: #f3f0ea;
  --brand: #a3650a; --brand-soft: rgb(185 119 14 / .12); --read: #1a7f52; --write: #9a5f08; --external: #c9372c;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --brand-2: #d0561f; --glow: rgb(214 140 30 / .16); --glow-2: rgb(214 140 30 / .07); --dots: rgb(80 60 20 / .16); --shadow: rgb(60 40 10 / .35); }
@media (prefers-color-scheme: dark) { :root {
  --bg: #0e1013; --panel: #14171c; --fg: #e9eaee; --muted: #9aa0ab; --line: #262c35; --soft: #1a1e25; --code: #0b0d10;
  --brand: #f3b44c; --brand-soft: rgb(243 180 76 / .13); --read: #56d39a; --write: #f3b44c; --external: #ff7b72;
  --brand-2: #ff8a4c; --glow: rgb(243 180 76 / .14); --glow-2: rgb(255 138 76 / .06); --dots: rgb(255 255 255 / .07); --shadow: rgb(0 0 0 / .8); } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: var(--brand); text-underline-offset: 2px; }
.wrap { max-width: 72rem; margin: 0 auto; padding: 0 1rem; }
header.site { border-bottom: 1px solid var(--line); background: var(--panel); }
header.site .wrap { display: flex; gap: 1rem; align-items: center; padding-top: .7rem; padding-bottom: .7rem; flex-wrap: wrap; }
a.brand { display: inline-flex; gap: .5rem; align-items: center; font: 600 1rem/1 var(--mono); color: var(--fg); text-decoration: none; letter-spacing: -.02em; }
a.brand svg { width: 1.4rem; height: 1.4rem; color: var(--brand); }
a.brand span { color: var(--muted); font-weight: 500; }
form.search { display: flex; flex: 1; min-width: 14rem; max-width: 34rem; margin-left: auto; }
form.search input { flex: 1; min-width: 0; padding: .5rem .75rem; border: 1px solid var(--line); border-right: 0; border-radius: 8px 0 0 8px; background: var(--bg); color: var(--fg); font: inherit; }
form.search input:focus { outline: 2px solid var(--brand); outline-offset: -1px; }
form.search button { padding: .5rem .9rem; border: 1px solid var(--line); border-radius: 0 8px 8px 0; background: var(--soft); color: var(--fg); font: inherit; cursor: pointer; }
nav.top a { color: var(--muted); text-decoration: none; font-size: .92rem; }
nav.top a:hover { color: var(--fg); }
main.wrap { padding-top: 1.75rem; padding-bottom: 4rem; }
h1 { font-size: 1.85rem; line-height: 1.2; margin: 0 0 .4rem; letter-spacing: -.02em; overflow-wrap: anywhere; }
h2 { font-size: 1.1rem; margin: 2.25rem 0 .75rem; scroll-margin-top: 4rem; }
h3 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 1.5rem 0 .5rem; }
.lead { color: var(--muted); font-size: 1.05rem; margin: 0 0 1rem; max-width: 46rem; }
.muted { color: var(--muted); }
.small { font-size: .85rem; }
code, pre, .mono { font-family: var(--mono); font-size: .88em; }
code { background: var(--code); padding: .1em .35em; border-radius: 5px; }
pre { background: var(--code); border: 1px solid var(--line); padding: .8rem 1rem; border-radius: 10px; overflow-x: auto; }
pre code { background: none; padding: 0; }
.badge { display: inline-flex; gap: .3rem; align-items: center; font-size: .78rem; line-height: 1.5; padding: .05rem .55rem; border-radius: 99px; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; vertical-align: middle; }
.badge.verified { color: var(--read); border-color: currentColor; }
.badge.hosted { color: var(--brand); border-color: currentColor; background: var(--brand-soft); }
.badge.warn { color: var(--write); border-color: currentColor; }
.badge.bad { color: var(--external); border-color: currentColor; }
.badges { display: flex; flex-wrap: wrap; gap: .4rem; margin: .6rem 0; }

/* Home */
body { overflow-x: clip; }
.hero, .band { position: relative; isolation: isolate; width: 100vw; margin: -1.75rem 0 0 calc(50% - 50vw); padding: 4.5rem 0 3.5rem; border-bottom: 1px solid var(--line); overflow: hidden;
  background: radial-gradient(60rem 28rem at 78% 40%, var(--glow), transparent 70%), radial-gradient(40rem 22rem at 5% 0%, var(--glow-2), transparent 70%); }
.band { padding: 2.25rem 0 2rem; margin-bottom: 1.5rem; }
.band-in { max-width: 72rem; margin: 0 auto; padding: 0 1rem; }
.band h1 { font-size: clamp(1.9rem, 4vw, 2.7rem); line-height: 1.1; letter-spacing: -.04em; margin: .9rem 0 .5rem; }
.band h1.mono, .band .pkg-head h1 { font-family: var(--mono); letter-spacing: -.05em; }
.band h1 .nm, .band h1 .grad { background: linear-gradient(100deg, var(--brand) 10%, var(--brand-2) 90%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.band .lead { font-size: 1.08rem; }
.band .crumbs { margin: 0; }
.hero::before, .band::before { content: ""; position: absolute; inset: 0; z-index: -1; background-image: radial-gradient(var(--dots) 1px, transparent 1.2px); background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(ellipse 70% 80% at 60% 45%, #000 20%, transparent 75%); mask-image: radial-gradient(ellipse 70% 80% at 60% 45%, #000 20%, transparent 75%); }
.hero-in { max-width: 72rem; margin: 0 auto; padding: 0 1rem; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 2rem; align-items: center; }
.eyebrow { display: inline-flex; gap: .55rem; align-items: center; padding: .28rem .8rem .28rem .6rem; border: 1px solid var(--line); border-radius: 99px; background: color-mix(in srgb, var(--panel) 75%, transparent); font-size: .82rem; color: var(--muted); backdrop-filter: blur(6px); }
.eyebrow i { width: .5rem; height: .5rem; border-radius: 50%; background: var(--read); box-shadow: 0 0 0 3px color-mix(in srgb, var(--read) 25%, transparent); }
.eyebrow b { color: var(--fg); font-weight: 600; }
.hero h1 { font-size: clamp(2.4rem, 5.6vw, 4.1rem); line-height: 1.02; letter-spacing: -.045em; margin: 1.1rem 0 1rem; font-weight: 700; }
.hero h1 em { font-style: normal; font-family: var(--mono); letter-spacing: -.06em; background: linear-gradient(100deg, var(--brand) 10%, var(--brand-2) 90%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.hero .lead { font-size: 1.12rem; max-width: 34rem; }
.term { max-width: 34rem; margin: 1.6rem 0 0; border: 1px solid var(--line); border-radius: 12px; background: var(--code); box-shadow: 0 18px 50px -24px var(--shadow), 0 0 0 1px color-mix(in srgb, var(--brand) 8%, transparent); overflow: hidden; }
.term .bar { display: flex; gap: .4rem; align-items: center; padding: .55rem .8rem; border-bottom: 1px solid var(--line); font-size: .75rem; color: var(--muted); }
.term .bar i { width: .6rem; height: .6rem; border-radius: 50%; background: var(--line); }
.term .bar span { margin-left: .5rem; font-family: var(--mono); }
.term pre { margin: 0; border: 0; border-radius: 0; background: none; padding: .85rem 1rem 1rem; font-size: .9rem; line-height: 1.75; }
.term .p { color: var(--brand); user-select: none; -webkit-user-select: none; }
.term .c { color: var(--muted); }
.term .s { color: var(--read); }
.term .k { color: var(--external); }
.term .cmd { user-select: all; -webkit-user-select: all; }
.stats { display: flex; flex-wrap: wrap; gap: .4rem 1.6rem; margin-top: 1.5rem; }
.stats div { font-size: .82rem; color: var(--muted); }
.stats b { display: block; font: 600 1.35rem/1.2 var(--mono); color: var(--fg); letter-spacing: -.03em; }
.spot { position: relative; justify-self: end; width: 100%; max-width: 27rem; margin-top: 3.5rem; }
.spot .under { position: absolute; left: 1.2rem; right: 1.2rem; height: 100%; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); padding: .5rem 1.1rem; font: 500 .8rem var(--mono); color: var(--muted); }
.spot .under.u1 { top: -3.6rem; transform: scale(.9); transform-origin: top; opacity: .5; }
.spot .under.u2 { top: -1.85rem; transform: scale(.95); transform-origin: top; opacity: .8; }
.spot .top { position: relative; border: 1px solid color-mix(in srgb, var(--brand) 35%, var(--line)); border-radius: 14px; background: var(--panel); box-shadow: 0 30px 60px -30px var(--shadow), 0 0 0 4px var(--brand-soft); overflow: hidden; }
.spot .top header { padding: 1rem 1.1rem .8rem; border-bottom: 1px solid var(--line); }
.spot .label { font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; color: var(--brand); font-weight: 600; }
.spot a.name { display: block; margin: .3rem 0 .2rem; font: 600 1.1rem/1.3 var(--mono); color: var(--fg); text-decoration: none; overflow-wrap: anywhere; }
.spot a.name .scope { color: var(--muted); font-weight: 500; }
.spot p { margin: 0; font-size: .9rem; color: var(--muted); }
.spot .kinds { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .7rem; }
.spot .kinds span { font: .75rem var(--mono); padding: .1rem .5rem; border-radius: 6px; background: var(--soft); color: var(--fg); }
.spot ul { list-style: none; margin: 0; padding: .4rem 0; }
.spot li { display: grid; grid-template-columns: .7rem minmax(0, 1fr); gap: .7rem; align-items: center; padding: .45rem 1.1rem; font-size: .88rem; }
.spot li i { width: .55rem; height: .55rem; border-radius: 50%; background: currentColor; }
.spot li.read { color: var(--read); } .spot li.write { color: var(--write); } .spot li.external { color: var(--external); }
.spot li span { color: var(--fg); }
.spot li.no span { color: var(--muted); }
.spot footer { display: flex; justify-content: space-between; gap: .5rem; padding: .7rem 1.1rem; border-top: 1px solid var(--line); background: var(--soft); font-size: .8rem; color: var(--muted); }
.trust { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .9rem; margin: 2rem 0 .5rem; }
.trust div { border: 1px solid var(--line); background: var(--panel); border-radius: 12px; padding: 1rem 1.1rem; font-size: .9rem; }
.trust svg { width: 1.6rem; height: 1.6rem; color: var(--brand); margin-bottom: .4rem; }
.trust b { display: block; margin-bottom: .2rem; }
.chips { display: flex; flex-wrap: wrap; gap: .45rem; margin: 1.5rem 0 0; }
.chip { display: inline-flex; gap: .4rem; align-items: baseline; padding: .3rem .75rem; border: 1px solid var(--line); border-radius: 99px; background: var(--panel); color: var(--fg); text-decoration: none; font-size: .9rem; }
.chip:hover { border-color: var(--brand); }
.chip[aria-current] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.chip .n { color: var(--muted); font-size: .8rem; }
.chip[aria-current] .n { color: inherit; opacity: .7; }
.shelf-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
.shelf-head h2 { margin-bottom: .75rem; }

/* Cards */
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: .9rem; list-style: none; padding: 0; margin: 0; }
.card { position: relative; display: flex; flex-direction: column; gap: .45rem; border: 1px solid var(--line); background: var(--panel); border-radius: 12px; padding: 1rem 1.1rem; min-width: 0; }
.card:hover { border-color: var(--brand); }
.card a.name { font: 600 .98rem/1.3 var(--mono); color: var(--fg); text-decoration: none; overflow-wrap: anywhere; }
.card a.name::after { content: ""; position: absolute; inset: 0; border-radius: 12px; }
.card a.name .scope { color: var(--muted); font-weight: 500; }
.card .desc { margin: 0; font-size: .92rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card .kinds { font-size: .8rem; color: var(--muted); font-family: var(--mono); }
.card .foot { margin-top: auto; display: flex; flex-wrap: wrap; gap: .35rem .5rem; align-items: center; font-size: .8rem; color: var(--muted); padding-top: .35rem; }
.card .foot .badge { position: relative; }
.card .ver { position: absolute; top: 1rem; right: 1.1rem; font: .78rem var(--mono); color: var(--muted); }
.card .head { padding-right: 4rem; }
.empty { border: 1px dashed var(--line); border-radius: 12px; padding: 2rem; text-align: center; color: var(--muted); }

/* Browse */
.browse { display: grid; grid-template-columns: 14rem minmax(0, 1fr); gap: 2rem; }
.facets h3:first-child { margin-top: .25rem; }
.facets ul { list-style: none; padding: 0; margin: 0; }
.facets a { display: flex; justify-content: space-between; gap: .5rem; padding: .3rem .6rem; border-radius: 7px; color: var(--fg); text-decoration: none; font-size: .92rem; }
.facets a:hover { background: var(--soft); }
.facets a[aria-current] { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
.facets .n { color: var(--muted); font-size: .82rem; font-weight: 400; }
.toolbar { display: flex; flex-wrap: wrap; gap: .5rem 1rem; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; }
.toolbar h1 { font-size: 1.4rem; margin: 0; }
.sort { font-size: .88rem; color: var(--muted); }
.sort a { color: var(--muted); margin-left: .5rem; }
.sort a[aria-current] { color: var(--fg); font-weight: 600; text-decoration: none; }
.pager { display: flex; justify-content: space-between; margin-top: 1.5rem; }

/* Package */
.crumbs { font-size: .88rem; color: var(--muted); margin-bottom: .75rem; }
.crumbs a { color: var(--muted); }
.pkg-head { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 2.5rem; align-items: center; }
.pkg-head h1 .scope, .band h1 .scope { color: var(--muted); font-weight: 500; -webkit-text-fill-color: currentColor; }
.meta { display: flex; flex-wrap: wrap; gap: .25rem 1rem; font-size: .88rem; color: var(--muted); }
.install { border: 1px solid color-mix(in srgb, var(--brand) 30%, var(--line)); background: var(--code); border-radius: 12px; overflow: hidden; box-shadow: 0 24px 50px -28px var(--shadow), 0 0 0 4px var(--brand-soft); }
.install h2 { display: flex; gap: .4rem; align-items: center; margin: 0; padding: .55rem .8rem; border-bottom: 1px solid var(--line); font: 500 .75rem var(--mono); text-transform: none; letter-spacing: 0; color: var(--muted); }
.install h2 i { width: .6rem; height: .6rem; border-radius: 50%; background: var(--line); }
.install h2 i:last-of-type { margin-right: .5rem; }
.install pre { margin: 0; border: 0; border-radius: 0; background: none; padding: .7rem 1rem 0; font-size: .85rem; line-height: 1.7; user-select: all; -webkit-user-select: all; white-space: pre-wrap; overflow-wrap: anywhere; }
.install pre:last-of-type { padding-bottom: .8rem; }
.install pre.cmd::before { content: "$ "; color: var(--brand); user-select: none; -webkit-user-select: none; }
.install pre:not(.cmd) { color: var(--muted); }
.install p { margin: 0; padding: .6rem 1rem; border-top: 1px solid var(--line); font-size: .82rem; color: var(--muted); background: var(--panel); }
nav.tabs { position: sticky; top: 0; z-index: 1; background: var(--bg); border-bottom: 1px solid var(--line); margin-bottom: .5rem; overflow-x: auto; white-space: nowrap; }
nav.tabs a { display: inline-block; padding: .7rem .1rem; margin-right: 1.2rem; color: var(--muted); text-decoration: none; font-size: .92rem; border-bottom: 2px solid transparent; }
nav.tabs a:hover { color: var(--fg); border-bottom-color: var(--line); }
nav.tabs .n { font-size: .78rem; margin-left: .25rem; }
.pkg { display: grid; grid-template-columns: minmax(0, 1fr) 17rem; gap: 2.5rem; }
.pkg aside h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 1.6rem 0 .5rem; }
.pkg aside dl { margin: 0; display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .35rem .9rem; font-size: .9rem; }
.pkg aside dt { color: var(--muted); }
.pkg aside dd { margin: 0; overflow-wrap: anywhere; }
ul.plain { list-style: none; padding: 0; margin: 0; }
ul.plain li { padding: .2rem 0; overflow-wrap: anywhere; }

/* What it can do */
.perm { border: 1px solid var(--line); background: var(--panel); border-radius: 12px; overflow: hidden; }
.perm .row { display: grid; grid-template-columns: 1.6rem minmax(0, 1fr) auto; gap: .2rem .7rem; padding: .8rem 1rem; border-top: 1px solid var(--line); align-items: start; }
.perm .row:first-child { border-top: 0; }
.perm .dot { width: .7rem; height: .7rem; border-radius: 50%; margin: .45rem 0 0 .3rem; background: currentColor; }
.perm .read { color: var(--read); } .perm .write { color: var(--write); } .perm .external { color: var(--external); }
.perm .what b { display: block; color: var(--fg); }
.perm .what .vals { color: var(--fg); font-size: .9rem; overflow-wrap: anywhere; }
.perm .what .why { color: var(--muted); font-size: .85rem; }
.perm .level { font-size: .76rem; padding: .05rem .5rem; border-radius: 99px; border: 1px solid currentColor; white-space: nowrap; }
.perm .cant { padding: .8rem 1rem; border-top: 1px solid var(--line); background: var(--soft); font-size: .9rem; }
.perm .cant ul { margin: .3rem 0 0; padding-left: 1.2rem; color: var(--muted); }
.perm .none { padding: .9rem 1rem; color: var(--read); }
.note { font-size: .82rem; color: var(--muted); margin: .5rem 0 0; }
.slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: .7rem; }
.slot { border: 1px solid var(--line); background: var(--panel); border-radius: 10px; padding: .75rem .9rem; font-size: .9rem; }
.slot code { font-weight: 600; }
.slot p { margin: .3rem 0 0; }
.exports { border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
.exports section { padding: .6rem 1rem .8rem; border-top: 1px solid var(--line); }
.exports section:first-child { border-top: 0; }
.exports h3 { margin: .3rem 0 .4rem; }
.exports li { padding: .25rem 0; }
.exports .sig { font-family: var(--mono); font-size: .85rem; overflow-wrap: anywhere; }
.exports .fx { font-size: .82rem; color: var(--muted); }
.checks li { display: flex; gap: .5rem; align-items: baseline; font-size: .9rem; }
.checks .y { color: var(--read); } .checks .n { color: var(--muted); }
.readme { overflow-wrap: anywhere; }
.readme img { max-width: 100%; }
.readme table { border-collapse: collapse; display: block; overflow-x: auto; }
.readme th, .readme td { border: 1px solid var(--line); padding: .3rem .6rem; }
.readme blockquote { margin: 0; padding-left: 1rem; border-left: 3px solid var(--line); color: var(--muted); }
.readme h1, .readme h2 { font-size: 1.2rem; }
table.versions { border-collapse: collapse; width: 100%; font-size: .9rem; }
table.versions td, table.versions th { text-align: left; padding: .45rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
table.versions th { color: var(--muted); font-weight: 500; font-size: .8rem; }
table.versions td.num, table.versions th.num { text-align: right; font-variant-numeric: tabular-nums; }
.wide-table { overflow-x: auto; }
svg.spark { display: block; width: 100%; height: 2.4rem; margin-top: .4rem; color: var(--brand); }
.notice { border: 1px solid currentColor; border-radius: 10px; padding: .6rem .9rem; margin: 1rem 0 0; font-size: .92rem; }
.notice.warn { color: var(--write); } .notice.bad { color: var(--external); }
.notice span { color: var(--fg); }
.scope-head { display: flex; gap: 1.25rem; align-items: center; margin-top: 1rem; }
.scope-head h1 { margin-top: 0; }
.avatar { flex: none; display: grid; place-items: center; width: 4.5rem; height: 4.5rem; border-radius: 18px; background: linear-gradient(135deg, var(--brand), var(--brand-2)); color: var(--bg); font: 700 1.9rem var(--mono); box-shadow: 0 18px 40px -20px var(--shadow), 0 0 0 4px var(--brand-soft); }
.band .stats { margin-top: 1.25rem; }
footer { border-top: 1px solid var(--line); color: var(--muted); font-size: .85rem; padding: 1.5rem 0 2.5rem; }
footer .wrap { display: flex; flex-wrap: wrap; gap: .5rem 1.5rem; justify-content: space-between; }

@media (max-width: 900px) {
  .hero-in, .pkg-head, .pkg { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
  .hero { padding: 3.25rem 0 2.25rem; }
  .band { padding: 1.75rem 0 1.5rem; }
  .spot { justify-self: stretch; max-width: none; margin-top: 5rem; }
  .trust { grid-template-columns: minmax(0, 1fr); }
  .browse { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
  .facets ul { display: flex; flex-wrap: wrap; gap: .3rem; }
  .facets a { border: 1px solid var(--line); border-radius: 99px; padding: .2rem .65rem; }
}
@media (max-width: 520px) { nav.top { display: none; } form.search { max-width: none; } .cards { grid-template-columns: minmax(0, 1fr); } }
`;

const MARK = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><ellipse cx="12" cy="12" rx="9.5" ry="4.2" stroke-width="2.2"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/></svg>`;

function layout(title: string, body: string, q = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Tools, agents, pipelines, policies and schemas to use in Halo programs.">
<title>${e(title)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="/">${MARK}halo <span>packages</span></a>
  <form class="search" action="/" method="get" role="search">
    <input id="q" name="q" type="search" placeholder="Search packages" value="${e(q)}" aria-label="Search packages">
    <button type="submit">Search</button>
  </form>
  <nav class="top" aria-label="Site"><a href="https://halolang.com/guide/tool-packages">Docs</a></nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap"><span>The Halo package registry</span><span><a href="https://halolang.com">halolang.com</a></span></div></footer>
</body>
</html>`;
}

// The router adds PAGE_HEADERS to every HTML response on the way out too (cache hits included).
const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...PAGE_HEADERS } });

const n = (x: number) => x.toLocaleString("en-US");
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;
const compact = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e4 ? `${Math.round(x / 1e3)}k` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}k` : String(x));

const KIND_LABEL: Record<ExportKind, [string, string]> = {
  pipelines: ["pipeline", "Pipelines"],
  agents: ["agent", "Agents"],
  tools: ["tool", "Tools"],
  providers: ["provider", "Providers"],
  schemas: ["schema", "Schemas"],
  policies: ["policy", "Policies"],
  stores: ["store", "Stores"],
  skills: ["skill", "Skills"],
};
const kindCount = (k: ExportKind, x: number) => plural(x, KIND_LABEL[k][0], k === "policies" ? "policies" : undefined);

function nameHtml(name: string): string {
  const slash = name.indexOf("/");
  return `<span class="scope">${e(name.slice(0, slash + 1))}</span><span class="nm">${e(name.slice(slash + 1))}</span>`;
}

// ── Cards ──

function card(p: PackageCard): string {
  const kinds = EXPORT_KINDS.filter((k) => p.exports[k]).map((k) => kindCount(k, p.exports[k]!));
  const foot: string[] = [];
  if (p.verified) foot.push(`<span class="badge verified" title="The publisher proved they control ${e(p.verified)}">✓ ${e(p.verified)}</span>`);
  if (p.hostedBy) foot.push(`<span class="badge hosted" title="Some pipelines run on the publisher's servers">Hosted by ${e(p.hostedBy)}</span>`);
  if (p.runsCode) foot.push(`<span class="badge warn" title="Installing needs --trust">Runs code</span>`);
  if (p.deprecated) foot.push(`<span class="badge warn">Deprecated</span>`);
  foot.push(`<span>${p.network ? plural(p.network, "host") : "No network"}</span>`);
  if (p.downloads) foot.push(`<span title="${n(p.downloads)} downloads">↓ ${compact(p.downloads)}</span>`);
  return `<li class="card">
  <div class="head"><a class="name" href="/${e(p.name)}">${nameHtml(p.name)}</a></div>
  <span class="ver">${e(p.latest)}</span>
  <p class="desc">${e(p.description)}</p>
  ${kinds.length ? `<div class="kinds">${kinds.join(" · ")}</div>` : ""}
  <div class="foot">${foot.join("")}</div>
</li>`;
}

const cards = (items: PackageCard[]) => `<ul class="cards">${items.map(card).join("")}</ul>`;

// ── Home and browse ──

interface BrowseParams {
  q: string;
  kind?: ExportKind;
  hosted: boolean;
  verified: boolean;
  sort?: BrowseSort;
  page: number;
}

const SORTS: [BrowseSort, string][] = [
  ["relevance", "Best match"],
  ["downloads", "Most installed"],
  ["updated", "Recently updated"],
  ["name", "Name"],
];

function readParams(url: URL): BrowseParams {
  const s = url.searchParams;
  const kind = s.get("kind") ?? "";
  const sort = s.get("sort") ?? "";
  const page = Number.parseInt(s.get("page") ?? "1", 10);
  return {
    q: (s.get("q") ?? "").trim().slice(0, 200),
    ...(isExportKind(kind) ? { kind } : {}),
    hosted: s.get("hosted") === "1",
    verified: s.get("verified") === "1",
    ...(SORTS.some(([k]) => k === sort) ? { sort: sort as BrowseSort } : {}),
    page: Number.isFinite(page) && page >= 1 && page <= 500 ? page : 1,
  };
}

function href(p: BrowseParams, change: Partial<BrowseParams>): string {
  const x = { ...p, page: 1, ...change };
  const s = new URLSearchParams();
  if (x.q) s.set("q", x.q);
  if (x.kind) s.set("kind", x.kind);
  if (x.hosted) s.set("hosted", "1");
  if (x.verified) s.set("verified", "1");
  if (x.sort) s.set("sort", x.sort);
  if (x.page > 1) s.set("page", String(x.page));
  const qs = s.toString();
  return e(qs ? `/?${qs}` : "/");
}

const current = (on: boolean) => (on ? ` aria-current="true"` : "");

function kindChips(f: BrowseResult["facets"], p?: BrowseParams): string {
  const base: BrowseParams = p ?? { q: "", hosted: false, verified: false, page: 1 };
  const chips = [`<a class="chip" href="${href(base, { kind: undefined, hosted: false, verified: false })}"${current(!!p && !p.kind && !p.hosted && !p.verified)}>All <span class="n">${n(f.all)}</span></a>`];
  for (const k of EXPORT_KINDS) if (f.kinds[k]) chips.push(`<a class="chip" href="${href(base, { kind: k })}"${current(p?.kind === k)}>${KIND_LABEL[k][1]} <span class="n">${n(f.kinds[k])}</span></a>`);
  if (f.hosted) chips.push(`<a class="chip" href="${href(base, { hosted: !p?.hosted })}"${current(!!p?.hosted)}>Hosted <span class="n">${n(f.hosted)}</span></a>`);
  if (f.verified) chips.push(`<a class="chip" href="${href(base, { verified: !p?.verified })}"${current(!!p?.verified)}>Verified publishers <span class="n">${n(f.verified)}</span></a>`);
  return `<nav class="chips" aria-label="Browse by kind">${chips.join("")}</nav>`;
}

/** The hero's right side: the most installed package, showing what a package page tells you. */
function spotlight(items: PackageCard[]): string {
  const [p, ...rest] = items;
  if (!p) return "";
  const kinds = EXPORT_KINDS.filter((k) => p.exports[k]).map((k) => `<span>${kindCount(k, p.exports[k]!)}</span>`);
  const rows: string[] = [];
  if (p.hostedBy) rows.push(`<li class="external"><i></i><span>Sends inputs to ${e(p.hostedBy)}</span></li>`);
  const others = p.network - (p.hostedBy ? 1 : 0);
  if (others > 0) rows.push(`<li class="external"><i></i><span>Contacts ${plural(others, p.hostedBy ? "other host" : "host")}</span></li>`);
  else if (!p.hostedBy) rows.push(`<li class="read no"><i></i><span>Contacts no hosts</span></li>`);
  rows.push(p.runsCode ? `<li class="write"><i></i><span>Runs its own code</span></li>` : `<li class="read no"><i></i><span>Doesn't run its own code</span></li>`);
  rows.push(p.verified ? `<li class="read"><i></i><span>Publisher verified ${e(p.verified)}</span></li>` : `<li class="no"><i></i><span>Publisher not verified</span></li>`);
  const under = rest.slice(0, 2).reverse().map((r, i) => `<div class="under u${i + 1}" aria-hidden="true">${e(r.name)}</div>`).join("");
  return `<div class="spot">${under}<article class="top">
  <header><div class="label">Most installed</div><a class="name" href="/${e(p.name)}">${nameHtml(p.name)}</a><p>${e(p.description)}</p>${kinds.length ? `<div class="kinds">${kinds.join("")}</div>` : ""}</header>
  <ul aria-label="What it can do">${rows.join("")}</ul>
  <footer><span>v${e(p.latest)}</span><span>${p.downloads ? `${compact(p.downloads)} downloads` : ""}</span></footer>
</article></div>`;
}

export async function homePage(url: URL, env: Env): Promise<Response> {
  const p = readParams(url);
  const filtered = p.q || p.kind || p.hosted || p.verified || p.sort || p.page > 1;
  if (filtered) return browsePage(env, p);
  return cached(env, "", async () => {
    const [popular, recent, totals] = await Promise.all([browsePackages(env, { sort: "downloads", limit: 6 }), browsePackages(env, { sort: "updated", limit: 6 }), registryTotals(env)]);
    const f = popular.facets;
    const t = totals;
    const hero = `<section class="hero"><div class="hero-in">
  <div>
    <span class="eyebrow"><i></i><span>The Halo package registry${t.packages ? ` · <b>${n(t.packages)}</b> ${t.packages === 1 ? "package" : "packages"}` : ""}</span></span>
    <h1>Building blocks<br>for <em>Halo</em> agents</h1>
    <p class="lead">Tools, agents, pipelines, policies and schemas to <code>use</code> in your programs. Packages never pick your models: they declare slots, and you fill them.</p>
    <div class="term" aria-label="Install a package">
      <div class="bar" aria-hidden="true"><i></i><i></i><i></i><span>~/my-project</span></div>
<pre><code><span class="p">$ </span><span class="cmd">halo add @scope/name</span>
<span class="c"># then, in main.halo</span>
<span class="k">use</span> <span class="s">"@scope/name"</span> { Triage } <span class="k">with</span> models(fast: …)</code></pre>
    </div>
    ${t.packages ? `<div class="stats"><div><b>${n(t.packages)}</b>packages</div><div><b>${n(t.publishers)}</b>publishers</div><div><b>${compact(t.downloads)}</b>downloads</div></div>` : ""}
  </div>
  ${spotlight(popular.results)}
</div></section>
${f.all ? kindChips(f) : ""}
<div class="trust" aria-label="How to read a package">
  <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg><b>What it can do, worked out for you</b><span class="muted">Hosts, env vars, processes and code come from the package's source at publish time, not from the publisher's description.</span></div>
  <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg><b>Verified publishers <span class="badge verified">✓ example.com</span></b><span class="muted">The scope's owner proved they control the domain with a DNS record. It's checked again every 30 days.</span></div>
  <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg><b>Hosted pipelines <span class="badge hosted">Hosted by example.com</span></b><span class="muted">They run on the publisher's servers and models, and your inputs are sent there. The publisher pays for the tokens.</span></div>
</div>`;
    if (!f.all)
      return html(
        layout(
          "Halo packages",
          `${hero}<div class="empty"><p><b>No packages yet.</b></p><p>Publish the first one:</p><pre><code>halo login
halo publish ./my-package</code></pre></div>`,
        ),
      );
    return html(
      layout(
        "Halo packages",
        `${hero}
<div class="shelf-head"><h2>Most installed</h2><a class="small" href="/?sort=downloads">See all ${n(f.all)}</a></div>
${cards(popular.results)}
<div class="shelf-head"><h2>Recently updated</h2><a class="small" href="/?sort=updated">See all</a></div>
${cards(recent.results)}`,
      ),
    );
  });
}

const PAGE_SIZE = 24;

async function browsePage(env: Env, p: BrowseParams): Promise<Response> {
  const opts: BrowseOptions = {
    ...(p.q ? { q: p.q } : {}),
    ...(p.kind ? { kind: p.kind } : {}),
    hosted: p.hosted,
    verified: p.verified,
    ...(p.sort ? { sort: p.sort } : {}),
    limit: PAGE_SIZE,
    offset: (p.page - 1) * PAGE_SIZE,
  };
  const r = await browsePackages(env, opts);
  const f = r.facets;
  const sort = p.sort === "relevance" && !p.q ? "downloads" : (p.sort ?? (p.q ? "relevance" : "downloads"));
  const facet = (label: string, count: number, link: string, on: boolean) => `<li><a href="${link}"${current(on)}>${label} <span class="n">${n(count)}</span></a></li>`;
  const facets = `<aside class="facets" aria-label="Filters">
  <h3>Exports</h3>
  <ul>
    ${facet("Everything", f.all, href(p, { kind: undefined }), !p.kind)}
    ${EXPORT_KINDS.filter((k) => f.kinds[k] || p.kind === k)
      .map((k) => facet(KIND_LABEL[k][1], f.kinds[k], href(p, { kind: k }), p.kind === k))
      .join("")}
  </ul>
  <h3>Publisher</h3>
  <ul>
    ${facet("Verified domain", f.verified, href(p, { verified: !p.verified }), p.verified)}
    ${facet("Hosted pipelines", f.hosted, href(p, { hosted: !p.hosted }), p.hosted)}
  </ul>
</aside>`;
  const title = p.kind ? KIND_LABEL[p.kind][1] : "All packages";
  const sorts = SORTS.filter(([k]) => k !== "relevance" || p.q)
    .map(([k, label]) => `<a href="${href(p, { sort: k })}"${current(sort === k)}>${label}</a>`)
    .join("");
  const pages = Math.max(1, Math.ceil(r.total / PAGE_SIZE));
  const pager =
    pages > 1
      ? `<nav class="pager" aria-label="Pages">${p.page > 1 ? `<a href="${href(p, { page: p.page - 1 })}">← Previous</a>` : "<span></span>"}<span class="muted small">Page ${p.page} of ${pages}</span>${p.page < pages ? `<a href="${href(p, { page: p.page + 1 })}">Next →</a>` : "<span></span>"}</nav>`
      : "";
  const body = `<section class="band"><div class="band-in">
  <div class="crumbs"><a href="/">Packages</a>${p.kind ? ` / ${KIND_LABEL[p.kind][1]}` : ""}</div>
  <h1>${p.q ? `Results for <span class="grad">“${e(p.q)}”</span>` : `<span class="grad">${title}</span>`}</h1>
  <p class="lead">${plural(r.total, "package")}${p.verified ? " from verified publishers" : ""}${p.hosted ? " with hosted pipelines" : ""}.</p>
</div></section>
<div class="browse">
${facets}
<section>
  <div class="toolbar"><span></span><div class="sort">Sort:${sorts}</div></div>
  ${r.results.length ? cards(r.results) : `<div class="empty"><p><b>Nothing matches.</b></p><p><a href="/">Browse every package</a></p></div>`}
  ${pager}
</section>
</div>`;
  return html(layout(`${p.q || title} · Halo packages`, body, p.q));
}

// ── Publisher (scope) page ──

export async function scopePage(env: Env, ctx: Ctx | undefined, scope: string): Promise<Response> {
  if (!isScopeName(scope)) return notFound(`${scope} isn't a scope name`);
  const doc = await scopeDoc(env, scope, ctx);
  if (!doc) return notFound(`No publisher ${scope}`);
  const r = await browsePackages(env, { scope, sort: "downloads", limit: 100 });
  const owners = doc.members.filter((m) => m.role === "owner").map((m) => m.login);
  const downloads = r.results.reduce((s, x) => s + (x.downloads ?? 0), 0);
  const body = `<section class="band"><div class="band-in">
<div class="crumbs"><a href="/">Packages</a> / ${e(scope)}</div>
<div class="scope-head">
  <div class="avatar" aria-hidden="true">${e(scope.slice(1, 2).toUpperCase())}</div>
  <div>
    <h1 class="mono"><span class="grad">${e(scope)}</span></h1>
    <div class="badges">
      ${doc.verified ? `<span class="badge verified" title="The owner proved they control this domain with a DNS record">✓ Verified: ${e(doc.verified)}</span>` : `<span class="badge">Unverified</span>`}
      <span class="badge">${doc.kind === "org" ? "Organisation" : "Personal scope"}</span>
    </div>
    ${owners.length ? `<div class="muted small">Owned by ${owners.map((o) => `@${e(o)}`).join(", ")}</div>` : ""}
  </div>
</div>
${r.results.length ? `<div class="stats"><div><b>${n(r.total)}</b>${r.total === 1 ? "package" : "packages"}</div><div><b>${compact(downloads)}</b>downloads</div></div>` : ""}
</div></section>
${r.results.length ? cards(r.results) : `<div class="empty">${e(scope)} hasn't published anything yet.</div>`}`;
  return html(layout(`${scope} · Halo packages`, body));
}

// ── Package page ──

export async function packagePage(env: Env, ctx: Ctx | undefined, name: string, version?: string): Promise<Response> {
  // Keyed by the package's revision, so a yank or deprecation shows at once in every colo.
  const revision = await packageRevision(env, name, ctx);
  if (revision === undefined) return notFound(`No package ${name}`);
  return cached(
    env,
    version ? `${name}/v/${version}` : name,
    async () => {
      const [view, stats] = await Promise.all([loadPackage(env, name), packageStats(env, name, 30)]);
      if (!view || !stats) return notFound(`No package ${name}`);
      const v = version ?? view.doc.distTags.latest;
      const doc = v ? view.doc.versions[v] : undefined;
      if (!doc) return notFound(`${name} has no version ${version}`);
      return html(layout(`${name}${version ? `@${version}` : ""} · Halo packages`, renderPackage(view, doc, !!version, stats)));
    },
    { revision },
  );
}

function notFound(message: string): Response {
  return html(
    layout(
      "Not found · Halo packages",
      `<section class="band"><div class="band-in"><div class="crumbs"><a href="/">Packages</a></div><h1><span class="grad">Not found</span></h1><p class="lead">${e(message)}</p><p><a href="/">Browse packages</a></p></div></section>`,
    ),
    404,
  );
}

function exampleUse(name: string, v: VersionDoc): string {
  const x = v.exports;
  const names = [...x.pipelines, ...x.agents, ...x.tools, ...x.providers, ...x.schemas, ...x.policies, ...x.stores].slice(0, 4);
  const slots = Object.entries(v.models);
  const withModels = slots.length ? ` with models(${slots.map(([s, m]) => `${s}: ${m.suggested ?? "<model>"}`).join(", ")})` : "";
  return `use "${name}" { ${names.length ? names.join(", ") : "…"} }${withModels}`;
}

const codes = (items: string[]) => items.map((i) => `<code>${e(i)}</code>`).join(" ");

function permissionRow(level: "read" | "write" | "external", title: string, vals: string, why: string, tag: string): string {
  return `<div class="row"><span class="dot ${level}" aria-hidden="true"></span><div class="what"><b>${title}</b><div class="vals">${vals}</div><div class="why">${why}</div></div><span class="level ${level}">${tag}</span></div>`;
}

function renderPermissions(view: PackageView, v: VersionDoc): string {
  const p = v.permissions;
  const hosted = view.hosted[v.version];
  const rows: string[] = [];
  const cant: string[] = [];
  if (p.hosted.length)
    rows.push(
      permissionRow(
        "external",
        "Sends your inputs to the publisher",
        codes(p.hosted),
        `Hosted pipelines run there, on the publisher's models${hosted?.auth ? `, with a key you get from the publisher in <code>${e(hosted.auth.env)}</code>` : ""}.`,
        "sends data",
      ),
    );
  if (p.network.length) rows.push(permissionRow("external", "Contacts these hosts", codes(p.network), "Requests from its tools go only here.", "network"));
  else cant.push("Contact any host");
  if (p.env.length) rows.push(permissionRow("read", "Reads environment variables", codes(p.env), "Usually API keys. You set them in <code>.env</code>.", "reads"));
  else cant.push("Read your environment variables");
  if (p.spawn.length) rows.push(permissionRow("write", "Starts processes", codes(p.spawn), "Commands it runs on your machine, such as stdio MCP servers.", "starts"));
  else cant.push("Start processes on your machine");
  if (p.code) rows.push(permissionRow("write", "Runs its own code", "Module providers or local servers", "Installing asks for <code>--trust</code>, recorded per machine and never in the lockfile.", "runs code"));
  else cant.push("Run its own code (it's declarations only)");
  const body = rows.length ? rows.join("") : `<div class="none">✓ Declarations only: no network, env vars, processes or code.</div>`;
  const cantList = rows.length && cant.length ? `<div class="cant"><b>It can't</b><ul>${cant.map((c) => `<li>${c}</li>`).join("")}</ul></div>` : "";
  return `<h2 id="permissions">What it can do</h2>
<div class="perm">${body}${cantList}</div>
<p class="note">Worked out by the registry from version ${e(v.version)}'s source when it was published. <code>halo plan</code> shows the same for your program.</p>`;
}

function renderExports(view: PackageView, v: VersionDoc): string {
  const hosted = view.hosted[v.version];
  const hostedSet = new Set(v.hosted?.pipelines ?? []);
  const shown = EXPORT_KINDS.filter((k) => v.exports[k].length);
  if (!shown.length) return `<h2 id="exports">Exports</h2><p class="muted">Nothing exported.</p>`;
  const item = (k: ExportKind, name: string) => {
    const iface = k === "pipelines" ? hosted?.interfaces?.[name] : undefined;
    const sig = iface ? `${name}(${iface.params.map((x) => `${x.name}: ${x.type}`).join(", ")})${iface.returns ? ` -> ${iface.returns}` : ""}` : name;
    const fx = iface?.effects?.length ? `<div class="fx">On the publisher's side: ${iface.effects.map((x) => `<code>${e(x.target)}</code> ${e(x.effect)}`).join(", ")}</div>` : "";
    return `<li><span class="sig">${e(sig)}</span>${hostedSet.has(name) ? ` <span class="badge hosted">hosted</span>` : ""}${iface?.description ? `<div class="muted small">${e(iface.description)}</div>` : ""}${fx}</li>`;
  };
  return `<h2 id="exports">Exports</h2>
<div class="exports">${shown.map((k) => `<section><h3>${KIND_LABEL[k][1]} · ${v.exports[k].length}</h3><ul class="plain">${v.exports[k].map((x) => item(k, x)).join("")}</ul></section>`).join("")}</div>`;
}

function renderPackage(view: PackageView, v: VersionDoc, pinned: boolean, stats: PackageStats): string {
  const d = view.doc;
  const latest = d.distTags.latest;
  const scope = d.name.slice(0, d.name.indexOf("/"));
  const hostedHost = v.hosted ? new URL(v.hosted.endpoint).host : undefined;
  const hostedAuth = view.hosted[v.version]?.auth;
  const slots = Object.entries(v.models);
  const versions = Object.values(d.versions);
  const exportCount = EXPORT_KINDS.reduce((s, k) => s + v.exports[k].length, 0);

  const head = `<section class="band"><div class="band-in">
<div class="crumbs"><a href="/">Packages</a> / <a href="/${e(scope)}">${e(scope)}</a> / ${e(d.name.slice(scope.length + 1))}</div>
<div class="pkg-head">
  <div>
    <h1>${nameHtml(d.name)}</h1>
    <p class="lead">${e(d.description)}</p>
    <div class="badges">
      <span class="badge">v${e(v.version)}${v.version === latest ? " · latest" : ""}</span>
      ${d.verified ? `<span class="badge verified" title="The scope's owner verified this domain with a DNS record">✓ ${e(d.verified)}</span>` : ""}
      ${hostedHost ? `<span class="badge hosted">Hosted by ${e(hostedHost)}</span>` : ""}
      ${v.permissions.code ? `<span class="badge warn">Runs code</span>` : ""}
      ${v.yanked !== undefined ? `<span class="badge bad">yanked</span>` : ""}
      ${v.deprecated ? `<span class="badge warn">deprecated</span>` : ""}
    </div>
    <div class="meta">
      <span>Published ${e(v.publishedAt.slice(0, 10))}${v.publishedBy ? ` by @${e(v.publishedBy)}` : ""}</span>
      ${d.license ? `<span>${e(d.license)}</span>` : ""}
      <span>${plural(stats.downloads.last30, "download")} this month</span>
      ${stats.dependents.direct ? `<span>${plural(stats.dependents.direct, "dependent")}</span>` : ""}
    </div>
    ${v.yanked !== undefined ? `<div class="notice bad"><b>Yanked.</b> <span>${e(v.yanked)} New installs skip this version; lockfiles that pin it still work.</span></div>` : ""}
    ${v.deprecated ? `<div class="notice warn"><b>Deprecated.</b> <span>${e(v.deprecated)}</span></div>` : ""}
    ${v.version !== latest && latest ? `<p class="muted small">This is an older or pre-release version. The latest is <a href="/${e(d.name)}">${e(latest)}</a>.</p>` : ""}
  </div>
  <section class="install" aria-labelledby="install">
    <h2 id="install"><i></i><i></i><i></i>Install</h2>
    <pre class="cmd"><code>halo add ${e(d.name)}${pinned ? `@${e(v.version)}` : ""}</code></pre>
    <pre><code>${e(exampleUse(d.name, v))}</code></pre>
    ${hostedAuth ? `<p>Set <code>${e(hostedAuth.env)}</code> to a key from ${e(hostedHost ?? "the publisher")}.</p>` : ""}
    ${v.permissions.code ? `<p>Runs its own code: add <code>--trust</code> once you've read it.</p>` : ""}
  </section>
</div>
</div></section>`;

  const tab = (id: string, label: string, count?: number) => `<a href="#${id}">${label}${count !== undefined ? `<span class="n muted">${n(count)}</span>` : ""}</a>`;
  const tabs = `<nav class="tabs" aria-label="On this page">${[
    tab("permissions", "What it can do"),
    slots.length ? tab("models", "Model slots", slots.length) : "",
    tab("readme", "README"),
    tab("exports", "Exports", exportCount),
    tab("versions", "Versions", versions.length),
    tab("dependents", "Dependents", stats.dependents.transitive),
  ].join("")}</nav>`;

  const main: string[] = [renderPermissions(view, v)];
  if (slots.length)
    main.push(`<h2 id="models">Model slots</h2>
<p class="muted small">This package doesn't pick models. You fill each slot in <code>halo.json</code> or with <code>with models(…)</code>, and pay for your own tokens.</p>
<div class="slots">${slots.map(([slot, m]) => `<div class="slot"><code>models.${e(slot)}</code><p>${e(m.description)}</p>${m.suggested ? `<p class="muted small">Suggested: <code>${e(m.suggested)}</code></p>` : ""}</div>`).join("")}</div>`);
  main.push(`<h2 id="readme">README</h2><div class="readme">${renderMarkdown(view.readmes[v.version] ?? "")}</div>`);
  main.push(renderExports(view, v));
  main.push(renderVersions(d.name, view, stats));
  main.push(renderDependents(stats));

  const deps = Object.entries(v.dependencies);
  const aside = `<aside>
<h2 id="downloads">Downloads</h2>${renderDownloads(stats)}
<h2 id="checks">Checks</h2>${renderChecks(view, v)}
<h2 id="dependencies">Dependencies</h2>${
    deps.length ? `<ul class="plain">${deps.map(([dn, r]) => `<li><a href="/${e(dn)}">${e(dn)}</a> <code>${e(r)}</code></li>`).join("")}</ul>` : `<p class="muted small">None.</p>`
  }
<h2 id="details">Details</h2><dl>
  <dt>Publisher</dt><dd><a href="/${e(scope)}">${e(scope)}</a></dd>
  ${d.license ? `<dt>License</dt><dd>${e(d.license)}</dd>` : ""}
  ${d.repository ? `<dt>Source</dt><dd>${link(d.repository)}</dd>` : ""}
  ${d.homepage ? `<dt>Homepage</dt><dd>${link(d.homepage)}</dd>` : ""}
  ${v.halo ? `<dt>Halo</dt><dd><code>${e(v.halo)}</code></dd>` : ""}
  <dt>Size</dt><dd>${(v.size / 1024).toFixed(1)} KB</dd>
  <dt>sha256</dt><dd><code title="${e(v.sha256)}">${e(v.sha256.slice(0, 16))}…</code></dd>
</dl>
${d.keywords?.length ? `<h2>Keywords</h2><div class="badges">${d.keywords.map((k) => `<a class="badge" href="/?q=${encodeURIComponent(k)}">${e(k)}</a>`).join("")}</div>` : ""}
</aside>`;

  return `${head}
${tabs}
<div class="pkg"><div>${main.join("\n")}</div>${aside}</div>`;
}

/** What's there and what isn't, item by item. Deliberately not a score. */
function renderChecks(view: PackageView, v: VersionDoc): string {
  const d = view.doc;
  const slots = Object.values(v.models);
  const items: [boolean, string][] = [
    [!!d.verified, d.verified ? `Publisher verified ${e(d.verified)}` : "Publisher hasn't verified a domain"],
    [!!d.repository, d.repository ? "Links its source" : "No source repository"],
    [!!d.license, d.license ? `License: ${e(d.license)}` : "No license"],
    [!!v.halo, v.halo ? `Says which Halo it needs (<code>${e(v.halo)}</code>)` : "Doesn't say which Halo it needs"],
  ];
  if (slots.length) {
    const ok = slots.every((s) => s.suggested);
    items.push([ok, ok ? "Suggests a model for every slot" : "Some slots have no suggested model"]);
  }
  return `<ul class="plain checks">${items.map(([ok, text]) => `<li><span class="${ok ? "y" : "n"}" aria-label="${ok ? "yes" : "no"}">${ok ? "✓" : "–"}</span><span>${text}</span></li>`).join("")}</ul>`;
}

function renderVersions(name: string, view: PackageView, stats: PackageStats): string {
  const d = view.doc;
  const dl = new Map(stats.downloads.versions.map((x) => [x.version, x.total]));
  const rows = Object.values(d.versions)
    .map((ver) => {
      const tags = Object.entries(d.distTags)
        .filter(([, tv]) => tv === ver.version)
        .map(([t]) => `<span class="badge">${e(t)}</span>`)
        .join(" ");
      const notes = [ver.yanked !== undefined ? `<span class="badge bad">yanked</span> ${e(ver.yanked)}` : "", ver.deprecated ? `<span class="badge warn">deprecated</span> ${e(ver.deprecated)}` : ""].filter(Boolean).join(" ");
      return `<tr><td><a class="mono" href="/${e(name)}/v/${e(ver.version)}">${e(ver.version)}</a> ${tags}</td><td>${e(ver.publishedAt.slice(0, 10))}${ver.publishedBy ? ` <span class="muted">by @${e(ver.publishedBy)}</span>` : ""}</td><td class="num">${n(dl.get(ver.version) ?? 0)}</td><td>${notes}</td></tr>`;
    })
    .join("\n");
  return `<h2 id="versions">Versions</h2>
<div class="wide-table"><table class="versions"><thead><tr><th scope="col">Version</th><th scope="col">Published</th><th scope="col" class="num">Downloads</th><th scope="col">Notes</th></tr></thead><tbody>
${rows}
</tbody></table></div>`;
}

function renderDownloads(stats: PackageStats): string {
  const d = stats.downloads;
  const max = Math.max(1, ...d.daily.map((x) => x.count));
  const w = 100 / Math.max(1, d.daily.length);
  const bars = d.daily
    .map((x, i) => {
      const h = x.count ? Math.max(2, (x.count / max) * 30) : 0;
      return `<rect x="${(i * w).toFixed(2)}" y="${(30 - h).toFixed(2)}" width="${(w * 0.8).toFixed(2)}" height="${h.toFixed(2)}"><title>${e(x.day)}: ${x.count}</title></rect>`;
    })
    .join("");
  return `<div>${plural(d.last30, "download")} in the last 30 days</div>
<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="Downloads per day, last 30 days" fill="currentColor">${bars}</svg>
<div class="muted small">${n(d.last7)} this week · ${n(d.total)} all time</div>`;
}

function renderDependents(stats: PackageStats): string {
  const t = stats.dependents;
  if (!t.transitive) return `<h2 id="dependents">Dependents</h2><p class="muted">No packages depend on this one yet.</p>`;
  const direct = t.packages.filter((p) => p.depth === 1);
  const shown = direct.slice(0, 20);
  const indirect = t.transitive - t.direct;
  return `<h2 id="dependents">Dependents</h2>
<p>${plural(t.direct, "package")} directly${indirect ? `, ${plural(indirect, "more")} through them` : ""}.</p>
${shown.length ? `<ul class="plain">${shown.map((p) => `<li><a href="/${e(p.name)}">${e(p.name)}</a> <code>${e(p.range ?? "")}</code>${p.onLatest === false ? ` <span class="badge warn" title="Its range doesn't include this package's latest version">not on latest</span>` : ""}</li>`).join("")}</ul>` : ""}
${direct.length > shown.length ? `<p class="muted">and ${direct.length - shown.length} more</p>` : ""}`;
}

function link(url: string): string {
  return /^https?:\/\//i.test(url) ? `<a href="${e(url)}" rel="nofollow noopener ugc">${e(url.replace(/^https?:\/\//i, ""))}</a>` : e(url);
}
