import type { CanvasNode, CanvasEdge } from '@/lib/canvas/types';
import type { TemplateMeta } from './types';

// Builders to keep the AWS template snapshots terse and readable.
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

const aws = (
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
  target: 'aws-sst-v4',
  tags,
  app: { name: appName, region: 'us-east-1', packageManager: 'yarn' },
  snapshot: { nodes, edges },
});

export const AWS_TEMPLATES: TemplateMeta[] = [
  aws(
    'aws-ai-chat',
    'AI Chat App',
    'Streaming Claude chat (claude-opus-4-8) with history in DynamoDB. The flagship AI starter.',
    ['AI', 'Flagship'],
    'ai-chat-app',
    [
      n('nextjs_1', 'nextjs', 'Web', 80, 160),
      n('ai_2', 'ai', 'AnthropicKey', 380, 80, { model: 'claude-opus-4-8' }),
      n('dynamo_3', 'dynamo', 'ChatHistory', 380, 240),
    ],
    [e('edge_4', 'nextjs_1', 'ai_2', 'usesAI'), e('edge_5', 'nextjs_1', 'dynamo_3', 'writesTo')],
  ),
  aws(
    'aws-starter',
    'Next.js Starter',
    'A bare Next.js app on AWS — add resources as you go.',
    ['Starter'],
    'nextjs-starter',
    [n('nextjs_1', 'nextjs', 'Web', 200, 160)],
    [],
  ),
  aws(
    'aws-upload',
    'File Upload',
    'Next.js + S3 with presigned uploads.',
    ['Storage'],
    'file-upload-app',
    [n('nextjs_1', 'nextjs', 'Web', 80, 160), n('bucket_2', 'bucket', 'Uploads', 380, 160)],
    [e('edge_3', 'nextjs_1', 'bucket_2', 'uploadsTo')],
  ),
  aws(
    'aws-blog',
    'Blog',
    'Posts in DynamoDB, media in S3.',
    ['Content'],
    'blog-app',
    [
      n('nextjs_1', 'nextjs', 'Web', 80, 160),
      n('dynamo_2', 'dynamo', 'Posts', 380, 80),
      n('bucket_3', 'bucket', 'Media', 380, 240),
    ],
    [
      e('edge_4', 'nextjs_1', 'dynamo_2', 'writesTo'),
      e('edge_5', 'nextjs_1', 'bucket_3', 'uploadsTo'),
    ],
  ),
  aws(
    'aws-cms',
    'CMS',
    'Content store, asset bucket, async reindex worker, admin secret.',
    ['Content'],
    'cms-app',
    [
      n('nextjs_1', 'nextjs', 'Web', 60, 200),
      n('dynamo_2', 'dynamo', 'Content', 360, 60),
      n('bucket_3', 'bucket', 'Assets', 360, 180),
      n('queue_4', 'queue', 'Reindex', 360, 300),
      n('worker_5', 'worker', 'Indexer', 640, 300),
      n('secret_6', 'secret', 'AdminToken', 60, 360),
    ],
    [
      e('edge_7', 'nextjs_1', 'dynamo_2', 'writesTo'),
      e('edge_8', 'nextjs_1', 'bucket_3', 'uploadsTo'),
      e('edge_9', 'nextjs_1', 'queue_4', 'publishesTo'),
      e('edge_10', 'worker_5', 'queue_4', 'subscribesTo'),
      e('edge_11', 'worker_5', 'dynamo_2', 'writesTo'),
      e('edge_12', 'nextjs_1', 'secret_6', 'usesSecret'),
    ],
  ),
  aws(
    'aws-lms',
    'LMS',
    'Courses + progress tables, video bucket, transcode worker.',
    ['Content', 'Media'],
    'lms-app',
    [
      n('nextjs_1', 'nextjs', 'Web', 60, 220),
      n('dynamo_2', 'dynamo', 'Courses', 360, 60),
      n('dynamo_3', 'dynamo', 'Progress', 360, 160),
      n('bucket_4', 'bucket', 'Videos', 360, 280),
      n('queue_5', 'queue', 'Transcode', 360, 400),
      n('worker_6', 'worker', 'Transcoder', 640, 400),
    ],
    [
      e('edge_7', 'nextjs_1', 'dynamo_2', 'writesTo'),
      e('edge_8', 'nextjs_1', 'dynamo_3', 'writesTo'),
      e('edge_9', 'nextjs_1', 'bucket_4', 'uploadsTo'),
      e('edge_10', 'nextjs_1', 'queue_5', 'publishesTo'),
      e('edge_11', 'worker_6', 'queue_5', 'subscribesTo'),
      e('edge_12', 'worker_6', 'dynamo_2', 'writesTo'),
    ],
  ),
  aws(
    'aws-marketplace',
    'Marketplace',
    'Listings, images, order queue + fulfillment worker, Stripe secret.',
    ['SaaS', 'Commerce'],
    'marketplace-app',
    [
      n('nextjs_1', 'nextjs', 'Web', 60, 200),
      n('dynamo_2', 'dynamo', 'Listings', 360, 60),
      n('bucket_3', 'bucket', 'Images', 360, 180),
      n('queue_4', 'queue', 'Orders', 360, 300),
      n('worker_5', 'worker', 'FulfillOrder', 640, 300),
      n('secret_6', 'secret', 'StripeKey', 60, 360),
    ],
    [
      e('edge_7', 'nextjs_1', 'dynamo_2', 'writesTo'),
      e('edge_8', 'nextjs_1', 'bucket_3', 'uploadsTo'),
      e('edge_9', 'nextjs_1', 'queue_4', 'publishesTo'),
      e('edge_10', 'worker_5', 'queue_4', 'subscribesTo'),
      e('edge_11', 'worker_5', 'dynamo_2', 'writesTo'),
      e('edge_12', 'nextjs_1', 'secret_6', 'usesSecret'),
    ],
  ),
  aws(
    'aws-marketing',
    'Marketing Site',
    'Leads table + a weekly report cron.',
    ['Marketing'],
    'marketing-app',
    [
      n('nextjs_1', 'nextjs', 'Web', 80, 160),
      n('dynamo_2', 'dynamo', 'Leads', 380, 80),
      n('cron_3', 'cron', 'WeeklyReport', 80, 320, { schedule: 'cron(0 13 ? * MON *)' }),
      n('worker_4', 'worker', 'SendReport', 380, 320),
    ],
    [
      e('edge_5', 'nextjs_1', 'dynamo_2', 'writesTo'),
      e('edge_6', 'cron_3', 'worker_4', 'invokes'),
      e('edge_7', 'worker_4', 'dynamo_2', 'readsFrom'),
    ],
  ),
];
