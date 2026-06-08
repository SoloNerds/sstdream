'use client';

import { useCallback } from 'react';
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
import { ResourceNode } from './nodes/ResourceNode';
import { DRAG_MIME } from './Palette';

const nodeTypes = { resource: ResourceNode };

export function Canvas() {
  const targetId = useCanvasStore((s) => s.targetId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const addNode = useCanvasStore((s) => s.addNode);
  const moveNode = useCanvasStore((s) => s.moveNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const select = useCanvasStore((s) => s.select);

  const rfNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    type: 'resource',
    position: n.position,
    data: { name: n.name, kind: n.kind },
    selected: n.id === selectedId,
  }));

  const rfEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.intent,
    labelStyle: { fontSize: 10 },
  }));

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
