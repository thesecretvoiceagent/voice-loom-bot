import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Rocket, Loader2, Undo2, Redo2, Maximize2, Phone } from "lucide-react";
import { toast } from "sonner";
import { useAgentFlow } from "@/hooks/useAgentFlow";
import { useAgents } from "@/hooks/useAgents";
import { useAuth } from "@/contexts/AuthContext";
import { customNodeTypes } from "@/components/flow/nodeTypes";
import { FlowSidebar } from "@/components/flow/FlowSidebar";
import { NodeConfigPanel } from "@/components/flow/NodeConfigPanel";
import { FLOW_TEMPLATES } from "@/components/flow/flowTemplates";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickTestCallDialog } from "@/components/agents/QuickTestCallDialog";

function FlowBuilderInner() {
  const { id: agentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agents } = useAgents();
  const agent = agents.find((a) => a.id === agentId);
  const { flow, loading, saving, lastSaved, createFlow, saveFlow, publishFlow, scheduleAutoSave } = useAgentFlow(agentId!);
  const [testCallOpen, setTestCallOpen] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [initialized, setInitialized] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Undo/redo stacks
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const pushHistory = useCallback((n: Node[], e: Edge[]) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      next.push({ nodes: structuredClone(n), edges: structuredClone(e) });
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIndex((i) => Math.min(i + 1, 49));
  }, [historyIndex]);

  // Load flow once
  useEffect(() => {
    if (!loading && flow && !initialized) {
      setNodes(flow.nodes);
      setEdges(flow.edges);
      pushHistory(flow.nodes, flow.edges);
      setInitialized(true);
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    }
  }, [loading, flow, initialized]);

  // Autosave on changes
  useEffect(() => {
    if (initialized && flow) {
      scheduleAutoSave(nodes, edges);
    }
  }, [nodes, edges, initialized]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge({ ...connection, animated: true, style: { stroke: "hsl(160 85% 55%)" } }, eds);
        pushHistory(nodes, next);
        return next;
      });
    },
    [nodes, pushHistory]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow-type");
      const label = e.dataTransfer.getData("application/reactflow-label");
      if (!type) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label },
      };
      setNodes((nds) => {
        const next = [...nds, newNode];
        pushHistory(next, edges);
        return next;
      });
    },
    [screenToFlowPosition, edges, pushHistory]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const handleNodeUpdate = useCallback(
    (id: string, data: Record<string, unknown>) => {
      setNodes((nds) => {
        const next = nds.map((n) => (n.id === id ? { ...n, data } : n));
        pushHistory(next, edges);
        return next;
      });
      setSelectedNode((prev) => (prev && prev.id === id ? { ...prev, data } : prev));
    },
    [edges, pushHistory]
  );

  const handleNodeDelete = useCallback(
    (id: string) => {
      setNodes((nds) => {
        const next = nds.filter((n) => n.id !== id);
        setEdges((eds) => {
          const nextEdges = eds.filter((e) => e.source !== id && e.target !== id);
          pushHistory(next, nextEdges);
          return nextEdges;
        });
        return next;
      });
      setSelectedNode(null);
    },
    [pushHistory]
  );

  const handleNodeDuplicate = useCallback(
    (node: Node) => {
      const newNode: Node = {
        ...structuredClone(node),
        id: `${node.type}-${Date.now()}`,
        position: { x: node.position.x + 40, y: node.position.y + 60 },
      };
      setNodes((nds) => {
        const next = [...nds, newNode];
        pushHistory(next, edges);
        return next;
      });
    },
    [edges, pushHistory]
  );

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setHistoryIndex((i) => i - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setNodes(next.nodes);
    setEdges(next.edges);
    setHistoryIndex((i) => i + 1);
  }, [history, historyIndex]);

  const handleSave = async () => {
    try {
      await saveFlow(nodes, edges);
      toast.success("Flow saved");
    } catch {
      toast.error("Failed to save");
    }
  };

  const handlePublish = async () => {
    try {
      await saveFlow(nodes, edges);
      await publishFlow();
      toast.success("Flow published!");
    } catch {
      toast.error("Failed to publish");
    }
  };

  const handleCreateWithTemplate = async (templateIndex: number) => {
    if (!user) return;
    try {
      const template = FLOW_TEMPLATES[templateIndex];
      const created = await createFlow(user.id);
      if (created) {
        await saveFlow(template.nodes, template.edges);
        setNodes(template.nodes);
        setEdges(template.edges);
        pushHistory(template.nodes, template.edges);
        setInitialized(true);
        setTimeout(() => fitView({ padding: 0.2 }), 100);
        toast.success("Flow created!");
      }
    } catch {
      toast.error("Failed to create flow");
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  // Template selection screen
  if (!flow) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-background p-8">
        <Button variant="ghost" className="absolute top-4 left-4 gap-2" onClick={() => navigate("/agents")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-foreground mb-2">Create Flow for {agent?.name || "Agent"}</h1>
        <p className="text-muted-foreground mb-8">Choose a starting template</p>
        <div className="grid gap-4 md:grid-cols-2 max-w-2xl w-full">
          {FLOW_TEMPLATES.map((t, i) => (
            <button
              key={t.name}
              onClick={() => handleCreateWithTemplate(i)}
              className="glass-card rounded-xl p-5 text-left hover:border-primary/40 hover:shadow-neon transition-all duration-300 border border-border/50"
            >
              <h3 className="font-semibold text-foreground mb-1">{t.name}</h3>
              <p className="text-sm text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/agents")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="h-5 w-px bg-border" />
          <h2 className="font-semibold text-foreground">{agent?.name || "Agent"} — Flow</h2>
          <Badge variant={flow.status === "published" ? "default" : "secondary"} className="text-xs">
            {flow.status === "published" ? "Published" : "Draft"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              {saving ? "Saving..." : `Saved ${lastSaved.toLocaleTimeString()}`}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={historyIndex <= 0}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={historyIndex >= history.length - 1}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handlePublish} disabled={saving}>
            <Rocket className="h-3.5 w-3.5" /> Publish
          </Button>
          <div className="h-5 w-px bg-border" />
          <Button size="sm" variant="neon" className="gap-1.5" onClick={() => setTestCallOpen(true)}>
            <Phone className="h-3.5 w-3.5" /> Test Call
          </Button>
        </div>
      </div>

      {/* Test Call Dialog */}
      <QuickTestCallDialog
        open={testCallOpen}
        onOpenChange={setTestCallOpen}
        agentName={agent?.name || "Agent"}
        agentId={agentId!}
      />

      {/* Builder */}
      <div className="flex flex-1 overflow-hidden">
        <FlowSidebar />

        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={customNodeTypes}
            defaultEdgeOptions={{ animated: true, style: { stroke: "hsl(160, 85%, 55%)", strokeWidth: 2 } }}
            fitView
            className="bg-background"
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(260, 20%, 15%)" />
            <Controls
              className="!bg-card !border-border !rounded-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-secondary"
            />
            <MiniMap
              nodeColor={() => "hsl(160, 85%, 55%)"}
              maskColor="hsl(260, 20%, 4%, 0.8)"
              className="!bg-card !border-border !rounded-lg"
            />
            <Panel position="bottom-center">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fitView({ padding: 0.2 })}>
                <Maximize2 className="h-3.5 w-3.5" /> Fit View
              </Button>
            </Panel>
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={handleNodeUpdate}
            onDelete={handleNodeDelete}
            onDuplicate={handleNodeDuplicate}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner />
    </ReactFlowProvider>
  );
}
