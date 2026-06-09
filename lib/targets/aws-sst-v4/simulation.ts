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
  linksTo: 'links to',
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
  'linksTo',
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
      }
    }
  };

  const entries = bp.resources.filter(
    (r) => r.kind === 'nextjs' || r.kind === 'cron' || r.kind === 'apigatewayv2',
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

  for (const w of bp.resources.filter((r) => r.kind === 'worker')) {
    if (!visited.has(w.id)) {
      events.push({
        id: eid(),
        sourceId: w.id,
        status: 'broken',
        label: `${w.name} is never triggered`,
        detail: 'No queue subscription or cron reaches this worker.',
      });
    }
  }

  for (const r of bp.resources.filter((res) => res.kind === 'bucket' || res.kind === 'dynamo')) {
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
