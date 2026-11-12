/**
 * Custom Metrickle events for halolang.com. Pageviews, web vitals, rage/dead clicks and
 * errors are automatic (m.js, loaded in config.ts); these are the actions pages can't show:
 *
 *   install_command_copied  the copy button on a code block holding an install command
 *   download_clicked        a link to /dl/… or the install scripts
 *   outbound_click          a link to another host (registry.halolang.com, GitHub, …)
 *   playground_shared       the playground's Share button
 *   challenge_started       a "Try a challenge" button in the playground
 *   page_not_found          the 404 page was shown
 *
 * Calls queue until m.js loads, so this works before the deferred script arrives.
 */

type Metrickle = { q?: unknown[][]; track: (name: string, props?: Record<string, unknown>) => void };
declare global {
  interface Window {
    metrickle?: Metrickle;
  }
}

function track(name: string, props: Record<string, unknown> = {}) {
  window.metrickle ||= {
    q: [],
    track(...args: unknown[]) {
      this.q!.push(["track", ...args]);
    },
  };
  window.metrickle.track(name, props);
}

const INSTALL = /install\.(sh|ps1)|npm install[^\n]*@halolang\/halo|bun (add|install)[^\n]*@halolang\/halo|ghcr\.io\/cmjio\/halo/;

function installMethod(code: string): string {
  if (code.includes("install.ps1")) return "powershell";
  if (code.includes("install.sh")) return "shell";
  if (code.includes("@halolang/halo")) return "npm";
  if (code.includes("ghcr.io/cmjio/halo")) return "docker";
  return "other";
}

function onClick(ev: MouseEvent) {
  const target = ev.target as Element | null;
  if (!target?.closest) return;

  // VitePress code blocks: <div class="language-*"><button class="copy"> … <pre><code>
  const copy = target.closest("button.copy");
  if (copy) {
    const code = copy.parentElement?.querySelector("pre code")?.textContent ?? "";
    if (INSTALL.test(code)) track("install_command_copied", { method: installMethod(code) });
    return;
  }

  if (target.closest("[data-pg-share]")) return track("playground_shared");
  if (target.closest("[data-go-challenge]")) return track("challenge_started");

  const link = target.closest("a[href]") as HTMLAnchorElement | null;
  if (!link) return;
  const url = new URL(link.href, location.href);
  if (url.host === location.host) {
    if (url.pathname.startsWith("/dl/") || /^\/install\.(sh|ps1)$/.test(url.pathname)) {
      track("download_clicked", { file: url.pathname });
    }
  } else if (url.protocol.startsWith("http")) {
    track("outbound_click", { host: url.host, url: url.href });
  }
}

type Router = {
  route: { data?: { isNotFound?: boolean } };
  onAfterRouteChange?: (to: string) => unknown;
};

let lastNotFound = "";
function checkNotFound(router: Router) {
  // VitePress swaps in page data with isNotFound when a route has no page.
  if (router.route.data?.isNotFound && lastNotFound !== location.pathname) {
    lastNotFound = location.pathname;
    track("page_not_found", { path: location.pathname, referrer: document.referrer || null });
  }
}

/** Call once on the client from the theme's enhanceApp. */
export function installMetrickleEvents(router: Router) {
  document.addEventListener("click", onClick, { capture: true });
  const previous = router.onAfterRouteChange;
  // VitePress runs this after every page load, the first one included (router.go() at
  // startup). Don't also check at startup: until that first load finishes, route.data is
  // the not-found placeholder, so every first page would look like a 404.
  router.onAfterRouteChange = async (to) => {
    await previous?.(to);
    checkNotFound(router);
  };
}
