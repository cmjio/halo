// One Bun process: the React page (an HTML import, bundled by Bun), the API in app.ts,
// and a stand-in for your order system that the pipeline's REST tool calls.
//
//   bun --hot blueprints/web-app/server.ts                     # offline: canned model answers, no key needed
//   ANTHROPIC_API_KEY=... bun blueprints/web-app/server.ts     # real models

import index from "./web/index.html";
import { createApp } from "./app.ts";
import { ordersApi } from "./orders-api.ts";
import mocks from "./samples/mocks.json";
import orders from "./samples/orders.json";

const port = Number(Bun.env.PORT ?? 3000);
const live = !!Bun.env.ANTHROPIC_API_KEY;
const ordersToken = Bun.env.ORDERS_API_TOKEN ?? crypto.randomUUID();

// Offline, each canned model answer takes a moment, like a model would, so the progress shows.
// Tools aren't mocked: the handbook files and the orders API are read for real either way.
const slow = Object.fromEntries(Object.entries(mocks).map(([k, v]) => [k, async () => (await Bun.sleep(600), v)]));

const app = createApp({
  source: await Bun.file(new URL("./pipelines/reply.halo", import.meta.url)).text(),
  stateDir: new URL("./.halo", import.meta.url).pathname,
  mocks: live ? undefined : slow,
  runtime: {
    // What `Env.*` in reply.halo's tool declarations reads. An absolute path, because
    // tools resolve relative paths against the process's working directory.
    env: {
      ...Bun.env,
      HANDBOOK_DIR: new URL("./handbook", import.meta.url).pathname,
      ORDERS_API_URL: Bun.env.ORDERS_API_URL ?? `http://localhost:${port}/internal/orders`,
      ORDERS_API_TOKEN: ordersToken,
    },
  },
});

const server = Bun.serve({
  port,
  // Server-Sent Events stay open while a model thinks; app.ts pings every 15s.
  idleTimeout: 30,
  routes: {
    "/": index,
    "/internal/orders": ordersApi(orders, ordersToken),
  },
  async fetch(req) {
    return (await app.fetch(req)) ?? new Response("Not found", { status: 404 });
  },
  development: Bun.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`Reply desk on ${server.url} (${live ? "live models" : "offline: canned model answers; set ANTHROPIC_API_KEY for real ones"})`);
console.log(`Try a message about order A1001 (in transit) or A1002 (delivered).`);
process.on("SIGTERM", async () => { await server.stop(); await app.close(); process.exit(0); });
