import type { CanvasNode, CanvasEdge } from '@/lib/canvas/types';
import type { TemplateMeta } from './types';

// Builders to keep the Vercel template snapshots terse and readable. Every design
// uses only the Vercel catalog kinds and valid edge intents, and validates clean
// (templates.test.ts enforces zero errors + >0 generated files per template).
const n = (
  id: string,
  kind: string,
  name: string,
  x: number,
  y: number,
  props: Record<string, unknown> = {},
): CanvasNode => ({ id, kind, name, props, position: { x, y } });
const e = (id: string, source: string, target: string, intent: string): CanvasEdge => ({
  id,
  source,
  target,
  intent,
});

const vercel = (
  id: string,
  name: string,
  description: string,
  tags: string[],
  appName: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): TemplateMeta => ({
  id,
  name,
  description,
  target: 'vercel',
  tags,
  app: { name: appName, region: 'iad1', packageManager: 'yarn' },
  snapshot: { nodes, edges },
});

const DAILY = { schedule: '0 5 * * *' };

export const VERCEL_TEMPLATES: TemplateMeta[] = [
  vercel(
    'vercel-blog',
    'Blog / CMS',
    'Next.js blog on Vercel: Neon Postgres for posts, Vercel Blob for images.',
    ['Content', 'Starter'],
    'vercel-blog',
    [
      n('app_1', 'app', 'Web', 60, 160),
      n('postgres_2', 'postgres', 'Db', 360, 80),
      n('blob_3', 'blob', 'Media', 360, 240),
    ],
    [e('e1', 'app_1', 'postgres_2', 'writesToService'), e('e2', 'app_1', 'blob_3', 'storesFileIn')],
  ),
  vercel(
    'vercel-ecommerce',
    'E-commerce Store',
    'Storefront with Postgres catalog, Blob product images, an order queue + consumer, a Stripe webhook, and Resend receipts.',
    ['Commerce', 'Flagship', 'Payments'],
    'vercel-store',
    [
      n('app_1', 'app', 'Web', 60, 220),
      n('postgres_2', 'postgres', 'Catalog', 360, 60),
      n('blob_3', 'blob', 'ProductImages', 360, 160),
      n('queue_4', 'queue', 'Orders', 360, 280),
      n('consumer_5', 'consumer', 'FulfillOrder', 640, 280),
      n('email_6', 'email', 'Mailer', 360, 380),
      n('webhook_7', 'webhook', 'StripeHook', 60, 60),
    ],
    [
      e('e1', 'app_1', 'postgres_2', 'writesToService'),
      e('e2', 'app_1', 'blob_3', 'storesFileIn'),
      e('e3', 'app_1', 'queue_4', 'enqueuesTo'),
      e('e4', 'queue_4', 'consumer_5', 'consumedBy'),
      e('e5', 'app_1', 'email_6', 'sendsEmailThrough'),
    ],
  ),
  vercel(
    'vercel-saas-pro',
    'SaaS Pro',
    'Multi-tenant SaaS: Postgres data, Upstash Redis cache, transactional email, and a daily digest cron.',
    ['SaaS'],
    'vercel-saas-pro',
    [
      n('app_1', 'app', 'Web', 60, 200),
      n('postgres_2', 'postgres', 'Db', 360, 80),
      n('redis_3', 'redis', 'Cache', 360, 200),
      n('email_4', 'email', 'Mailer', 360, 320),
      n('cron_5', 'cron', 'DailyDigest', 60, 360, DAILY),
    ],
    [
      e('e1', 'app_1', 'postgres_2', 'writesToService'),
      e('e2', 'app_1', 'redis_3', 'writesToService'),
      e('e3', 'app_1', 'email_4', 'sendsEmailThrough'),
    ],
  ),
  vercel(
    'vercel-marketing',
    'Marketing Site',
    'A fast marketing site with a Resend contact form and a weekly newsletter cron. Zero-config deploy.',
    ['Marketing', 'Starter'],
    'vercel-marketing',
    [
      n('app_1', 'app', 'Web', 60, 160),
      n('email_2', 'email', 'ContactForm', 360, 100),
      n('cron_3', 'cron', 'Newsletter', 360, 240, DAILY),
    ],
    [e('e1', 'app_1', 'email_2', 'sendsEmailThrough')],
  ),
  vercel(
    'vercel-image-pipeline',
    'Image Pipeline',
    'Upload to Vercel Blob, enqueue a resize job, and process it in a push-mode queue consumer.',
    ['Pipeline'],
    'vercel-images',
    [
      n('app_1', 'app', 'Web', 60, 180),
      n('blob_2', 'blob', 'Uploads', 360, 80),
      n('queue_3', 'queue', 'ResizeJobs', 360, 240),
      n('consumer_4', 'consumer', 'ResizeImage', 640, 240),
    ],
    [
      e('e1', 'app_1', 'blob_2', 'storesFileIn'),
      e('e2', 'app_1', 'queue_3', 'enqueuesTo'),
      e('e3', 'queue_3', 'consumer_4', 'consumedBy'),
    ],
  ),
  vercel(
    'vercel-job-board',
    'Job Board',
    'Listings in Postgres, company logos in Blob, an expiry cron, and Resend alerts.',
    ['Content', 'Marketplace'],
    'vercel-jobs',
    [
      n('app_1', 'app', 'Web', 60, 200),
      n('postgres_2', 'postgres', 'Listings', 360, 80),
      n('blob_3', 'blob', 'Logos', 360, 200),
      n('email_4', 'email', 'Notifier', 360, 320),
      n('cron_5', 'cron', 'ExpireListings', 60, 360, DAILY),
    ],
    [
      e('e1', 'app_1', 'postgres_2', 'writesToService'),
      e('e2', 'app_1', 'blob_3', 'storesFileIn'),
      e('e3', 'app_1', 'email_4', 'sendsEmailThrough'),
    ],
  ),
  vercel(
    'vercel-realtime',
    'Realtime / Presence',
    'Postgres for durable data plus Upstash Redis for presence and live counters.',
    ['Realtime'],
    'vercel-realtime',
    [
      n('app_1', 'app', 'Web', 60, 160),
      n('postgres_2', 'postgres', 'Db', 360, 80),
      n('redis_3', 'redis', 'Presence', 360, 240),
    ],
    [
      e('e1', 'app_1', 'postgres_2', 'writesToService'),
      e('e2', 'app_1', 'redis_3', 'writesToService'),
    ],
  ),
  vercel(
    'vercel-webhook-hub',
    'Webhook Hub',
    'Receive a signed webhook, enqueue it, and process events in a consumer; an event log in Postgres.',
    ['Integration', 'Webhooks'],
    'vercel-webhooks',
    [
      n('app_1', 'app', 'Web', 60, 200),
      n('webhook_2', 'webhook', 'IncomingHook', 60, 60, { provider: 'generic' }),
      n('queue_3', 'queue', 'Events', 360, 200),
      n('consumer_4', 'consumer', 'ProcessEvent', 640, 200),
      n('postgres_5', 'postgres', 'EventLog', 360, 60),
    ],
    [
      e('e1', 'app_1', 'queue_3', 'enqueuesTo'),
      e('e2', 'queue_3', 'consumer_4', 'consumedBy'),
      e('e3', 'app_1', 'postgres_5', 'writesToService'),
    ],
  ),
  vercel(
    'vercel-newsletter',
    'Newsletter',
    'Subscribers in Postgres, a scheduled send cron, and Resend delivery.',
    ['Marketing', 'Email'],
    'vercel-newsletter',
    [
      n('app_1', 'app', 'Web', 60, 180),
      n('postgres_2', 'postgres', 'Subscribers', 360, 80),
      n('email_3', 'email', 'Sender', 360, 240),
      n('cron_4', 'cron', 'SendIssue', 60, 340, DAILY),
    ],
    [
      e('e1', 'app_1', 'postgres_2', 'writesToService'),
      e('e2', 'app_1', 'email_3', 'sendsEmailThrough'),
    ],
  ),
  vercel(
    'vercel-background-jobs',
    'Background Jobs',
    'A Vercel Queue + push-mode consumer for async work, with Upstash Redis for locks/dedupe.',
    ['Jobs', 'Pipeline'],
    'vercel-jobs-runner',
    [
      n('app_1', 'app', 'Web', 60, 180),
      n('queue_2', 'queue', 'Tasks', 360, 120),
      n('consumer_3', 'consumer', 'RunTask', 640, 120),
      n('redis_4', 'redis', 'Locks', 360, 260),
    ],
    [
      e('e1', 'app_1', 'queue_2', 'enqueuesTo'),
      e('e2', 'queue_2', 'consumer_3', 'consumedBy'),
      e('e3', 'app_1', 'redis_4', 'writesToService'),
    ],
  ),
  vercel(
    'vercel-headless-cms',
    'Headless CMS',
    'Content in Postgres, media in Blob, and an Upstash Redis read cache for fast delivery.',
    ['Content', 'CMS'],
    'vercel-cms',
    [
      n('app_1', 'app', 'Web', 60, 200),
      n('postgres_2', 'postgres', 'Content', 360, 80),
      n('blob_3', 'blob', 'Assets', 360, 200),
      n('redis_4', 'redis', 'Cache', 360, 320),
    ],
    [
      e('e1', 'app_1', 'postgres_2', 'writesToService'),
      e('e2', 'app_1', 'blob_3', 'storesFileIn'),
      e('e3', 'app_1', 'redis_4', 'readsFromService'),
    ],
  ),
  vercel(
    'vercel-api-backend',
    'API Backend',
    'A JSON API with Postgres storage, Upstash Redis rate-limiting, and a partner webhook.',
    ['API', 'Backend'],
    'vercel-api',
    [
      n('app_1', 'app', 'Web', 60, 180),
      n('postgres_2', 'postgres', 'Db', 360, 80),
      n('redis_3', 'redis', 'RateLimit', 360, 220),
      n('webhook_4', 'webhook', 'PartnerHook', 60, 60, { provider: 'generic' }),
    ],
    [
      e('e1', 'app_1', 'postgres_2', 'writesToService'),
      e('e2', 'app_1', 'redis_3', 'writesToService'),
    ],
  ),
];
