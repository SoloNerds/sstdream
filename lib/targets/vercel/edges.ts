import type { EdgeIntentMeta } from '../types';

// Vercel lane edge intents → app/integration artifacts (routes, helpers, env).
export const VERCEL_EDGE_INTENTS: EdgeIntentMeta[] = [
  {
    intent: 'storesFileIn',
    label: 'stores files in',
    description: 'App uploads to Blob. Generates a Blob helper + upload route.',
    from: ['app'],
    to: ['blob'],
  },
  {
    intent: 'writesToService',
    label: 'writes to',
    description: 'App writes to an external DB / Redis. Generates a client helper + env.',
    from: ['app'],
    to: ['postgres', 'redis'],
  },
  {
    intent: 'readsFromService',
    label: 'reads from',
    description: 'App reads from an external DB / Redis. Generates a client helper + env.',
    from: ['app'],
    to: ['postgres', 'redis'],
  },
  {
    intent: 'enqueuesTo',
    label: 'enqueues to',
    description: 'App sends messages to a Vercel Queue. Generates a send() producer.',
    from: ['app'],
    to: ['queue'],
  },
  {
    intent: 'consumedBy',
    label: 'consumed by',
    description: 'A consumer processes the queue. Generates a handleCallback route + trigger.',
    from: ['queue'],
    to: ['consumer'],
  },
  {
    intent: 'sendsEmailThrough',
    label: 'sends email through',
    description: 'App sends email via Resend. Generates a Resend helper + env.',
    from: ['app'],
    to: ['email'],
  },
  {
    intent: 'readsConfig',
    label: 'reads config from',
    description: 'App reads low-latency config from Edge Config. Generates a helper + env.',
    from: ['app'],
    to: ['edgeConfig'],
  },
  {
    intent: 'callsApi',
    label: 'calls',
    description: 'App calls a third-party HTTP API. Generates a typed fetch helper + env.',
    from: ['app'],
    to: ['externalApi'],
  },
  {
    intent: 'triggersWorkflow',
    label: 'triggers',
    description:
      'App starts a durable Workflow (start() — non-blocking). Generates a trigger route.',
    from: ['app'],
    to: ['workflow'],
  },
  {
    intent: 'readsFlags',
    label: 'reads flags from',
    description: 'App reads feature flags (flags SDK). Generates flags.ts + a discovery endpoint.',
    from: ['app'],
    to: ['featureFlags'],
  },
  {
    intent: 'flagsBackedBy',
    label: 'backed by',
    description: 'Feature flags read values from Edge Config (switches to the edgeConfigAdapter).',
    from: ['featureFlags'],
    to: ['edgeConfig'],
  },
  {
    intent: 'runsCode',
    label: 'runs code in',
    description: 'App runs untrusted/AI-generated code in an ephemeral Sandbox microVM.',
    from: ['app'],
    to: ['sandbox'],
  },
];

const INTENT_BY_PAIR: Record<string, string> = {
  'app>blob': 'storesFileIn',
  'app>postgres': 'writesToService',
  'app>redis': 'writesToService',
  'app>queue': 'enqueuesTo',
  'queue>consumer': 'consumedBy',
  'app>email': 'sendsEmailThrough',
  'app>edgeConfig': 'readsConfig',
  'app>externalApi': 'callsApi',
  'app>workflow': 'triggersWorkflow',
  'app>featureFlags': 'readsFlags',
  'featureFlags>edgeConfig': 'flagsBackedBy',
  'app>sandbox': 'runsCode',
};

export function vercelDefaultIntent(fromKind: string, toKind: string): string | null {
  if (fromKind === toKind) return null;
  return INTENT_BY_PAIR[`${fromKind}>${toKind}`] ?? null;
}
