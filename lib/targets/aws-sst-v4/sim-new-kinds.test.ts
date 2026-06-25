import { describe, it, expect } from 'vitest';
import { simulateBlueprint } from '@/lib/core/simulation/simulate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';

// Regression: the simulation must understand the modern kinds + their edges. It was
// written for the original catalog, so a Dynamo behind a Service / AppSync, or a
// bucket a Task reads, used to be falsely flagged "never accessed" (and a DLQ drainer
// "never triggered"). These designs are valid and must simulate with zero complaints.

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'sim', region: 'us-east-1', packageManager: 'yarn' as const };
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

const CASES: Record<string, { nodes: ReturnType<typeof N>[]; edges: ReturnType<typeof E>[] }> = {
  'app caches in Redis': {
    nodes: [N('a', 'nextjs', 'Web'), N('r', 'redis', 'Cache')],
    edges: [E('e', 'a', 'r', 'usesCache')],
  },
  'a Service writes to Dynamo (the Service is an entry)': {
    nodes: [N('s', 'service', 'Api'), N('d', 'dynamo', 'Data')],
    edges: [E('e', 's', 'd', 'writesTo')],
  },
  'app runs a Task that reads a bucket': {
    nodes: [N('a', 'nextjs', 'Web'), N('t', 'task', 'Job'), N('b', 'bucket', 'Out')],
    edges: [E('e1', 'a', 't', 'runsTask'), E('e2', 't', 'b', 'readsFrom')],
  },
  'app streams via Realtime': {
    nodes: [N('a', 'nextjs', 'Web'), N('rt', 'realtime', 'RT')],
    edges: [E('e', 'a', 'rt', 'usesRealtime')],
  },
  'app starts a Step Functions workflow': {
    nodes: [N('a', 'nextjs', 'Web'), N('sf', 'stepFunctions', 'Wf')],
    edges: [E('e', 'a', 'sf', 'startsWorkflow')],
  },
  'a Dynamo table behind an AppSync resolver': {
    nodes: [N('a', 'nextjs', 'Web'), N('g', 'appsync', 'Graph'), N('d', 'dynamo', 'Users')],
    edges: [E('e1', 'a', 'g', 'consumesGraphQL'), E('e2', 'g', 'd', 'resolvesFrom')],
  },
  'app authenticates with OpenAuth': {
    nodes: [N('a', 'nextjs', 'Web'), N('o', 'openauth', 'Auth')],
    edges: [E('e', 'a', 'o', 'usesOpenAuth')],
  },
};

describe('simulation understands the modern kinds (no false flags)', () => {
  for (const [label, snapshot] of Object.entries(CASES)) {
    it(label, () => {
      const bp = draftBlueprint(snapshot, 'aws-sst-v4', APP, NOW);
      const trace = simulateBlueprint(bp);
      const bad = trace.events.filter((e) => e.status === 'broken' || e.status === 'warning');
      expect(
        bad.map((e) => e.label),
        `unexpected ${bad.map((e) => e.status).join('/')} flag(s)`,
      ).toEqual([]);
      // The design's resources are all reached (every node shows up as a trace source/target).
      const touched = new Set(trace.events.flatMap((e) => [e.sourceId, e.targetId]));
      for (const node of snapshot.nodes) {
        expect(touched.has(node.id), `${node.name} should appear in the trace`).toBe(true);
      }
    });
  }
});
