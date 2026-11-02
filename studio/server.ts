import { Database } from "bun:sqlite";
import { serve } from "bun";

import path from "node:path";

const PORT = 4000;
const DB_PATH = path.join(import.meta.dir, "../.langly.db");

// Ensure DB exists
let db: Database;
try {
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
  async fetch(req) {
    const url = new URL(req.url);

    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
    };

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

console.log(`📡 Langly Trace Server running at http://localhost:${PORT}`);
