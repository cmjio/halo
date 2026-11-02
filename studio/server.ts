import { Database } from "bun:sqlite";
import { serve } from "bun";

import path from "node:path";
import { mkdirSync } from "node:fs";

// The Studio UI expects the API on this port.
const PORT = 4000;
// The CLI records runs to .halo/telemetry.db in the directory it runs in; start Studio from there
// (or set HALO_TELEMETRY to that file).
const DB_PATH = Bun.env.HALO_TELEMETRY ?? path.resolve(".halo/telemetry.db");

// Ensure DB exists
let db: Database;
try {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH, { create: true });
} catch (e) {
  console.error("Failed to open DB", e);
  process.exit(1);
}

// Ensure table exists in case the runtime hasn't created it yet
db.run(`
  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    timestamp INTEGER,
    type TEXT,
    stage TEXT,
    payload TEXT,
    duration_ms INTEGER,
    tokens INTEGER
  )
`);

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

    // Get all runs (grouped by run_id, sorted by start time)
    if (url.pathname === "/api/runs") {
      const runs = db.query(`
        SELECT run_id, MIN(timestamp) as start_time, MAX(timestamp) as end_time, COUNT(*) as event_count
        FROM telemetry
        GROUP BY run_id
        ORDER BY start_time DESC
        LIMIT 50
      `).all();
      return new Response(JSON.stringify(runs), { headers });
    }

    // Get specific run events
    if (url.pathname.startsWith("/api/runs/")) {
      const runId = url.pathname.split("/").pop();
      if (!runId) return new Response("Missing run_id", { status: 400 });
      
      const events = db.query(`
        SELECT * FROM telemetry 
        WHERE run_id = $runId 
        ORDER BY timestamp ASC, id ASC
      `).all({ $runId: runId });
      
      return new Response(JSON.stringify(events), { headers });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`📡 Halo Studio API at http://localhost:${PORT} (reading ${DB_PATH})`);
