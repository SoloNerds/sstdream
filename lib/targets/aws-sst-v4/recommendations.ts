import type { Blueprint } from '@/lib/core/blueprint/types';
import type { Recommendation } from '@/lib/core/recommendations/types';

// AWS / SST v4 recommendation packs: wiring fixes (one-click), reliability
// best-practices (advisory), and production safety. Every `apply` is a pure,
// idempotent blueprint transform.

function mintId(bp: Blueprint, prefix: string): string {
  let max = 0;
  for (const id of [...bp.resources.map((r) => r.id), ...bp.connections.map((c) => c.id)]) {
    const m = /(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}_${max + 1}`;
}

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}${i}`)) i += 1;
  return `${base}${i}`;
}

function linkAppTo(target: string, intent: string) {
  return (bp: Blueprint): Blueprint => {
    const app = bp.resources.find((r) => r.kind === 'nextjs');
    if (!app) return bp;
    if (bp.connections.some((c) => c.source === app.id && c.target === target)) return bp;
    return {
      ...bp,
      connections: [...bp.connections, { id: mintId(bp, 'edge'), source: app.id, target, intent }],
    };
  };
}

export function awsRecommendations(bp: Blueprint): Recommendation[] {
  const recs: Recommendation[] = [];
  const app = bp.resources.find((r) => r.kind === 'nextjs');
  const connected = new Set<string>();
  for (const c of bp.connections) {
    connected.add(c.source);
    connected.add(c.target);
  }

  // — Wiring: link an unused bucket / table / secret to the app —
  if (app) {
    for (const b of bp.resources.filter((r) => r.kind === 'bucket' && !connected.has(r.id))) {
      recs.push({
        id: `link-bucket-${b.id}`,
        kind: 'wiring',
        resourceId: b.id,
        title: `Link ${b.name} to your app`,
        detail: `${b.name} isn't connected to anything. Link it so your app can upload to it.`,
        apply: linkAppTo(b.id, 'uploadsTo'),
      });
    }
    for (const d of bp.resources.filter((r) => r.kind === 'dynamo' && !connected.has(r.id))) {
      recs.push({
        id: `link-table-${d.id}`,
        kind: 'wiring',
        resourceId: d.id,
        title: `Link ${d.name} to your app`,
        detail: `${d.name} isn't connected. Link it so your app can read and write items.`,
        apply: linkAppTo(d.id, 'writesTo'),
      });
    }
    for (const s of bp.resources.filter(
      (r) =>
        r.kind === 'secret' &&
        !bp.connections.some((c) => c.target === r.id && c.intent === 'usesSecret'),
    )) {
      recs.push({
        id: `link-secret-${s.id}`,
        kind: 'wiring',
        resourceId: s.id,
        title: `Link ${s.name} to your app`,
        detail: `${s.name} isn't used. Link it so your app can read Resource.${s.name}.value.`,
        apply: linkAppTo(s.id, 'usesSecret'),
      });
    }
  }

  // — Wiring / reliability: queues —
  for (const q of bp.resources.filter((r) => r.kind === 'queue')) {
    const hasSub = bp.connections.some((c) => c.target === q.id && c.intent === 'subscribesTo');
    if (!hasSub) {
      recs.push({
        id: `add-worker-${q.id}`,
        kind: 'wiring',
        resourceId: q.id,
        title: `Add a worker for ${q.name}`,
        detail: `${q.name} has no consumer. Add a Worker that subscribes to it.`,
        apply: (input) => {
          const queue = input.resources.find((r) => r.id === q.id);
          if (!queue) return input;
          if (input.connections.some((c) => c.target === q.id && c.intent === 'subscribesTo')) {
            return input;
          }
          const taken = new Set(input.resources.map((r) => r.name));
          const wname = uniqueName(`${queue.name}Worker`, taken);
          const wid = mintId(input, 'worker');
          const withNode: Blueprint = {
            ...input,
            resources: [
              ...input.resources,
              {
                id: wid,
                kind: 'worker',
                name: wname,
                props: {},
                position: { x: queue.position.x + 220, y: queue.position.y },
              },
            ],
          };
          return {
            ...withNode,
            connections: [
              ...withNode.connections,
              { id: mintId(withNode, 'edge'), source: wid, target: q.id, intent: 'subscribesTo' },
            ],
          };
        },
      });
    } else {
      recs.push({
        id: `dlq-${q.id}`,
        kind: 'reliability',
        resourceId: q.id,
        title: `Add a dead-letter queue for ${q.name}`,
        detail: `Capture messages that fail repeatedly so they aren't lost — configure dlq on the queue.`,
      });
    }
  }

  // — Production safety (fires only if a stage opts out) —
  const prod = bp.app.stages.find((st) => st.name === 'production');
  if (prod && prod.removal && prod.removal !== 'retain') {
    recs.push({
      id: 'prod-retain',
      kind: 'best-practice',
      title: 'Use "retain" removal for production',
      detail: 'Protect production data (S3/DynamoDB) from accidental deletion.',
      apply: (input) => ({
        ...input,
        app: {
          ...input.app,
          stages: input.app.stages.map((st) =>
            st.name === 'production' ? { ...st, removal: 'retain' } : st,
          ),
        },
      }),
    });
  }

  return recs;
}
