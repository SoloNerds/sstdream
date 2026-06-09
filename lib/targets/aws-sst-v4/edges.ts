import type { EdgeIntentMeta } from '../types';

// AWS / SST v4 edge intents. Each connection's intent drives what the generator
// emits (link arrays, subscriber wiring, SDK helpers). See docs/sst-v4-target.md.
export const AWS_EDGE_INTENTS: EdgeIntentMeta[] = [
  {
    intent: 'uploadsTo',
    label: 'uploads to',
    description: 'App writes objects to a bucket (signed-URL upload). Adds link + S3 helper.',
    from: ['nextjs', 'worker'],
    to: ['bucket'],
  },
  {
    intent: 'readsFrom',
    label: 'reads from',
    description: 'Reads from a bucket / table. Adds link + read helper.',
    from: ['nextjs', 'worker'],
    to: ['bucket', 'dynamo'],
  },
  {
    intent: 'writesTo',
    label: 'writes to',
    description: 'Writes items to a Dynamo table. Adds link + Dynamo helper.',
    from: ['nextjs', 'worker'],
    to: ['dynamo'],
  },
  {
    intent: 'publishesTo',
    label: 'publishes to',
    description: 'Sends messages/events to a queue, bus, or topic. Adds link + send helper.',
    from: ['nextjs', 'worker'],
    to: ['queue', 'bus', 'snstopic'],
  },
  {
    intent: 'subscribesTo',
    label: 'subscribes to',
    description: 'A worker consumes a queue/bus/topic (generates the subscribe() call).',
    from: ['worker'],
    to: ['queue', 'bus', 'snstopic'],
  },
  {
    intent: 'invokes',
    label: 'invokes',
    description: 'Cron triggers a worker/function on a schedule.',
    from: ['cron'],
    to: ['worker'],
  },
  {
    intent: 'usesSecret',
    label: 'uses secret',
    description: 'A component links a secret (Resource.<Secret>.value).',
    from: ['nextjs', 'worker', 'cron'],
    to: ['secret'],
  },
  {
    intent: 'usesAI',
    label: 'uses AI',
    description: 'App streams Claude via a server route; links the Anthropic API-key secret.',
    from: ['nextjs'],
    to: ['ai'],
  },
  {
    intent: 'queriesDb',
    label: 'queries',
    description: 'App/worker connects to RDS Postgres (link + pg pool helper).',
    from: ['nextjs', 'worker'],
    to: ['postgres'],
  },
  {
    intent: 'sendsEmail',
    label: 'sends email through',
    description: 'App/worker sends email via SES (link + SESv2 helper).',
    from: ['nextjs', 'worker'],
    to: ['email'],
  },
  {
    intent: 'usesStripe',
    label: 'uses Stripe',
    description: 'App integrates Stripe — webhook route + lib/stripe.ts + env keys.',
    from: ['nextjs'],
    to: ['stripe'],
  },
  {
    intent: 'queriesMongo',
    label: 'queries Mongo',
    description: 'App/worker connects to MongoDB via DATABASE_URL (lib/mongo.ts).',
    from: ['nextjs', 'worker'],
    to: ['mongodb'],
  },
  {
    intent: 'callsApi',
    label: 'calls',
    description: 'App/worker calls an external API (lib helper + base-url/key env).',
    from: ['nextjs', 'worker'],
    to: ['externalApi'],
  },
  {
    intent: 'usesCognito',
    label: 'authenticates with',
    description: 'App uses a Cognito user pool; injects NEXT_PUBLIC_COGNITO_* from outputs.',
    from: ['nextjs'],
    to: ['cognito'],
  },
  {
    intent: 'usesAuth',
    label: 'authenticates with',
    description: 'App uses Clerk — generates middleware.ts + Clerk env keys.',
    from: ['nextjs'],
    to: ['clerk'],
  },
  {
    intent: 'linksTo',
    label: 'links to',
    description: 'Generic link: grants access + SDK exposure with no specific helper.',
    from: [],
    to: [],
  },
];

const INTENT_BY_PAIR: Record<string, string> = {
  'nextjs>bucket': 'uploadsTo',
  'worker>bucket': 'readsFrom',
  'nextjs>dynamo': 'writesTo',
  'worker>dynamo': 'writesTo',
  'nextjs>queue': 'publishesTo',
  'worker>queue': 'subscribesTo',
  'nextjs>bus': 'publishesTo',
  'worker>bus': 'subscribesTo',
  'nextjs>snstopic': 'publishesTo',
  'worker>snstopic': 'subscribesTo',
  'cron>worker': 'invokes',
  'nextjs>secret': 'usesSecret',
  'worker>secret': 'usesSecret',
  'cron>secret': 'usesSecret',
  'nextjs>ai': 'usesAI',
  'nextjs>postgres': 'queriesDb',
  'worker>postgres': 'queriesDb',
  'nextjs>email': 'sendsEmail',
  'worker>email': 'sendsEmail',
  'nextjs>stripe': 'usesStripe',
  'nextjs>mongodb': 'queriesMongo',
  'worker>mongodb': 'queriesMongo',
  'nextjs>externalApi': 'callsApi',
  'worker>externalApi': 'callsApi',
  'nextjs>cognito': 'usesCognito',
  'nextjs>clerk': 'usesAuth',
};

export function awsDefaultIntent(fromKind: string, toKind: string): string | null {
  if (fromKind === toKind) return null;
  return INTENT_BY_PAIR[`${fromKind}>${toKind}`] ?? 'linksTo';
}
