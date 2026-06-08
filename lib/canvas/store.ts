import { create } from 'zustand';
import type { CanvasEdge, CanvasNode, NodeKind } from './types';
import { NODE_CATALOG } from './catalog';

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

/** Test-only: reset the monotonic id counter for deterministic assertions. */
export function __resetIdsForTest() {
  idCounter = 0;
}

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedId: string | null;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => string;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  /** Returns the new edge id, or null if rejected (self-loop or duplicate). */
  addEdge: (source: string, target: string) => string | null;
  removeEdge: (id: string) => void;
  select: (id: string | null) => void;
  renameNode: (id: string, label: string) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedId: null,

  addNode: (kind, position) => {
    const id = nextId(kind);
    const label = NODE_CATALOG[kind].label;
    set((s) => ({ nodes: [...s.nodes, { id, kind, label, position }] }));
    return id;
  },

  moveNode: (id, position) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, position } : n)) })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      // never leave dangling edges referencing a removed node
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  addEdge: (source, target) => {
    if (source === target) return null;
    const duplicate = get().edges.some((e) => e.source === source && e.target === target);
    if (duplicate) return null;
    const id = nextId('edge');
    set((s) => ({ edges: [...s.edges, { id, source, target }] }));
    return id;
  },

  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  select: (id) => set({ selectedId: id }),

  renameNode: (id, label) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, label } : n)) })),
}));
