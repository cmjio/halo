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

// The Studio API (studio/server.ts). Set VITE_HALO_API to point at another port.
const API: string = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_HALO_API ?? "http://localhost:4000";

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
      {data.duration && <div className="node-metrics">{data.duration}ms</div>}
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

  // Fetch runs on load
  useEffect(() => {
    fetch(`${API}/api/runs`)
      .then(res => res.json())
      .then(setRuns)
      .catch(console.error);
  }, []);

  // Fetch events when run is selected
  useEffect(() => {
    if (!selectedRun) return;
    fetch(`${API}/api/runs/${selectedRun}`)
      .then(res => res.json())
      .then(data => {
        buildGraph(data);
      })
      .catch(console.error);
  }, [selectedRun]);

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
        stageMap.set(ev.stage, id);
        
        newNodes.push({
          id,
          type: 'stageNode',
          position: { x: xOffset, y: yOffset },
          data: {
            label: ev.stage,
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
        <h2>Runs</h2>
        <div className="run-list">
          {runs.map(r => (
            <div 
              key={r.run_id} 
              className={`run-item ${selectedRun === r.run_id ? 'active' : ''}`}
              onClick={() => setSelectedRun(r.run_id)}
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
