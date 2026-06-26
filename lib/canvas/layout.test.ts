import { describe, it, expect } from 'vitest';
import { layoutGraph } from './layout';
import type { CanvasNode, CanvasEdge } from './types';

const n = (id: string): CanvasNode => ({
  id,
  kind: 'worker',
  name: id,
  props: {},
  position: { x: 0, y: 0 }, // all overlapping at the origin to start
});

describe('layoutGraph (dagre auto-layout)', () => {
  it('returns the input unchanged when empty', () => {
    expect(layoutGraph([], [])).toEqual([]);
  });

  it('lays a chain out left-to-right by dependency depth', () => {
    const nodes = [n('a'), n('b'), n('c')];
    const edges: CanvasEdge[] = [
      { id: 'e1', source: 'a', target: 'b', intent: 'usesSecret' },
      { id: 'e2', source: 'b', target: 'c', intent: 'usesSecret' },
    ];
    const out = layoutGraph(nodes, edges);
    const x = (id: string) => out.find((m) => m.id === id)!.position.x;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
  });

  it('gives every node a distinct position (no origin pile-up)', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => n(`r${i}`));
    const edges: CanvasEdge[] = [
      { id: 'e1', source: 'r0', target: 'r1', intent: 'usesSecret' },
      { id: 'e2', source: 'r0', target: 'r2', intent: 'usesSecret' },
    ];
    const out = layoutGraph(nodes, edges);
    const coords = new Set(out.map((m) => `${m.position.x},${m.position.y}`));
    expect(coords.size).toBe(nodes.length); // all distinct
    // disconnected nodes (r3..r7) still got real positions, not (0,0)
    expect(out.every((m) => m.position.x !== 0 || m.position.y !== 0)).toBe(true);
  });

  it('does not mutate the input nodes', () => {
    const nodes = [n('a')];
    const before = nodes[0].position;
    layoutGraph(nodes, []);
    expect(nodes[0].position).toBe(before);
  });
});
