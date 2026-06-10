'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget } from '@/lib/targets/registry';
import { useSimStore } from '@/lib/canvas/simStore';
import type { SimStatus } from '@/lib/core/simulation/types';
import { ResourceNode } from './nodes/ResourceNode';
import { DRAG_MIME } from './Palette';
import { useCost } from './useCost';
import { useValidation } from './useValidation';

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
  const removeNode = useCanvasStore((s) => s.removeNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const select = useCanvasStore((s) => s.select);

  // React Flow's selection model: edge selection lives here (the store only
  // tracks the selected node), so keyboard Delete/Backspace can target edges.
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<ReadonlySet<string>>(new Set());

  const cost = useCost();
  const costById = useMemo(
    () => Object.fromEntries(cost.perResource.map((r) => [r.resourceId, r.monthlyUsd])),
    [cost],
  );

  const validation = useValidation();
  const issuesById = useMemo(() => {
    const map: Record<string, { severity: 'error' | 'warning'; messages: string[] }> = {};
    for (const d of validation.diagnostics) {
      if (!d.resourceId || d.severity === 'info') continue;
      const sev = d.severity as 'error' | 'warning';
      const cur = map[d.resourceId];
      if (!cur) map[d.resourceId] = { severity: sev, messages: [d.message] };
      else {
        cur.messages.push(d.message);
        if (sev === 'error') cur.severity = 'error';
      }
    }
    return map;
  }, [validation]);

  const rfNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    type: 'resource',
    position: n.position,
    data: { name: n.name, kind: n.kind, cost: costById[n.id], issue: issuesById[n.id] },
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
    const color = status ? STATUS_COLOR[status] : '#64748b';
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      selected: selectedEdgeIds.has(e.id),
      label: e.intent,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      animated: e.id === activeEdgeId,
      style: { stroke: color, strokeWidth: status ? 2.5 : 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
    };
  });

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, change.position);
        } else if (change.type === 'remove') {
          removeNode(change.id);
        } else if (change.type === 'select') {
          if (change.selected) select(change.id);
          else if (useCanvasStore.getState().selectedId === change.id) select(null);
        }
      }
    },
    [moveNode, removeNode, select],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          removeEdge(change.id);
          setSelectedEdgeIds((prev) => {
            if (!prev.has(change.id)) return prev;
            const next = new Set(prev);
            next.delete(change.id);
            return next;
          });
        } else if (change.type === 'select') {
          setSelectedEdgeIds((prev) => {
            if (prev.has(change.id) === change.selected) return prev;
            const next = new Set(prev);
            if (change.selected) next.add(change.id);
            else next.delete(change.id);
            return next;
          });
        }
      }
    },
    [removeEdge],
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
      className="relative h-full w-full"
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
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => select(node.id)}
        onPaneClick={() => select(null)}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(100,116,139,0.35)" gap={18} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white/70 px-6 py-5 text-center text-sm text-neutral-500 backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/60">
            <p className="font-medium text-neutral-700 dark:text-neutral-200">Start your design</p>
            <p className="mt-1">
              Drag a resource from the left, or click <span className="font-medium">Templates</span>
              .
            </p>
            <p className="mt-0.5 text-xs">
              Wire nodes by dragging a node&apos;s right dot → another node&apos;s left dot.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
