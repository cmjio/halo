import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

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
}

// ── Custom Node Components ──

const StageNode = ({ data }: any) => {
  const isError = data.status === "error";
  const isRunning = data.status === "running";
  
  return (
    <div className={`stage-node ${data.type} ${isError ? 'error' : ''} ${isRunning ? 'running' : ''}`}>
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
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TelemetryEvent | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch runs on load
  useEffect(() => {
    fetch('http://localhost:4000/api/runs')
      .then(res => res.json())
      .then(setRuns)
      .catch(console.error);
  }, []);

  // Fetch events when run is selected
  useEffect(() => {
    if (!selectedRun) return;
    fetch(`http://localhost:4000/api/runs/${selectedRun}`)
      .then(res => res.json())
      .then(data => {
        setEvents(data);
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

    runEvents.forEach((ev, i) => {
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
            status: 'running',
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
        
        yOffset += 120;
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
              <div className="run-id">{r.run_id}</div>
              <div className="run-meta">{new Date(r.start_time).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas: React Flow DAG */}
      <div className="canvas">
        {selectedRun ? (
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
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
            {selectedEvent.duration_ms && <span>Latency: {selectedEvent.duration_ms}ms</span>}
            {selectedEvent.tokens && <span>Tokens: {selectedEvent.tokens}</span>}
          </div>
          <div className="inspector-payload">
            <h4>Payload</h4>
            <pre>
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(selectedEvent.payload || "null"), null, 2);
                } catch {
                  return selectedEvent.payload;
                }
              })()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
