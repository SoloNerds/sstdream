import { describe, it, expect } from 'vitest';
import { parseVercelConfig } from './reverse';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { getTemplates } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';

describe('reverse: Vercel project → diagram', () => {
  it('recovers kinds from a package.json and wires the app edges', () => {
    const pkg = JSON.stringify({
      dependencies: {
        next: '^16.0.0',
        react: '^19.0.0',
        '@vercel/blob': '^1.0.0',
        '@neondatabase/serverless': '^1.0.0',
        ai: '^7.0.0',
        '@ai-sdk/react': '^4.0.0',
        botid: '^1.5.0',
      },
    });
    const { nodes, edges, unrecognized } = parseVercelConfig(pkg);
    const kinds = nodes.map((n) => n.kind).sort();
    expect(kinds).toEqual(['aiGateway', 'app', 'blob', 'botId', 'postgres']);
    // app links the storage kinds
    expect(edges.some((e) => e.intent === 'storesFileIn')).toBe(true);
    // next/react/@ai-sdk/react are app deps, not infra → not flagged
    expect(unrecognized).toEqual([]);
  });

  it('recovers Cron nodes from a vercel.json', () => {
    const vj = JSON.stringify({ crons: [{ path: '/api/cron/daily', schedule: '0 5 * * *' }] });
    const { nodes } = parseVercelConfig(vj);
    expect(nodes.map((n) => n.kind)).toEqual(['cron']);
    expect(nodes[0].name).toBe('daily');
  });

  it('flags an unmodeled @vercel/* dependency instead of dropping it', () => {
    const pkg = JSON.stringify({ dependencies: { next: '^16.0.0', '@vercel/otel': '^1.0.0' } });
    const { unrecognized } = parseVercelConfig(pkg);
    expect(unrecognized.some((u) => u.snippet === '@vercel/otel')).toBe(true);
  });

  it('non-JSON input is reported, not silently empty', () => {
    const { nodes, unrecognized } = parseVercelConfig('export default {}');
    expect(nodes).toEqual([]);
    expect(unrecognized[0].reason).toMatch(/package\.json or vercel\.json/);
  });

  it('round-trips every Vercel template: generated package.json recovers its infra kinds', () => {
    for (const t of getTemplates('vercel')) {
      const bp = draftBlueprint(t.snapshot, 'vercel', t.app, NOW);
      const files = generateFiles(bp);
      const pkg = files.find((f) => f.path === 'package.json')!.content;
      const recovered = new Set(parseVercelConfig(pkg).nodes.map((n) => n.kind));
      // Every kind in the design that maps to a dependency should be recovered.
      const DEP_BACKED = new Set([
        'blob',
        'postgres',
        'redis',
        'queue',
        'edgeConfig',
        'analytics',
        'speedInsights',
        'aiGateway',
        'workflow',
        'featureFlags',
        'rateLimit',
        'edgeMiddleware',
        'botId',
        'sandbox',
        'email',
      ]);
      for (const node of t.snapshot.nodes) {
        if (DEP_BACKED.has(node.kind)) {
          expect(recovered, `${t.id} should recover ${node.kind}`).toContain(node.kind);
        }
      }
    }
  });
});
