import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore, __resetIdsForTest } from './store';

const state = () => useCanvasStore.getState();

beforeEach(() => {
  __resetIdsForTest();
  useCanvasStore.setState({ nodes: [], edges: [], selectedId: null });
});

describe('canvas store', () => {
  it('adds nodes with their catalog label and unique ids', () => {
    const a = state().addNode('bucket', { x: 0, y: 0 });
    const b = state().addNode('queue', { x: 10, y: 10 });
    expect(state().nodes).toHaveLength(2);
    expect(a).not.toBe(b);
    expect(state().nodes[0].label).toBe('Bucket');
  });

  it('moves a node', () => {
    const id = state().addNode('bucket', { x: 0, y: 0 });
    state().moveNode(id, { x: 5, y: 7 });
    expect(state().nodes[0].position).toEqual({ x: 5, y: 7 });
  });

  it('adds edges but rejects self-loops and duplicates', () => {
    const a = state().addNode('nextjs', { x: 0, y: 0 });
    const b = state().addNode('bucket', { x: 1, y: 1 });
    expect(state().addEdge(a, a)).toBeNull();
    expect(state().addEdge(a, b)).not.toBeNull();
    expect(state().addEdge(a, b)).toBeNull();
    expect(state().edges).toHaveLength(1);
  });

  it('removes a node and all edges touching it, clearing selection', () => {
    const a = state().addNode('nextjs', { x: 0, y: 0 });
    const b = state().addNode('bucket', { x: 1, y: 1 });
    state().addEdge(a, b);
    state().select(a);
    state().removeNode(a);
    expect(state().nodes).toHaveLength(1);
    expect(state().edges).toHaveLength(0);
    expect(state().selectedId).toBeNull();
  });

  it('removes an edge by id', () => {
    const a = state().addNode('nextjs', { x: 0, y: 0 });
    const b = state().addNode('bucket', { x: 1, y: 1 });
    const e = state().addEdge(a, b);
    expect(e).not.toBeNull();
    state().removeEdge(e as string);
    expect(state().edges).toHaveLength(0);
  });

  it('renames a node', () => {
    const id = state().addNode('bucket', { x: 0, y: 0 });
    state().renameNode(id, 'Uploads');
    expect(state().nodes[0].label).toBe('Uploads');
  });
});
