'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget } from '@/lib/targets/registry';
import { useSimStore } from '@/lib/canvas/simStore';
import type { SimStatus } from '@/lib/core/simulation/types';
import { ResourceNode } from './nodes/ResourceNode';
import { DRAG_MIME } from './Palette';
import { useCost } from './useCost';

const nodeTypes = { resource: ResourceNode };

const STATUS_COLOR: Record<SimStatus, string> = {
  ok: '#16a34a',
  broken: '#dc2626',
  warning: '#d97706',
};

export function Canvas() {
  const targetId = useCanvasStore((s) => s.targetId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const addNode = useCanvasStore((s) => s.addNode);
  const moveNode = useCanvasStore((s) => s.moveNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const select = useCanvasStore((s) => s.select);

  const cost = useCost();
  const costById = useMemo(
    () => Object.fromEntries(cost.perResource.map((r) => [r.resourceId, r.monthlyUsd])),
    [cost],
  );

  const rfNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    type: 'resource',
    position: n.position,
    data: { name: n.name, kind: n.kind, cost: costById[n.id] },
    selected: n.id === selectedId,
  }));

  const simTrace = useSimStore((s) => s.trace);
  const simIndex = useSimStore((s) => s.index);
  const edgeStatus = useMemo(() => {
    const map: Record<string, SimStatus> = {};
    if (simTrace) {
      const limit = simIndex < 0 ? simTrace.events.length : simIndex + 1;
      for (const ev of simTrace.events.slice(0, limit)) {
        if (ev.edgeId && map[ev.edgeId] !== 'broken') map[ev.edgeId] = ev.status;
      }
    }
    return map;
  }, [simTrace, simIndex]);
  const activeEdgeId = simTrace && simIndex >= 0 ? simTrace.events[simIndex]?.edgeId : undefined;

  const rfEdges: Edge[] = edges.map((e) => {
    const status = edgeStatus[e.id];
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.intent,
      labelStyle: { fontSize: 10 },
      animated: e.id === activeEdgeId,
      style: status ? { stroke: STATUS_COLOR[status], strokeWidth: 2 } : undefined,
    };
  });

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, change.position);
        }
      }
    },
    [moveNode],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addEdge(connection.source, connection.target);
      }
    },
    [addEdge],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(DRAG_MIME);
      if (!kind || !(kind in getTarget(targetId).catalog)) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      addNode(kind, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    },
    [addNode, targetId],
  );

  return (
    <div
      className="h-full w-full"
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => select(node.id)}
        onPaneClick={() => select(null)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
