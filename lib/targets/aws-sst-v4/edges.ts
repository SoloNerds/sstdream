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
    intent: 'handlesRoute',
    label: 'handles route on',
    description: "A worker handles an HTTP API route (api.route('METHOD /path', handler)).",
    from: ['worker'],
    to: ['apigatewayv2'],
  },
  {
    intent: 'handlesBucketEvents',
    label: 'handles events of',
    description: 'A worker runs on S3 object events (bucket.notify — e.g. process uploads).',
    from: ['worker'],
    to: ['bucket'],
  },
  {
    intent: 'routesBucket',
    label: 'routes to bucket',
    description:
      'A Router serves a bucket at a path (router.routeBucket). Needs access: cloudfront.',
    from: ['router'],
    to: ['bucket'],
  },
  {
    intent: 'routedBy',
    label: 'routed by',
    description: 'A static site is served under a Router at a path (router option).',
    from: ['staticsite'],
    to: ['router'],
  },
  {
    intent: 'deadLettersTo',
    label: 'dead-letters to',
    description: 'Messages that fail repeatedly land in this queue (dlq: <queue>.arn).',
    from: ['queue'],
    to: ['queue'],
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
    description:
      'App/worker calls Claude; links the Anthropic API-key secret (apps also get a chat route).',
    from: ['nextjs', 'worker'],
    to: ['ai'],
  },
  {
    intent: 'queriesDb',
    label: 'queries',
    description: 'App/worker connects to RDS Postgres / Aurora (link + pg pool helper).',
    from: ['nextjs', 'worker'],
    to: ['postgres', 'aurora'],
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
    description: 'App/worker uses a Cognito user pool; apps get NEXT_PUBLIC_COGNITO_* injected.',
    from: ['nextjs', 'worker'],
    to: ['cognito'],
  },
  {
    intent: 'usesAuth',
    label: 'authenticates with',
    description: 'App uses Clerk — generates middleware.ts + Clerk env keys.',
    from: ['nextjs'],
    to: ['clerk'],
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
  'queue>queue': 'deadLettersTo',
  'worker>apigatewayv2': 'handlesRoute',
  'router>bucket': 'routesBucket',
  'staticsite>router': 'routedBy',
  'nextjs>secret': 'usesSecret',
  'worker>secret': 'usesSecret',
  'cron>secret': 'usesSecret',
  'nextjs>ai': 'usesAI',
  'worker>ai': 'usesAI',
  'nextjs>postgres': 'queriesDb',
  'worker>postgres': 'queriesDb',
  'nextjs>aurora': 'queriesDb',
  'worker>aurora': 'queriesDb',
  'nextjs>email': 'sendsEmail',
  'worker>email': 'sendsEmail',
  'nextjs>stripe': 'usesStripe',
  'nextjs>mongodb': 'queriesMongo',
  'worker>mongodb': 'queriesMongo',
  'nextjs>externalApi': 'callsApi',
  'worker>externalApi': 'callsApi',
  'nextjs>cognito': 'usesCognito',
  'worker>cognito': 'usesCognito',
  'nextjs>clerk': 'usesAuth',
};

// Unmapped pairs return null so the canvas refuses the connection outright —
// the old catch-all 'linksTo' silently generated nothing (or a broken link).
// The pair map is consulted before the same-kind guard (queue→queue is a DLQ).
export function awsDefaultIntent(fromKind: string, toKind: string): string | null {
  return INTENT_BY_PAIR[`${fromKind}>${toKind}`] ?? null;
}
