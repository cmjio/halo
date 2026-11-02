import { Database } from "bun:sqlite";
import { serve } from "bun";
import { existsSync } from "node:fs";
import path from "node:path";

// The UI looks for the API here (set VITE_HALO_API for the UI if you change it).
const PORT = Number(Bun.env.HALO_STUDIO_PORT ?? 4000);
// The CLI records runs to .halo/telemetry.db in the directory it runs in; start Studio from there
// (or set HALO_TELEMETRY to that file).
const DB_PATH = Bun.env.HALO_TELEMETRY ?? path.resolve(".halo/telemetry.db");

/**
 * Read from the telemetry database. It is opened per request (read-only), so
 * Studio sees runs recorded after it started, and keeps working if the file
 * is deleted and recreated. No database yet means no runs.
 */
function query<T>(sql: string, params: Record<string, string> = {}): T[] {
  if (!existsSync(DB_PATH)) return [];
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const hasTable = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'telemetry'").get();
    return hasTable ? (db.query(sql).all(params) as T[]) : [];
  } finally {
    db.close();
  }
}

serve({
  port: PORT,
  // Run data includes prompts and outputs: only serve this machine.
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);

    // Only the local Studio UI (any localhost port) may read run data from a browser.
    const origin = req.headers.get("origin") ?? "";
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
    };
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) headers["Access-Control-Allow-Origin"] = origin;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Recent runs, newest first
    if (url.pathname === "/api/runs") {
      // Pipeline name (from stream_start), final status and cost (from the last stream_end or error).
      const runs = query(`
        SELECT t.run_id, MIN(t.timestamp) AS start_time, MAX(t.timestamp) AS end_time, COUNT(*) AS event_count,
          (SELECT stage FROM telemetry s WHERE s.run_id = t.run_id AND s.type = 'stream_start' ORDER BY s.id LIMIT 1) AS pipeline,
          (SELECT CASE WHEN e.type = 'error' THEN 'error' ELSE json_extract(e.payload, '$.status') END
             FROM telemetry e WHERE e.run_id = t.run_id AND e.type IN ('stream_end', 'error') ORDER BY e.id DESC LIMIT 1) AS status,
          (SELECT json_extract(e.payload, '$.cost')
             FROM telemetry e WHERE e.run_id = t.run_id AND e.type IN ('stream_end', 'error') ORDER BY e.id DESC LIMIT 1) AS cost
        FROM telemetry t
        GROUP BY t.run_id
        ORDER BY start_time DESC
        LIMIT 50
      `);
      return new Response(JSON.stringify(runs), { headers });
    }

    // One run's events, in order
    if (url.pathname.startsWith("/api/runs/")) {
      const runId = url.pathname.split("/").pop();
      if (!runId) return new Response("Missing run_id", { status: 400 });
      const events = query(`SELECT * FROM telemetry WHERE run_id = $runId ORDER BY timestamp ASC, id ASC`, { $runId: runId });
      return new Response(JSON.stringify(events), { headers });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`📡 Halo Studio API at http://localhost:${PORT} (reading ${DB_PATH})`);
