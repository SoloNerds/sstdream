import { describe, it, expect } from 'vitest';
import { simulateBlueprint } from './simulate';
import { draftBlueprint, type CanvasSnapshot } from '@/lib/core/blueprint/serialize';
import { AI_PROCESSING_APP } from '@/lib/templates/ai-processing-app';

const NOW = '2026-06-08T00:00:00.000Z';
const app = { name: 'demo-app', packageManager: 'yarn' as const, region: 'us-east-1' };
const sim = (snapshot: CanvasSnapshot) =>
  simulateBlueprint(draftBlueprint(snapshot, 'aws-sst-v4', app, NOW));

describe('AWS simulation — data flow', () => {
  it('traces the full AI Processing App flow with no broken hops', () => {
    const trace = simulateBlueprint(
      draftBlueprint(AI_PROCESSING_APP.snapshot, 'aws-sst-v4', AI_PROCESSING_APP.app, NOW),
    );
    expect(trace.ok).toBe(true);
    expect(trace.brokenCount).toBe(0);
    const labels = trace.events.map((e) => e.label);
    expect(labels).toContain('Web receives traffic');
    expect(labels).toContain('Web uploads to Uploads');
    expect(labels).toContain('Web publishes to Jobs');
    expect(labels).toContain('Jobs delivers to ProcessJob');
    expect(labels).toContain('ProcessJob writes to AppTable');
  });

  it('flags a queue with no consumer as broken', () => {
    const trace = sim({
      nodes: [
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'q1', kind: 'queue', name: 'Jobs', props: {}, position: { x: 1, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'q1', intent: 'publishesTo' }],
    });
    expect(trace.ok).toBe(false);
    expect(trace.events.some((e) => e.status === 'broken' && e.label.includes('no consumer'))).toBe(
      true,
    );
  });

  it('flags an untriggered worker as broken', () => {
    const trace = sim({
      nodes: [
        { id: 'w1', kind: 'worker', name: 'Lonely', props: {}, position: { x: 0, y: 0 } },
        { id: 'd1', kind: 'dynamo', name: 'Data', props: {}, position: { x: 1, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'w1', target: 'd1', intent: 'writesTo' }],
    });
    expect(trace.brokenCount).toBeGreaterThan(0);
    expect(trace.events.some((e) => e.label.includes('never triggered'))).toBe(true);
  });

  it('flags an unwired database as never accessed (not just buckets/dynamo)', () => {
    const trace = sim({
      nodes: [
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'p1', kind: 'postgres', name: 'Db', props: {}, position: { x: 1, y: 0 } },
      ],
      edges: [],
    });
    expect(
      trace.events.some((e) => e.status === 'warning' && e.label === 'Db is never accessed'),
    ).toBe(true);
  });

  it('does not flag a database that is actually queried', () => {
    const trace = sim({
      nodes: [
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'p1', kind: 'postgres', name: 'Db', props: {}, position: { x: 1, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'p1', intent: 'queriesDb' }],
    });
    expect(trace.events.some((e) => e.label.includes('never accessed'))).toBe(false);
  });

  it('traces a dead-letter edge to the DLQ target (no longer invisible)', () => {
    const trace = sim({
      nodes: [
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'q1', kind: 'queue', name: 'Jobs', props: {}, position: { x: 1, y: 0 } },
        { id: 'dlq', kind: 'queue', name: 'JobsDlq', props: {}, position: { x: 2, y: 0 } },
        { id: 'w1', kind: 'worker', name: 'Proc', props: {}, position: { x: 3, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'q1', intent: 'publishesTo' },
        { id: 'e2', source: 'w1', target: 'q1', intent: 'subscribesTo' },
        { id: 'e3', source: 'q1', target: 'dlq', intent: 'deadLettersTo' },
      ],
    });
    expect(trace.ok).toBe(true);
    expect(trace.events.some((e) => e.label === 'Jobs dead-letters to JobsDlq')).toBe(true);
  });

  it('traces a cron → worker → table flow', () => {
    const trace = sim({
      nodes: [
        { id: 'c1', kind: 'cron', name: 'Daily', props: {}, position: { x: 0, y: 0 } },
        { id: 'w1', kind: 'worker', name: 'Report', props: {}, position: { x: 1, y: 0 } },
        { id: 'd1', kind: 'dynamo', name: 'Stats', props: {}, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'c1', target: 'w1', intent: 'invokes' },
        { id: 'e2', source: 'w1', target: 'd1', intent: 'writesTo' },
      ],
    });
    expect(trace.ok).toBe(true);
    const labels = trace.events.map((e) => e.label);
    expect(labels).toContain('Daily fires on schedule');
    expect(labels).toContain('Daily triggers Report');
    expect(labels).toContain('Report writes to Stats');
  });
});
