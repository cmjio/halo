import { Database } from "bun:sqlite";

export interface TelemetryEvent {
  runId: string;
  timestamp: number;
  type: "node_start" | "node_end" | "llm_call" | "tool_call" | "error" | "stream_start" | "stream_end";
  stage: string;       // e.g., "Analyst.synthesize_risk"
  payload: unknown;    // The prompt, response, input context, or error stack
  metrics?: { durationMs?: number; tokens?: number };
}

export interface TelemetrySink {
  record(event: TelemetryEvent): void | Promise<void>;
  close?(): void;
}

/**
 * A basic console sink for debugging.
 */
export class ConsoleTelemetrySink implements TelemetrySink {
  record(event: TelemetryEvent) {
    console.log(`[TRACE ${event.runId}] ${event.timestamp} [${event.type}] ${event.stage}`);
    if (event.type === "error") {
      console.error(event.payload);
    }
  }
}

/**
 * SQLite sink that logs all telemetry to a local DB file for the Langly Studio dashboard.
 */
export class SQLiteTelemetrySink implements TelemetrySink {
  private db: Database;
  private insertStmt: any;

  constructor(dbPath: string = ".langly.db") {
    this.db = new Database(dbPath);
    this.db.run(`
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
    
    // Create an index for faster UI queries by run_id
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_telemetry_run_id ON telemetry(run_id)`);

    this.insertStmt = this.db.prepare(`
      INSERT INTO telemetry (run_id, timestamp, type, stage, payload, duration_ms, tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  }

  record(event: TelemetryEvent) {
    // Prune old runs (keep only last 100) when a new run starts
    if (event.type === "stream_start") {
      try {
        this.db.run(`
          DELETE FROM telemetry 
          WHERE run_id NOT IN (
            SELECT run_id FROM (
              SELECT run_id, MIN(timestamp) as start_time 
              FROM telemetry 
              GROUP BY run_id 
              ORDER BY start_time DESC 
              LIMIT 100
            )
          )
        `);
      } catch (e) {
        console.error("[Telemetry Error] Failed to prune telemetry DB:", e);
      }
    }

    try {
      this.insertStmt.run(
        event.runId,
        event.timestamp,
        event.type,
        event.stage,
        event.payload !== undefined ? JSON.stringify(event.payload) : null,
        event.metrics?.durationMs ?? null,
        event.metrics?.tokens ?? null
      );
    } catch (e) {
      console.error("[Telemetry Error] Failed to record event:", e);
    }
  }

  close() {
    this.db.close();
  }
}

export class TelemetryDispatcher implements TelemetrySink {
  constructor(private sinks: TelemetrySink[] = []) {}

  addSink(sink: TelemetrySink) {
    this.sinks.push(sink);
  }

  record(event: TelemetryEvent) {
    for (const sink of this.sinks) {
      sink.record(event);
    }
  }

  close() {
    for (const sink of this.sinks) {
      if (sink.close) sink.close();
    }
  }
}
