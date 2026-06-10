import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { InfraGroup, PhysicalResource } from '@/lib/core/expansion/types';
import { effectiveAwsNat } from './generator/plan';

// Verified resource-expansion map (resource-expansion sweep, 2026-06-09 vs live SST
// docs). Maps each logical node to the underlying AWS resources `sst deploy` creates.
// "always" = no extra config; `conditional` = the trigger. Corrected facts baked in:
// VPC has NO NAT by default; Bucket never makes CloudFront; Cognito has no Identity Pool.

const P = (
  service: string,
  name: string,
  opts: Partial<Omit<PhysicalResource, 'service' | 'name'>> = {},
): PhysicalResource => ({ service, name, ...opts });

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

function nextjsResources(r: Resource): PhysicalResource[] {
  const out = [
    P('CloudFront', 'Distribution', { note: 'the public URL / global CDN', paid: true }),
    P('CloudFront', 'viewer-request Function', { note: 'routes asset vs server origin' }),
    P('CloudFront', 'Origin Access (OAI)', { security: true, note: 'reads the private S3 bucket' }),
    P('CloudFront', 'Cache policy'),
    P('S3', 'Assets + ISR cache bucket', {
      paid: true,
      security: true,
      note: 'private; static + ISR cache',
    }),
    P('Lambda', 'Server (SSR) function', { paid: true, note: '1024 MB, nodejs' }),
    P('Lambda', 'Server Function URL', {
      security: true,
      note: 'PUBLIC by default (protection: "none")',
    }),
    P('Lambda', 'Image-optimization function', { paid: true, note: 'next/image, 1536 MB' }),
    P('Lambda', 'Image-opt Function URL', { security: true }),
    P('Lambda', 'Revalidation (ISR) function', { paid: true }),
    P('SQS', 'Revalidation queue (FIFO)', { note: 'triggers the ISR revalidator' }),
    P('Lambda', 'SQS → revalidation mapping'),
    P('DynamoDB', 'ISR tag-cache table', { paid: true, note: 'on-demand' }),
    P('Lambda', 'Revalidation seeder', { note: 'deploy-time custom resource' }),
    P('IAM', 'Execution role per Lambda', { security: true }),
    P('CloudWatch', 'Log group per Lambda', { paid: true, note: 'persists after teardown' }),
  ];
  if (str(r.props.domain)) {
    out.push(P('ACM', 'TLS certificate', { conditional: 'custom domain', security: true }));
    out.push(P('Route53', 'DNS records', { conditional: 'custom domain' }));
  }
  return out;
}

function bucketResources(r: Resource): PhysicalResource[] {
  const access = str(r.props.access);
  return [
    P('S3', 'Bucket', { paid: true }),
    P('S3', 'Bucket policy', {
      security: true,
      note: access ? `grants ${access} read access` : 'private',
    }),
    P('S3', 'Public access block', { security: true }),
    P('S3', 'Ownership controls'),
    P('S3', 'CORS configuration'),
    P('Lambda', 'Event notification', { conditional: 'a worker handles its events' }),
    // NOTE: a Bucket NEVER creates a CloudFront distribution (verified).
  ];
}

// Only SQS uses a poll-based event-source mapping; SNS pushes via a topic
// subscription + invoke permission, EventBridge via a rule target + permission.
function workerResources(
  r: Resource,
  subscriberKind: 'queue' | 'bus' | 'snstopic' | undefined,
): PhysicalResource[] {
  const out = [
    P('Lambda', 'Function', { paid: true }),
    P('IAM', 'Execution role', { security: true }),
    P('CloudWatch', 'Log group', { paid: true }),
  ];
  if (subscriberKind === 'queue')
    out.push(P('Lambda', 'SQS event-source mapping', { note: 'consumes its queue' }));
  else if (subscriberKind === 'snstopic')
    out.push(
      P('SNS', 'Topic subscription + invoke permission', { note: 'SNS pushes to the Lambda' }),
    );
  else if (subscriberKind === 'bus')
    out.push(
      P('EventBridge', 'Rule target + invoke permission', {
        note: 'the bus rule invokes the Lambda',
      }),
    );
  return out;
}

function resourcesFor(
  r: Resource,
  ctx: { subscriberKindOf: (w: Resource) => 'queue' | 'bus' | 'snstopic' | undefined },
): PhysicalResource[] | null {
  switch (r.kind) {
    case 'nextjs':
      return nextjsResources(r);
    case 'staticsite':
      return [
        P('S3', 'Site bucket', { paid: true, note: 'static files' }),
        P('CloudFront', 'Distribution', { paid: true, note: 'the public URL / CDN' }),
        P('CloudFront', 'viewer-request Function'),
        P('CloudFront', 'Origin Access (OAI)', { security: true }),
        P('CloudFront', 'Cache policy'),
      ];
    case 'bucket':
      return bucketResources(r);
    case 'dynamo':
      return [P('DynamoDB', 'Table', { paid: true, note: 'on-demand' })];
    case 'queue':
      return [P('SQS', 'Queue', { paid: true })];
    case 'bus':
      return [
        P('EventBridge', 'Event bus', { paid: true }),
        P('EventBridge', 'Rules per subscriber', { conditional: 'a worker subscribes' }),
      ];
    case 'snstopic':
      return [
        P('SNS', 'Topic', { paid: true }),
        P('SNS', 'Subscriptions per subscriber', { conditional: 'a worker subscribes' }),
      ];
    case 'apigatewayv2':
      return [
        P('API Gateway', 'HTTP API', { paid: true }),
        P('API Gateway', 'Default stage'),
        P('API Gateway', 'Route + integration', { conditional: 'a worker handles a route' }),
        P('Lambda', 'Invoke permission', {
          security: true,
          conditional: 'a worker handles a route',
        }),
        P('CloudWatch', 'Access log group', { paid: true }),
      ];
    case 'router':
      return [
        P('CloudFront', 'Distribution', { paid: true, note: 'the front-door CDN' }),
        P('CloudFront', 'Cache policy'),
        P('ACM', 'TLS certificate', { conditional: 'custom domain', security: true }),
        P('Route53', 'DNS records', { conditional: 'custom domain' }),
      ];
    case 'worker':
      return workerResources(r, ctx.subscriberKindOf(r));
    case 'cron':
      return [
        P('EventBridge', 'Scheduler schedule', { note: 'EventBridge Scheduler (not a Rule)' }),
        P('IAM', 'Scheduler role', { security: true }),
      ];
    case 'postgres':
      return [
        P('RDS', 'Postgres instance', { paid: true, note: 'db.t4g.micro' }),
        P('RDS', 'DB subnet group'),
        P('RDS', 'DB parameter group'),
        P('Secrets Manager', 'Master credentials', { security: true }),
        P('SSM', 'Link parameters', { note: 'Resource.<Db>.{host,port,…}' }),
      ];
    case 'aurora':
      return [
        P('RDS', 'Aurora cluster', { paid: true, note: 'Serverless v2' }),
        P('RDS', 'Cluster instance (writer)', { paid: true }),
        P('RDS', 'DB subnet group'),
        P('RDS', 'Cluster parameter group'),
        P('Secrets Manager', 'Master credentials', { security: true }),
        P('SSM', 'Link parameters', { note: 'Resource.<Db>.{host,port,…}' }),
      ];
    case 'cognito':
      return [
        P('Cognito', 'User Pool', { security: true }),
        P('Cognito', 'User Pool Client', { note: 'addClient("Web") — no Identity Pool' }),
      ];
    case 'secret':
      return [P('SSM', 'Parameter (SecureString)', { security: true })];
    case 'ai':
      return [P('SSM', 'Parameter (SecureString)', { security: true, note: 'Anthropic API key' })];
    case 'email':
      return [P('SES', 'Email identity'), P('SES', 'Configuration set')];
    case 'stripe':
    case 'clerk':
    case 'mongodb':
    case 'externalApi':
      return [
        P('External', `${r.name} (no AWS infra)`, { note: 'env-driven third-party service' }),
      ];
    default:
      return null;
  }
}

// `nat` is the effective NAT (effectiveAwsNat) — floored at "ec2" when app code
// joins the VPC — so this view matches the generated sst.config.ts and the cost panel.
function vpcGroup(nat: 'none' | 'ec2' | 'managed'): InfraGroup {
  const resources = [
    P('VPC', 'VPC'),
    P('VPC', 'Public subnets ×2'),
    P('VPC', 'Private subnets ×2'),
    P('VPC', 'Route tables ×4'),
    P('EC2', 'Internet Gateway'),
    P('EC2', 'Default security group', { security: true }),
    P('Cloud Map', 'Private DNS namespace', {
      paid: true,
      note: '~$0.50/mo — the only standing VPC cost',
    }),
  ];
  if (nat === 'ec2') {
    resources.push(P('EC2', 'fck-nat instances ×2', { paid: true, note: 't4g.nano, ~$4/mo' }));
    resources.push(P('EC2', 'Elastic IPs (NAT)'));
  } else if (nat === 'managed') {
    resources.push(P('EC2', 'NAT Gateway(s)', { paid: true, note: '~$32/mo per AZ' }));
    resources.push(P('EC2', 'Elastic IPs (NAT)'));
  }
  return { id: 'vpc', title: 'VPC (shared by Postgres)', kind: 'vpc', resources };
}

const ORDER = [
  'nextjs',
  'staticsite',
  'postgres',
  'aurora',
  'dynamo',
  'bucket',
  'queue',
  'bus',
  'snstopic',
  'apigatewayv2',
  'router',
  'worker',
  'cron',
  'cognito',
  'secret',
  'ai',
  'email',
  'stripe',
  'clerk',
  'mongodb',
  'externalApi',
];

export function expandAws(bp: Blueprint): InfraGroup[] {
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const subscriberKindOf = (w: Resource): 'queue' | 'bus' | 'snstopic' | undefined => {
    const edge = bp.connections.find((c) => c.source === w.id && c.intent === 'subscribesTo');
    const kind = edge ? byId.get(edge.target)?.kind : undefined;
    return kind === 'queue' || kind === 'bus' || kind === 'snstopic' ? kind : undefined;
  };

  const sorted = [...bp.resources].sort(
    (a, b) => (ORDER.indexOf(a.kind) + 1 || 99) - (ORDER.indexOf(b.kind) + 1 || 99),
  );

  const groups: InfraGroup[] = [];
  for (const r of sorted) {
    const resources = resourcesFor(r, { subscriberKindOf });
    if (resources) groups.push({ id: r.id, title: r.name, kind: r.kind, resources });
  }

  const dbWithVpc = bp.resources.filter((r) => r.kind === 'postgres' || r.kind === 'aurora');
  if (dbWithVpc.length) groups.push(vpcGroup(effectiveAwsNat(bp)));

  return groups;
}
