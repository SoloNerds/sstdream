import { describe, it, expect } from 'vitest';
import { simulateBlueprint } from '@/lib/core/simulation/simulate';
import { estimateCost } from '@/lib/core/cost/estimate';
import { expandInfra, canExpand } from '@/lib/core/expansion/expand';
import { auditInfra } from '@/lib/core/audit/audit';
import { recommendBlueprint } from '@/lib/core/recommendations/recommend';
import { draftBlueprint, type CanvasSnapshot } from '@/lib/core/blueprint/serialize';
import { VERCEL_SAAS } from '@/lib/templates/vercel-saas';

const NOW = '2026-06-08T00:00:00.000Z';
const APP = VERCEL_SAAS.app;
const mk = (snapshot: CanvasSnapshot) => draftBlueprint(snapshot, 'vercel', APP, NOW);
const saas = mk(VERCEL_SAAS.snapshot);

describe('Vercel simulation', () => {
  it('traces the SaaS template with no broken hops', () => {
    const trace = simulateBlueprint(saas);
    expect(trace.ok).toBe(true);
    expect(trace.brokenCount).toBe(0);
    const labels = trace.events.map((e) => e.label);
    expect(labels).toContain('Web receives traffic');
    expect(labels).toContain('Web enqueues to Jobs');
    expect(labels).toContain('Jobs delivers to Worker');
  });

  it('flags a queue with no consumer as broken', () => {
    const trace = simulateBlueprint(
      mk({
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'q', kind: 'queue', name: 'Jobs', props: {}, position: { x: 1, y: 0 } },
        ],
        edges: [{ id: 'e', source: 'a', target: 'q', intent: 'enqueuesTo' }],
      }),
    );
    expect(trace.ok).toBe(false);
    expect(trace.events.some((e) => e.label.includes('no consumer'))).toBe(true);
  });

  it('flags an unaccessed service as a warning', () => {
    const trace = simulateBlueprint(
      mk({
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'p', kind: 'postgres', name: 'Db', props: {}, position: { x: 1, y: 0 } },
        ],
        edges: [],
      }),
    );
    expect(
      trace.events.some((e) => e.status === 'warning' && e.label === 'Db is never accessed'),
    ).toBe(true);
  });
});

describe('Vercel cost', () => {
  it('estimates the Pro base + blob storage, every resource accounted for', () => {
    const est = estimateCost(saas);
    expect(est.totalMonthlyUsd).toBeGreaterThan(0);
    // total equals the sum of per-resource breakdowns
    const sum = est.perResource.reduce((s, r) => s + r.monthlyUsd, 0);
    expect(Math.round(sum * 100) / 100).toBe(est.totalMonthlyUsd);
    expect(est.perResource.map((r) => r.resourceId).sort()).toEqual(
      saas.resources.map((r) => r.id).sort(),
    );
    expect(est.disclaimer).toContain('signpost');
  });
});

describe('Vercel expansion + audit', () => {
  it('expands every node into physical resources', () => {
    expect(canExpand('vercel')).toBe(true);
    const groups = expandInfra(saas);
    expect(groups).toHaveLength(saas.resources.length);
    const app = groups.find((g) => g.kind === 'app')!;
    expect(app.resources.some((r) => r.service === 'Vercel')).toBe(true);
    const pg = groups.find((g) => g.kind === 'postgres')!;
    expect(pg.resources[0].service).toBe('Neon'); // external, not app-owned
  });

  it('audits public blob, server-key hygiene, cron secret, webhook signature, queue beta', () => {
    const findings = auditInfra(saas);
    const titles = findings.map((f) => f.title);
    expect(titles).toContain('Keep server keys out of the client');
    expect(titles.some((t) => t.includes('runs on a public URL'))).toBe(true); // cron
    expect(titles.some((t) => t.includes('verify signatures'))).toBe(true); // webhook
    expect(titles).toContain('Vercel Queues is beta');
  });
});

describe('Vercel recommendations', () => {
  it('recommends a consumer for a consumerless queue, and apply() is idempotent', () => {
    const bp = mk({
      nodes: [
        { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'q', kind: 'queue', name: 'Jobs', props: {}, position: { x: 1, y: 0 } },
      ],
      edges: [{ id: 'e', source: 'a', target: 'q', intent: 'enqueuesTo' }],
    });
    const rec = recommendBlueprint(bp).find((r) => r.id === 'add-consumer-q');
    expect(rec?.apply).toBeDefined();
    const once = rec!.apply!(bp);
    const twice = rec!.apply!(once);
    expect(twice).toEqual(once); // idempotent
    // the queue now has a consumer, so the rec disappears
    expect(recommendBlueprint(once).some((r) => r.id === 'add-consumer-q')).toBe(false);
    // and the simulation now passes
    expect(simulateBlueprint(once).ok).toBe(true);
  });

  it('links an unconnected blob to the app (idempotent)', () => {
    const bp = mk({
      nodes: [
        { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'b', kind: 'blob', name: 'Files', props: {}, position: { x: 1, y: 0 } },
      ],
      edges: [],
    });
    const rec = recommendBlueprint(bp).find((r) => r.id === 'link-blob-b');
    expect(rec?.apply).toBeDefined();
    const once = rec!.apply!(bp);
    expect(rec!.apply!(once)).toEqual(once);
    expect(once.connections.some((c) => c.source === 'a' && c.target === 'b')).toBe(true);
  });
});
