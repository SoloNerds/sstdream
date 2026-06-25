import type { Blueprint } from '@/lib/core/blueprint/types';
import type { SimEvent, SimTrace } from '@/lib/core/simulation/types';

// AWS / SST v4 data-flow simulation (no deploy). Walks from entry points
// (Next.js traffic, Cron schedules) along edges, verifying each hop is wired and
// flagging dead-ends (a queue with no consumer, an untriggered worker).

const VERB: Record<string, string> = {
  uploadsTo: 'uploads to',
  writesTo: 'writes to',
  readsFrom: 'reads from',
  usesSecret: 'uses secret',
  usesAI: 'uses AI',
  queriesDb: 'queries',
  sendsEmail: 'sends email through',
  usesStripe: 'uses Stripe',
  queriesMongo: 'queries Mongo',
  callsApi: 'calls',
  usesCognito: 'authenticates with',
  usesAuth: 'authenticates with',
  routesBucket: 'routes to',
  deadLettersTo: 'dead-letters to',
  routedBy: 'served by',
};

const LEAF_INTENTS = new Set([
  'uploadsTo',
  'writesTo',
  'readsFrom',
  'usesSecret',
  'usesAI',
  'queriesDb',
  'sendsEmail',
  'usesStripe',
  'queriesMongo',
  'callsApi',
  'usesCognito',
  'usesAuth',
  'routesBucket',
  'routedBy',
  'deadLettersTo',
]);

export function simulateAws(bp: Blueprint): SimTrace {
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const outgoing = (id: string) => bp.connections.filter((c) => c.source === id);
  const subscribersOf = (qid: string) =>
    bp.connections.filter((c) => c.target === qid && c.intent === 'subscribesTo');

  const events: SimEvent[] = [];
  const visited = new Set<string>();
  let counter = 0;
  const eid = () => `ev_${++counter}`;

  const walk = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);

    for (const edge of outgoing(id)) {
      if (edge.intent === 'invokes') {
        events.push({
          id: eid(),
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          status: 'ok',
          label: `${name(edge.source)} triggers ${name(edge.target)}`,
        });
        walk(edge.target);
      } else if (edge.intent === 'publishesTo') {
        visited.add(edge.target);
        events.push({
          id: eid(),
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          status: 'ok',
          label: `${name(edge.source)} publishes to ${name(edge.target)}`,
        });
        const subs = subscribersOf(edge.target);
        if (!subs.length) {
          events.push({
            id: eid(),
            sourceId: edge.target,
            status: 'broken',
            label: `${name(edge.target)} has no consumer`,
            detail: 'Messages published here would be dropped — add a Worker (subscribesTo).',
          });
        } else {
          for (const sub of subs) {
            events.push({
              id: eid(),
              edgeId: sub.id,
              sourceId: edge.target,
              targetId: sub.source,
              status: 'ok',
              label: `${name(edge.target)} delivers to ${name(sub.source)}`,
            });
            walk(sub.source);
          }
        }
      } else if (LEAF_INTENTS.has(edge.intent)) {
        visited.add(edge.target);
        events.push({
          id: eid(),
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          status: 'ok',
          label: `${name(edge.source)} ${VERB[edge.intent]} ${name(edge.target)}`,
        });
        // Writing/uploading to a bucket can trigger its S3-event notifier workers.
        if (byId.get(edge.target)?.kind === 'bucket') {
          for (const nf of bp.connections.filter(
            (c) => c.target === edge.target && c.intent === 'handlesBucketEvents',
          )) {
            events.push({
              id: eid(),
              edgeId: nf.id,
              sourceId: edge.target,
              targetId: nf.source,
              status: 'ok',
              label: `${name(edge.target)} notifies ${name(nf.source)}`,
            });
            walk(nf.source);
          }
        }
      }
    }
  };

  const entries = bp.resources.filter(
    (r) =>
      r.kind === 'nextjs' ||
      r.kind === 'cron' ||
      r.kind === 'apigatewayv2' ||
      r.kind === 'router' ||
      r.kind === 'staticsite',
  );
  for (const entry of entries) {
    events.push({
      id: eid(),
      sourceId: entry.id,
      status: 'ok',
      label:
        entry.kind === 'cron'
          ? `${entry.name} fires on schedule`
          : entry.kind === 'apigatewayv2'
            ? `${entry.name} receives requests`
            : `${entry.name} receives traffic`,
    });
    walk(entry.id);
    if (entry.kind === 'apigatewayv2') {
      // Route handlers point INTO the API (worker handlesRoute api) — walk them.
      for (const rh of bp.connections.filter(
        (c) => c.target === entry.id && c.intent === 'handlesRoute',
      )) {
        events.push({
          id: eid(),
          edgeId: rh.id,
          sourceId: entry.id,
          targetId: rh.source,
          status: 'ok',
          label: `${name(entry.id)} routes to ${name(rh.source)}`,
        });
        walk(rh.source);
      }
    }
  }

  // Follow dead-letter edges from any reached queue so the DLQ target shows in
  // the trace and isn't mistaken for unreached. A DLQ legitimately has no
  // consumer, so it's surfaced as a hop, not walked for subscribers.
  for (const dlq of bp.connections.filter((c) => c.intent === 'deadLettersTo')) {
    if (visited.has(dlq.source) && !visited.has(dlq.target)) {
      visited.add(dlq.target);
      events.push({
        id: eid(),
        edgeId: dlq.id,
        sourceId: dlq.source,
        targetId: dlq.target,
        status: 'ok',
        label: `${name(dlq.source)} dead-letters to ${name(dlq.target)}`,
      });
    }
  }

  // A worker that subscribes to a reached Dynamo table's stream is triggered by
  // it — walk it so it isn't mistaken for an untriggered worker.
  for (const sub of bp.connections.filter((c) => c.intent === 'subscribesTo')) {
    const target = byId.get(sub.target);
    if (target?.kind === 'dynamo' && visited.has(sub.target) && !visited.has(sub.source)) {
      events.push({
        id: eid(),
        edgeId: sub.id,
        sourceId: sub.target,
        targetId: sub.source,
        status: 'ok',
        label: `${name(sub.target)} streams to ${name(sub.source)}`,
      });
      walk(sub.source);
    }
  }

  for (const w of bp.resources.filter((r) => r.kind === 'worker')) {
    const isNotifier = bp.connections.some(
      (c) => c.source === w.id && c.intent === 'handlesBucketEvents',
    );
    if (!visited.has(w.id) && !isNotifier) {
      events.push({
        id: eid(),
        sourceId: w.id,
        status: 'broken',
        label: `${w.name} is never triggered`,
        detail: 'No queue subscription or cron reaches this worker.',
      });
    }
  }

  // Storage/database nodes reached by nothing are dead weight. Buckets and all
  // database kinds are accessed the same way (an app/worker edge into them), so
  // an unvisited one is a real "does everything talk?" gap.
  const STORAGE_KINDS = new Set(['bucket', 'dynamo', 'postgres', 'aurora', 'mongodb']);
  for (const r of bp.resources.filter((res) => STORAGE_KINDS.has(res.kind))) {
    if (!visited.has(r.id)) {
      events.push({
        id: eid(),
        sourceId: r.id,
        status: 'warning',
        label: `${r.name} is never accessed`,
      });
    }
  }

  const brokenCount = events.filter((e) => e.status === 'broken').length;
  return { events, ok: brokenCount === 0, brokenCount };
}
