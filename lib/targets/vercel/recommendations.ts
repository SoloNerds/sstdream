import type { Blueprint } from '@/lib/core/blueprint/types';
import type { Recommendation } from '@/lib/core/recommendations/types';

// Vercel recommendation pack: wiring fixes (one-click) + best-practice advisories.
// Every `apply` is a pure, idempotent blueprint transform (apply twice == apply once).

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

export function vercelRecommendations(bp: Blueprint): Recommendation[] {
  const recs: Recommendation[] = [];
  const app = bp.resources.find((r) => r.kind === 'app');
  const connected = new Set<string>();
  for (const c of bp.connections) {
    connected.add(c.source);
    connected.add(c.target);
  }

  // — Wiring: link an unused service to the app —
  if (app) {
    const wire =
      (target: string, intent: string) =>
      (cur: Blueprint): Blueprint => {
        if (cur.connections.some((c) => c.source === app.id && c.target === target)) return cur;
        return {
          ...cur,
          connections: [
            ...cur.connections,
            { id: mintId(cur, 'edge'), source: app.id, target, intent },
          ],
        };
      };
    for (const b of bp.resources.filter((r) => r.kind === 'blob' && !connected.has(r.id))) {
      recs.push({
        id: `link-blob-${b.id}`,
        kind: 'wiring',
        resourceId: b.id,
        title: `Link ${b.name} to your app`,
        detail: `${b.name} isn't connected to anything. Link it so your app can store files.`,
        apply: wire(b.id, 'storesFileIn'),
      });
    }
    for (const d of bp.resources.filter(
      (r) => (r.kind === 'postgres' || r.kind === 'redis') && !connected.has(r.id),
    )) {
      recs.push({
        id: `link-service-${d.id}`,
        kind: 'wiring',
        resourceId: d.id,
        title: `Link ${d.name} to your app`,
        detail: `${d.name} isn't connected. Link it so your app can read and write.`,
        apply: wire(d.id, 'writesToService'),
      });
    }
  }

  // — Reliability: a queue with no consumer drops every message; add one —
  for (const q of bp.resources.filter(
    (r) =>
      r.kind === 'queue' &&
      !bp.connections.some((c) => c.source === r.id && c.intent === 'consumedBy'),
  )) {
    recs.push({
      id: `add-consumer-${q.id}`,
      kind: 'reliability',
      resourceId: q.id,
      title: `Add a consumer for ${q.name}`,
      detail: `${q.name} has no consumer — enqueued messages are never processed. Add a push-mode consumer.`,
      apply: (cur) => {
        if (cur.connections.some((c) => c.source === q.id && c.intent === 'consumedBy')) return cur;
        const taken = new Set(cur.resources.map((r) => r.name));
        const id = mintId(cur, 'consumer');
        const node = {
          id,
          kind: 'consumer',
          name: uniqueName(`${q.name}Worker`, taken),
          props: {},
          position: { x: q.position.x + 220, y: q.position.y },
        };
        const withNode: Blueprint = { ...cur, resources: [...cur.resources, node] };
        return {
          ...withNode,
          connections: [
            ...withNode.connections,
            { id: mintId(withNode, 'edge'), source: q.id, target: id, intent: 'consumedBy' },
          ],
        };
      },
    });
  }

  // — Best-practice: a public blob holding user data —
  for (const b of bp.resources.filter((r) => r.kind === 'blob' && r.props.access === 'public')) {
    recs.push({
      id: `blob-private-${b.id}`,
      kind: 'best-practice',
      resourceId: b.id,
      title: `Consider making ${b.name} private`,
      detail: `${b.name} uses public access (world-readable URLs). If it stores user-owned files, switch access to private.`,
    });
  }

  return recs;
}
