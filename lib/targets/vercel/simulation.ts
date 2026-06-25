import type { Blueprint } from '@/lib/core/blueprint/types';
import type { SimEvent, SimTrace } from '@/lib/core/simulation/types';

// Vercel data-flow simulation (no deploy). Walks from entry points (app traffic,
// cron schedules, inbound webhooks) along edges, flagging dead-ends: a queue with
// no consumer, a consumer attached to no queue, an unaccessed service.

const VERB: Record<string, string> = {
  storesFileIn: 'stores files in',
  writesToService: 'writes to',
  readsFromService: 'reads from',
  enqueuesTo: 'enqueues to',
  sendsEmailThrough: 'sends email through',
};

const ENTRY_KINDS = new Set(['app', 'cron', 'webhook']);
const STORAGE_KINDS = new Set(['blob', 'postgres', 'redis']);

export function simulateVercel(bp: Blueprint): SimTrace {
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const outgoing = (id: string) => bp.connections.filter((c) => c.source === id);

  const events: SimEvent[] = [];
  const visited = new Set<string>();
  let counter = 0;
  const eid = () => `ev_${++counter}`;

  const walk = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const edge of outgoing(id)) {
      events.push({
        id: eid(),
        edgeId: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        status: 'ok',
        label: `${name(edge.source)} ${VERB[edge.intent] ?? edge.intent} ${name(edge.target)}`,
      });
      if (edge.intent === 'enqueuesTo') {
        // A queue's "worker" is its push-mode consumer. Verify one exists.
        visited.add(edge.target);
        const consumers = bp.connections.filter(
          (c) => c.source === edge.target && c.intent === 'consumedBy',
        );
        if (!consumers.length) {
          events.push({
            id: eid(),
            sourceId: edge.target,
            status: 'broken',
            label: `${name(edge.target)} has no consumer`,
            detail: 'Messages enqueued here are never processed — add a Consumer (consumedBy).',
          });
        } else {
          for (const sub of consumers) {
            events.push({
              id: eid(),
              edgeId: sub.id,
              sourceId: edge.target,
              targetId: sub.target,
              status: 'ok',
              label: `${name(edge.target)} delivers to ${name(sub.target)}`,
            });
            walk(sub.target);
          }
        }
      } else {
        // Services (blob/db/redis/email) are leaves — reached, nothing downstream.
        visited.add(edge.target);
      }
    }
  };

  for (const entry of bp.resources.filter((r) => ENTRY_KINDS.has(r.kind))) {
    const label =
      entry.kind === 'cron'
        ? `${entry.name} fires on schedule`
        : entry.kind === 'webhook'
          ? `${entry.name} receives a webhook`
          : `${entry.name} receives traffic`;
    events.push({ id: eid(), sourceId: entry.id, status: 'ok', label });
    walk(entry.id);
  }

  // A consumer reached by no queue is broken (nothing triggers it).
  for (const c of bp.resources.filter((r) => r.kind === 'consumer')) {
    if (!visited.has(c.id)) {
      events.push({
        id: eid(),
        sourceId: c.id,
        status: 'broken',
        label: `${c.name} is not attached to a queue`,
        detail: 'A consumer needs a Queue → Consumer (consumedBy) edge to be invoked.',
      });
    }
  }

  // Storage/services wired to nothing are dead weight.
  for (const r of bp.resources.filter((r) => STORAGE_KINDS.has(r.kind))) {
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
