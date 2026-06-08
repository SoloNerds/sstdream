import { create } from 'zustand';
import type { CanvasEdge, CanvasNode } from './types';
import { DEFAULT_TARGET, getTarget } from '@/lib/targets/registry';
import type { DeployTarget } from '@/lib/targets/types';
import type { CanvasSnapshot } from '@/lib/core/blueprint/serialize';
import type { Blueprint } from '@/lib/core/blueprint/types';

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

/** Test-only: reset the monotonic id counter for deterministic assertions. */
export function __resetIdsForTest() {
  idCounter = 0;
}

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}${i}`)) i += 1;
  return `${base}${i}`;
}

function bumpCounterPast(ids: string[]): void {
  for (const id of ids) {
    const m = /_(\d+)$/.exec(id);
    if (m) idCounter = Math.max(idCounter, Number(m[1]));
  }
}

export interface AppConfigState {
  name: string;
  region: string;
  packageManager: Blueprint['app']['packageManager'];
}

export interface CanvasState {
  targetId: DeployTarget;
  app: AppConfigState;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedId: string | null;

  addNode: (kind: string, position: { x: number; y: number }) => string;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  renameNode: (id: string, name: string) => void;
  setNodeProps: (id: string, props: Record<string, unknown>) => void;

  /** Returns the new edge id, or null if rejected (self-loop, duplicate, or not meaningful). */
  addEdge: (source: string, target: string) => string | null;
  removeEdge: (id: string) => void;
  setEdgeIntent: (id: string, intent: string) => void;

  select: (id: string | null) => void;
  setApp: (partial: Partial<AppConfigState>) => void;
  loadSnapshot: (snapshot: CanvasSnapshot) => void;
  reset: () => void;
}

const INITIAL_APP: AppConfigState = {
  name: 'my-app',
  region: 'us-east-1',
  packageManager: 'yarn',
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  targetId: DEFAULT_TARGET,
  app: { ...INITIAL_APP },
  nodes: [],
  edges: [],
  selectedId: null,

  addNode: (kind, position) => {
    const meta = getTarget(get().targetId).catalog[kind];
    if (!meta) throw new Error(`Unknown resource kind for target: ${kind}`);
    const id = nextId(kind);
    const taken = new Set(get().nodes.map((n) => n.name));
    const name = uniqueName(meta.defaultName, taken);
    set((s) => ({ nodes: [...s.nodes, { id, kind, name, props: {}, position }] }));
    return id;
  },

  moveNode: (id, position) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, position } : n)) })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  renameNode: (id, name) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, name } : n)) })),

  setNodeProps: (id, props) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, props: { ...n.props, ...props } } : n)),
    })),

  addEdge: (source, target) => {
    if (source === target) return null;
    const { nodes, edges, targetId } = get();
    const src = nodes.find((n) => n.id === source);
    const tgt = nodes.find((n) => n.id === target);
    if (!src || !tgt) return null;
    if (edges.some((e) => e.source === source && e.target === target)) return null;
    const intent = getTarget(targetId).defaultIntent(src.kind, tgt.kind);
    if (!intent) return null;
    const id = nextId('edge');
    set((s) => ({ edges: [...s.edges, { id, source, target, intent }] }));
    return id;
  },

  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  setEdgeIntent: (id, intent) =>
    set((s) => ({ edges: s.edges.map((e) => (e.id === id ? { ...e, intent } : e)) })),

  select: (id) => set({ selectedId: id }),

  setApp: (partial) => set((s) => ({ app: { ...s.app, ...partial } })),

  loadSnapshot: (snapshot) => {
    bumpCounterPast([...snapshot.nodes.map((n) => n.id), ...snapshot.edges.map((e) => e.id)]);
    set({
      nodes: snapshot.nodes.map((n) => ({
        id: n.id,
        kind: n.kind,
        name: n.name,
        props: n.props ?? {},
        position: n.position,
      })),
      edges: snapshot.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        intent: e.intent,
      })),
      selectedId: null,
    });
  },

  reset: () => set({ nodes: [], edges: [], selectedId: null }),
}));
