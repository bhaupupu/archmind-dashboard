"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Skeleton } from "@/components/ui/skeleton";
import { NodePanel } from "./NodePanel";
import { CustomNode } from "./CustomNode";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import dagre from 'dagre';

const nodeTypes = {
  customNode: CustomNode
};

const EDGE_STYLES: Record<string, { color: string; dashed: boolean; label: string }> = {
  DEPENDS_ON: { color: '#52525b', dashed: false, label: 'Package Dep' },
  CALLS: { color: '#3b82f6', dashed: true, label: 'API Call' },
  REFERENCES_ENV: { color: '#eab308', dashed: false, label: 'Shared Env' },
  SHARES_SCHEMA: { color: '#a855f7', dashed: true, label: 'Shared Schema' },
  PUBLISHES: { color: '#22c55e', dashed: false, label: 'Publishes' },
  SUBSCRIBES: { color: '#22c55e', dashed: true, label: 'Subscribes' },
  EXPOSES: { color: '#3b82f6', dashed: false, label: 'Exposes API' },
  USES_SYMBOL: { color: '#f97316', dashed: false, label: 'SCIP Symbol' }
};

export function DependencyGraph({ report }: { report?: any }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [edgeFilters, setEdgeFilters] = useState<Record<string, boolean>>({
    DEPENDS_ON: true,
    CALLS: true,
    REFERENCES_ENV: true,
    SHARES_SCHEMA: true,
    PUBLISHES: true,
    SUBSCRIBES: true,
    EXPOSES: true,
    USES_SYMBOL: true
  });

  const getLayoutedElements = useCallback((nodes: any[], edges: any[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    // We increase spacing for layout
    dagreGraph.setGraph({ rankdir: direction, ranker: 'longest-path', nodesep: 100, ranksep: 120 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 220, height: 80 });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.position = {
        x: nodeWithPosition.x - 220 / 2,
        y: nodeWithPosition.y - 80 / 2,
      };
      return node;
    });

    return { nodes, edges };
  }, []);

  const [rawGraph, setRawGraph] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });

  useEffect(() => {
    async function loadGraph() {
      try {
        const url = report?.analysisId ? `/api/v1/full-graph?analysisId=${report.analysisId}` : '/api/v1/full-graph';
        const res = await fetch(url);
        const data = await res.json();
        setRawGraph(data);
      } catch (err) {
        console.error("Failed to load graph", err);
      } finally {
        setLoading(false);
      }
    }
    loadGraph();
  }, [report]);

  useEffect(() => {
    if (!rawGraph?.nodes?.length) return;

    const rfNodes = rawGraph.nodes.map((n: any) => ({
      ...n,
      type: 'customNode',
    }));

    const rfEdges = rawGraph.edges.map((e: any) => {
      const typeStr = e.data?.type || 'DEPENDS_ON';
      const styleInfo = EDGE_STYLES[typeStr] || EDGE_STYLES.DEPENDS_ON;
      
      return {
        ...e,
        animated: report ? true : styleInfo.dashed, // animate if there's a report or if it's dashed
        hidden: !edgeFilters[typeStr],
        markerEnd: { type: MarkerType.ArrowClosed, color: styleInfo.color },
        style: { stroke: styleInfo.color, strokeWidth: 1.5, strokeDasharray: styleInfo.dashed ? '5,5' : 'none' }
      };
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rfNodes, rfEdges, 'TB');

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [rawGraph, edgeFilters, report, setNodes, setEdges, getLayoutedElements]);

  if (loading) {
    return <Skeleton className="w-full h-full bg-zinc-900" />;
  }

  const onNodeClick = (_: React.MouseEvent, node: any) => {
    setSelectedNode(node);
  };

  const toggleFilter = (type: string) => {
    setEdgeFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div style={{ width: '100%', height: '100%' }} className="rounded-lg overflow-hidden bg-transparent relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedNode(null)}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Controls className="!bg-surface !border-white/10 !fill-white" />
        <MiniMap className="bg-[#0B1120] border-white/10" maskColor="rgba(0,0,0,0.6)" />
        <Background color="#1E293B" gap={16} />

        <Panel position="top-right" className="bg-zinc-900/90 border border-zinc-800 p-3 rounded-md shadow-lg backdrop-blur text-xs flex flex-col gap-2 m-2">
          <div className="font-semibold text-zinc-300 mb-1">Architecture Toggles</div>
          {Object.entries(EDGE_STYLES).map(([type, style]) => (
            <div key={type} className="flex items-center space-x-2">
              <Switch 
                id={`toggle-${type}`} 
                checked={edgeFilters[type]} 
                onCheckedChange={() => toggleFilter(type)} 
                className="scale-75 origin-left"
              />
              <Label htmlFor={`toggle-${type}`} className="flex items-center gap-2 cursor-pointer text-zinc-400">
                <div 
                  className="w-4 h-0 border-t-2" 
                  style={{ 
                    borderColor: style.color, 
                    borderStyle: style.dashed ? 'dashed' : 'solid' 
                  }} 
                />
                {style.label}
              </Label>
            </div>
          ))}
        </Panel>
      </ReactFlow>
      
      <NodePanel node={selectedNode} report={report} onClose={() => setSelectedNode(null)} />
    </div>
  );
}
