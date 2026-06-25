import { describe, it, expect } from 'vitest';
import { recommendBlueprint } from './recommend';
import { draftBlueprint, type CanvasSnapshot } from '@/lib/core/blueprint/serialize';
import { AI_PROCESSING_APP } from '@/lib/templates/ai-processing-app';

const NOW = '2026-06-08T00:00:00.000Z';
const app = { name: 'demo-app', packageManager: 'yarn' as const, region: 'us-east-1' };
const bpOf = (snapshot: CanvasSnapshot) => draftBlueprint(snapshot, 'aws-sst-v4', app, NOW);

describe('AWS recommendations', () => {
  it('suggests a dead-letter queue for the AI Processing App (consumed queue)', () => {
    const recs = recommendBlueprint(
      draftBlueprint(AI_PROCESSING_APP.snapshot, 'aws-sst-v4', AI_PROCESSING_APP.app, NOW),
    );
    expect(recs.some((r) => r.id.startsWith('dlq-') && r.title.includes('dead-letter'))).toBe(true);
    // a fully-wired design has no wiring fixes
    expect(recs.some((r) => r.kind === 'wiring')).toBe(false);
  });

  it('offers a one-click fix to link an unused bucket, and is idempotent', () => {
    const bp = bpOf({
      nodes: [
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'b9', kind: 'bucket', name: 'Uploads', props: {}, position: { x: 200, y: 0 } },
      ],
      edges: [],
    });
    const rec = recommendBlueprint(bp).find((r) => r.id === 'link-bucket-b9');
    expect(rec?.apply).toBeTypeOf('function');

    const applied = rec!.apply!(bp);
    expect(applied.connections).toHaveLength(1);
    expect(applied.connections[0]).toMatchObject({
      source: 'n1',
      target: 'b9',
      intent: 'uploadsTo',
    });

    // the rec no longer appears once applied...
    expect(recommendBlueprint(applied).some((r) => r.id === 'link-bucket-b9')).toBe(false);
    // ...and applying twice equals applying once
    expect(rec!.apply!(applied)).toEqual(applied);
  });

  it('adds a worker (node + subscribesTo edge) for an unconsumed queue', () => {
    const bp = bpOf({
      nodes: [{ id: 'q1', kind: 'queue', name: 'Jobs', props: {}, position: { x: 0, y: 0 } }],
      edges: [],
    });
    const rec = recommendBlueprint(bp).find((r) => r.id === 'add-worker-q1');
    expect(rec?.apply).toBeTypeOf('function');

    const applied = rec!.apply!(bp);
    const worker = applied.resources.find((r) => r.kind === 'worker');
    expect(worker?.name).toBe('JobsWorker');
    expect(
      applied.connections.some(
        (c) => c.source === worker!.id && c.target === 'q1' && c.intent === 'subscribesTo',
      ),
    ).toBe(true);
    // now consumed → no add-worker rec, but DLQ advisory appears
    const after = recommendBlueprint(applied);
    expect(after.some((r) => r.id === 'add-worker-q1')).toBe(false);
    expect(after.some((r) => r.id === 'dlq-q1')).toBe(true);
  });
});
