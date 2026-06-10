import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore, __resetIdsForTest } from './store';

const state = () => useCanvasStore.getState();

beforeEach(() => {
  __resetIdsForTest();
  useCanvasStore.setState({ nodes: [], edges: [], selectedId: null });
});

describe('canvas store', () => {
  it('adds nodes with the catalog default name and unique names', () => {
    const a = state().addNode('bucket', { x: 0, y: 0 });
    const b = state().addNode('bucket', { x: 10, y: 10 });
    expect(state().nodes).toHaveLength(2);
    expect(a).not.toBe(b);
    expect(state().nodes[0].name).toBe('Bucket');
    expect(state().nodes[1].name).toBe('Bucket2');
  });

  it('infers a default edge intent from the source/target kinds', () => {
    const web = state().addNode('nextjs', { x: 0, y: 0 });
    const bucket = state().addNode('bucket', { x: 1, y: 1 });
    const id = state().addEdge(web, bucket);
    expect(id).not.toBeNull();
    expect(state().edges[0].intent).toBe('uploadsTo');
  });

  it('rejects self-loops and duplicate edges', () => {
    const web = state().addNode('nextjs', { x: 0, y: 0 });
    const queue = state().addNode('queue', { x: 1, y: 1 });
    expect(state().addEdge(web, web)).toBeNull();
    expect(state().addEdge(web, queue)).not.toBeNull();
    expect(state().addEdge(web, queue)).toBeNull();
    expect(state().edges).toHaveLength(1);
  });

  it('removes an edge by id, leaving the nodes in place', () => {
    const web = state().addNode('nextjs', { x: 0, y: 0 });
    const bucket = state().addNode('bucket', { x: 1, y: 1 });
    const id = state().addEdge(web, bucket);
    expect(id).not.toBeNull();
    state().removeEdge(id!);
    expect(state().edges).toHaveLength(0);
    expect(state().nodes).toHaveLength(2);
    // removing an unknown edge id is a no-op
    state().removeEdge('edge_999');
    expect(state().edges).toHaveLength(0);
  });

  it('removes a node and all edges touching it, clearing selection', () => {
    const web = state().addNode('nextjs', { x: 0, y: 0 });
    const bucket = state().addNode('bucket', { x: 1, y: 1 });
    state().addEdge(web, bucket);
    state().select(web);
    state().removeNode(web);
    expect(state().nodes).toHaveLength(1);
    expect(state().edges).toHaveLength(0);
    expect(state().selectedId).toBeNull();
  });

  it('renames a node and merges props', () => {
    const id = state().addNode('bucket', { x: 0, y: 0 });
    state().renameNode(id, 'Uploads');
    state().setNodeProps(id, { access: 'public' });
    state().setNodeProps(id, { cors: true });
    expect(state().nodes[0].name).toBe('Uploads');
    expect(state().nodes[0].props).toEqual({ access: 'public', cors: true });
  });

  it('loads a snapshot and keeps generating non-colliding ids', () => {
    state().loadSnapshot({
      nodes: [
        { id: 'bucket_3', kind: 'bucket', name: 'Uploads', props: {}, position: { x: 0, y: 0 } },
      ],
      edges: [],
    });
    expect(state().nodes).toHaveLength(1);
    const newId = state().addNode('queue', { x: 5, y: 5 });
    expect(newId).not.toBe('bucket_3');
    expect(state().nodes).toHaveLength(2);
  });
});
