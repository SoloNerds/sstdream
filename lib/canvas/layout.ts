import dagre from '@dagrejs/dagre';
import type { CanvasNode, CanvasEdge } from './types';

// Auto-layout for the canvas: a left-to-right layered (Sugiyama) arrangement via dagre,
// matching the source→target data flow. Used by the "Auto-layout" button and applied to
// freshly imported designs (a 20-node scan is unreadable in the reverse parser's naive
// grid). Pure — returns new nodes with updated positions; never mutates the input.
// NOTE: only the builder imports this (so dagre stays out of the CLI scan bundle).

const NODE_W = 200;
const NODE_H = 80;

export function layoutGraph(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 130, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    if (!p) return n;
    // dagre returns the node CENTER; React Flow positions by the top-left corner.
    return {
      ...n,
      position: { x: Math.round(p.x - NODE_W / 2), y: Math.round(p.y - NODE_H / 2) },
    };
  });
}
