import { describe, it, expect } from 'vitest';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { awsRecommendations } from '@/lib/targets/aws-sst-v4/recommendations';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import type { Blueprint } from '@/lib/core/blueprint/types';

// Audit (board meeting #3 follow-up): the validation + recommendations engines, like
// the simulation, were written for the original catalog. These lock in their coverage
// of the modern kinds so a future kind can't reintroduce a gap.

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'eng', region: 'us-east-1', packageManager: 'yarn' as const };
const N = (id: string, kind: string, name: string) => ({
  id,
  kind,
  name,
  props: {},
  position: { x: 0, y: 0 },
});
const E = (id: string, source: string, target: string, intent: string) => ({
  id,
  source,
  target,
  intent,
});
const mk = (nodes: ReturnType<typeof N>[], edges: ReturnType<typeof E>[]): Blueprint =>
  draftBlueprint({ nodes, edges }, 'aws-sst-v4', APP, NOW);

describe('validation: var-name-collision covers the modern kinds', () => {
  // Each of these would generate a DUPLICATE `const` (non-compiling) — the export gate
  // must error, not pass.
  const collisions: Record<
    string,
    { nodes: ReturnType<typeof N>[]; edges: ReturnType<typeof E>[] }
  > = {
    'two services share a var': {
      nodes: [N('s1', 'service', 'ApiService'), N('s2', 'service', 'apiService')],
      edges: [],
    },
    'a service named "Cluster" hits the auto cluster var': {
      nodes: [N('a', 'nextjs', 'Web'), N('s', 'service', 'Cluster')],
      edges: [],
    },
    'a bucket "Cluster" with a service present': {
      nodes: [N('s', 'service', 'Api'), N('b', 'bucket', 'Cluster')],
      edges: [],
    },
    'a Step Functions step var collides': {
      nodes: [
        N('a', 'nextjs', 'Web'),
        N('sf', 'stepFunctions', 'Order'),
        N('b', 'bucket', 'OrderValidate'),
      ],
      edges: [E('e', 'a', 'sf', 'startsWorkflow')],
    },
    'an AppSync data-source var collides': {
      nodes: [N('a', 'nextjs', 'Web'), N('g', 'appsync', 'Graph'), N('b', 'bucket', 'GraphDs')],
      edges: [E('e', 'a', 'g', 'consumesGraphQL')],
    },
    'a redis + dynamo share a var': {
      nodes: [N('r', 'redis', 'CacheStore'), N('d', 'dynamo', 'cacheStore')],
      edges: [],
    },
  };
  for (const [label, snap] of Object.entries(collisions)) {
    it(`flags: ${label}`, () => {
      const errs = validateBlueprint(mk(snap.nodes, snap.edges)).errors;
      expect(errs.some((e) => e.rule === 'var-name-collision')).toBe(true);
    });
  }

  it('does NOT false-flag a normal multi-kind design', () => {
    const bp = mk(
      [
        N('a', 'nextjs', 'Web'),
        N('s', 'service', 'Api'),
        N('r', 'redis', 'Cache'),
        N('g', 'appsync', 'Graph'),
        N('sf', 'stepFunctions', 'Order'),
      ],
      [
        E('e1', 'a', 'r', 'usesCache'),
        E('e2', 'a', 'g', 'consumesGraphQL'),
        E('e3', 'a', 'sf', 'startsWorkflow'),
      ],
    );
    expect(validateBlueprint(bp).errors.filter((e) => e.rule === 'var-name-collision')).toEqual([]);
  });
});

describe('recommendations stay correct with the modern kinds present', () => {
  const designs: Record<string, Blueprint> = {
    'redis+service+queue': mk(
      [
        N('a', 'nextjs', 'Web'),
        N('r', 'redis', 'Cache'),
        N('s', 'service', 'Api'),
        N('q', 'queue', 'Jobs'),
      ],
      [E('e', 'a', 'q', 'publishesTo')],
    ),
    'appsync+task+stepfn+queue': mk(
      [
        N('a', 'nextjs', 'Web'),
        N('g', 'appsync', 'Graph'),
        N('t', 'task', 'Job'),
        N('sf', 'stepFunctions', 'Wf'),
        N('q', 'queue', 'Q'),
      ],
      [E('e', 'a', 'q', 'publishesTo')],
    ),
  };
  for (const [label, bp] of Object.entries(designs)) {
    it(`every apply() stays valid + idempotent: ${label}`, () => {
      for (const rec of awsRecommendations(bp)) {
        if (!rec.apply) continue;
        const applied = rec.apply(bp);
        expect(validateBlueprint(applied).errors, `${rec.id} produced an invalid design`).toEqual(
          [],
        );
        expect(() => generateFiles(applied), `${rec.id} broke the generator`).not.toThrow();
        expect(rec.apply(applied), `${rec.id} is not idempotent`).toEqual(applied);
      }
    });
  }

  it('offers to wire an unconnected Redis (consistency with bucket/table)', () => {
    const bp = mk([N('a', 'nextjs', 'Web'), N('r', 'redis', 'Cache')], []);
    const rec = awsRecommendations(bp).find((r) => r.id === 'link-cache-r');
    expect(rec).toBeTruthy();
    const applied = rec!.apply!(bp);
    expect(applied.connections.some((c) => c.target === 'r' && c.intent === 'usesCache')).toBe(
      true,
    );
    expect(validateBlueprint(applied).errors).toEqual([]);
  });
});
