import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  type ReactFlowInstance
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

// Halo Studio is served by `halo serve`, so the API is on the same origin.
// If the server needs a token, open Studio once with ?token=<HALO_SERVE_TOKEN>.
const TOKEN_KEY = "halo-token";
const urlToken = new URLSearchParams(location.search).get("token");
if (urlToken) {
  try { sessionStorage.setItem(TOKEN_KEY, urlToken); } catch {}
  history.replaceState(null, "", location.pathname);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch {}
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  return body as T;
}

// ── Types ──
interface TelemetryEvent {
  id: number;
  run_id: string;
  timestamp: number;
  type: string;
  stage: string;
  payload: string | null;
  duration_ms: number | null;
  tokens: number | null;
}

interface PipelineInfo {
  name: string;
  file: string;
  params: Array<{ name: string; type: string }>;
  schedules: Array<{ cron: string; next?: string }>;
  webhooks: string[];
}

interface RunDetail {
  runId: string;
  running: boolean;
  paused?: { waitingFor: string; message?: string; stage: number; approveUrl: string };
  events: TelemetryEvent[];
}

/** A typed value: JSON when it parses (numbers, lists, objects), otherwise the text. */
function parseInput(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

/** One pipeline in the sidebar, with a form for its arguments. */
function PipelineItem({ p, onStarted }: { p: PipelineInfo; onStarted: (runId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    try {
      const args = Object.fromEntries(p.params.map((param) => [param.name, parseInput(values[param.name] ?? "")]));
      const { runId } = await api<{ runId: string }>(`/api/pipelines/${p.name}/runs`, { method: "POST", body: JSON.stringify({ args }) });
      setOpen(false);
      onStarted(runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="pipeline-item">
      <div className="pipeline-row" onClick={() => setOpen(!open)}>
        <span className="run-pipeline">{p.name}</span>
        <span className="pipeline-file">{p.file}</span>
      </div>
      {(p.schedules.length > 0 || p.webhooks.length > 0) && (
        <div className="pipeline-triggers">
          {p.schedules.map((s) => <span key={s.cron}>⏱ {s.cron}</span>)}
          {p.webhooks.map((w) => <span key={w}>↪ {w}</span>)}
        </div>
      )}
      {open && (
        <div className="pipeline-form">
          {p.params.map((param) => (
            <label key={param.name}>
              {param.name} <span className="param-type">{param.type}</span>
              <input value={values[param.name] ?? ""} onChange={(e) => setValues({ ...values, [param.name]: e.target.value })} />
            </label>
          ))}
          <button className="run-button" onClick={run}>Run {p.name}</button>
          {error && <div className="form-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

interface RunSummary {
  run_id: string;
  start_time: number;
  end_time: number;
  event_count: number;
  pipeline: string | null;
  /** completed, halted, paused, or error; null while running */
  status: string | null;
  cost: number | null;
}

function parsePayload(payload: string | null): unknown {
  try {
    return JSON.parse(payload ?? "null");
  } catch {
    return payload;
  }
}

/** Show text fields (prompts, answers) as readable text, everything else as JSON. */
function PayloadView({ payload }: { payload: string | null }) {
  const value = parsePayload(payload);
  if (value === null || value === undefined) return <p className="payload-empty">Nothing recorded</p>;
  if (typeof value !== "object" || Array.isArray(value)) {
    return <pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>;
  }
  return (
    <>
      {Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([key, v]) => (
          <div className="payload-field" key={key}>
            <h4>{key}</h4>
            <pre>{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</pre>
          </div>
        ))}
    </>
  );
}

// ── Custom Node Components ──

const StageNode = ({ data }: any) => {
  return (
    <div className={`stage-node ${data.type} ${data.status}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-header">
        <span className="node-icon">{data.type === 'tool_call' ? '🔧' : '🧠'}</span>
        <span className="node-title">{data.label}</span>
      </div>
      {data.duration != null && <div className="node-metrics">{data.duration}ms</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes = {
  stageNode: StageNode,
};

// ── Main App ──

function App() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TelemetryEvent | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [flow, setFlow] = useState<ReactFlowInstance<any, any> | null>(null);

  // Fit each run's whole chart into view. fitView does nothing until React Flow
  // has measured the nodes, so retry briefly until it reports success.
  useEffect(() => {
    if (!flow || nodes.length === 0) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = async () => {
      const fitted = await flow.fitView({ padding: 0.1, minZoom: 0.1 });
      if (!fitted && ++tries < 40) timer = setTimeout(attempt, 50);
    };
    timer = setTimeout(attempt, 0);
    return () => clearTimeout(timer);
  }, [flow, selectedRun, nodes.length]);

  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Runs started by schedules, webhooks, or approvals appear on their own.
  useEffect(() => {
    const load = () =>
      api<RunSummary[]>("/api/runs")
        .then((r) => { setRuns(r); setError(null); })
        .catch((e) => setError(e.message));
    load();
    api<PipelineInfo[]>("/api/pipelines").then(setPipelines).catch((e) => setError(e.message));
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  // The selected run's events, refreshed while it is running or paused.
  useEffect(() => {
    if (!selectedRun) return;
    let count = -1;
    let stop = false;
    const load = async () => {
      try {
        const d = await api<RunDetail>(`/api/runs/${selectedRun}`);
        if (stop) return;
        setDetail(d);
        if (d.events.length !== count) {
          count = d.events.length;
          buildGraph(d.events);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    const timer = setInterval(load, 2000);
    return () => { stop = true; clearInterval(timer); };
  }, [selectedRun]);

  const respond = async (answer: string) => {
    if (!selectedRun) return;
    try {
      await api(`/api/runs/${selectedRun}/signal`, { method: "POST", body: JSON.stringify({ answer }) });
      setDetail((d) => (d ? { ...d, paused: undefined, running: true } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Transform telemetry events into a DAG
  const buildGraph = (runEvents: TelemetryEvent[]) => {
    const newNodes: any[] = [];
    const newEdges: any[] = [];
    
    let yOffset = 50;
    let xOffset = 250;
    
    // We do a simple vertical layout for now. Fanouts would ideally branch horizontally.
    const stageMap = new Map();

    runEvents.forEach((ev) => {
      // Create nodes for starts/calls
      if (ev.type === "node_start" || ev.type === "tool_call" || ev.type === "llm_call" || ev.type === "stream_start") {
        const id = `${ev.stage}-${ev.id}`;
        // A second stream_start for the same pipeline is the run resuming after a pause.
        const resumed = ev.type === "stream_start" && stageMap.has(ev.stage);
        stageMap.set(ev.stage, id);

        newNodes.push({
          id,
          type: 'stageNode',
          position: { x: xOffset, y: yOffset },
          data: {
            label: resumed ? `${ev.stage} resumed` : ev.stage,
            type: ev.type,
            // Model and tool calls are recorded when they finish.
            status: ev.type === "llm_call" || ev.type === "tool_call" ? "success" : "running",
            duration: ev.type === "llm_call" || ev.type === "tool_call" ? ev.duration_ms : undefined,
            originalEvent: ev
          }
        });
        
        // Connect to previous
        if (newNodes.length > 1) {
          const prevId = newNodes[newNodes.length - 2].id;
          newEdges.push({
            id: `e-${prevId}-${id}`,
            source: prevId,
            target: id,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed }
          });
        }
        
        yOffset += 90;
      }
      
      // Update nodes on end/error
      if (ev.type === "node_end" || ev.type === "stream_end" || ev.type === "error") {
        const nodeId = stageMap.get(ev.stage);
        if (nodeId) {
          const node = newNodes.find(n => n.id === nodeId);
          if (node) {
            node.data.status = ev.type === "error" ? "error" : "success";
            node.data.duration = ev.duration_ms;
            node.data.resultEvent = ev; // Attach result for inspector
          }
        }
      }
    });
    
    // Stop animations for completed edges
    newEdges.forEach(e => { e.animated = false; });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const onNodeClick = (_: any, node: any) => {
    // Show the result payload if available, else the input payload
    const eventToShow = node.data.resultEvent || node.data.originalEvent;
    setSelectedEvent(eventToShow);
  };

  return (
    <div className="app-container">
      {/* Sidebar: Run List */}
      <div className="sidebar">
        {error && <div className="banner error">{error}</div>}
        <h2>Pipelines</h2>
        <div className="pipeline-list">
          {pipelines.map((p) => (
            <PipelineItem key={p.name} p={p} onStarted={(id) => { setSelectedRun(id); setSelectedEvent(null); }} />
          ))}
        </div>
        <h2>Runs</h2>
        <div className="run-list">
          {runs.map(r => (
            <div 
              key={r.run_id} 
              className={`run-item ${selectedRun === r.run_id ? 'active' : ''}`}
              onClick={() => { setSelectedRun(r.run_id); setSelectedEvent(null); }}
            >
              <div className="run-title">
                <span className="run-pipeline">{r.pipeline ?? "Unknown pipeline"}</span>
                <span className={`run-status ${r.status ?? "running"}`}>{r.status ?? "running"}</span>
              </div>
              <div className="run-meta">
                {new Date(r.start_time).toLocaleString()} · {((r.end_time - r.start_time) / 1000).toFixed(1)}s
                {r.cost ? ` · $${r.cost.toFixed(4)}` : ""}
              </div>
              <div className="run-id">{r.run_id.slice(0, 8)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas: React Flow DAG */}
      <div className="canvas">
        {detail?.paused && detail.runId === selectedRun && (
          <div className="banner paused">
            <div>
              <strong>Waiting for {detail.paused.waitingFor === "yield" ? "you" : detail.paused.waitingFor}</strong>
              {detail.paused.message && <span>: {detail.paused.message}</span>}
            </div>
            <div className="banner-actions">
              <button className="approve" onClick={() => respond("approve")}>Approve</button>
              <button onClick={() => respond("reject")}>Reject</button>
              <a href={detail.paused.approveUrl} target="_blank" rel="noreferrer">Approval link</a>
            </div>
          </div>
        )}
        {selectedRun ? (
          <ReactFlow
            onInit={setFlow}
            nodes={nodes} 
            edges={edges} 
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.1 }}
            minZoom={0.1}
          >
            <Background />
            <Controls />
          </ReactFlow>
        ) : (
          <div className="empty-state">Select a run to view its trace</div>
        )}
      </div>

      {/* Right Panel: Payload Inspector */}
      {selectedEvent && (
        <div className="inspector">
          <div className="inspector-header">
            <h3>{selectedEvent.stage}</h3>
            <button onClick={() => setSelectedEvent(null)}>✕</button>
          </div>
          <div className="inspector-meta">
            <span>Type: {selectedEvent.type}</span>
            {selectedEvent.duration_ms != null && <span>Latency: {selectedEvent.duration_ms}ms</span>}
            {selectedEvent.tokens != null && <span>Tokens: {selectedEvent.tokens}</span>}
            {(() => {
              const cost = (parsePayload(selectedEvent.payload) as { cost?: unknown } | null)?.cost;
              return typeof cost === "number" && cost > 0 ? <span>Cost: ${cost.toFixed(5)}</span> : null;
            })()}
          </div>
          <div className="inspector-payload">
            <PayloadView payload={selectedEvent.payload} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
