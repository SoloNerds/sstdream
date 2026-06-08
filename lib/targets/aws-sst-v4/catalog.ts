import type { ResourceCatalog } from '../types';

// AWS / SST v4 catalog. Verified against docs/sst-v4-target.md.
export const AWS_CATALOG: ResourceCatalog = {
  nextjs: {
    kind: 'nextjs',
    label: 'Next.js Web',
    defaultName: 'Web',
    component: 'sst.aws.Nextjs',
    description: 'Next.js app on AWS (OpenNext → Lambda/S3/CloudFront)',
    accent: 'bg-neutral-800',
    category: 'compute',
    singleton: true,
  },
  bucket: {
    kind: 'bucket',
    label: 'Bucket',
    defaultName: 'Bucket',
    component: 'sst.aws.Bucket',
    description: 'S3 bucket for object storage / uploads',
    accent: 'bg-emerald-600',
    category: 'storage',
  },
  dynamo: {
    kind: 'dynamo',
    label: 'Dynamo',
    defaultName: 'Table',
    component: 'sst.aws.Dynamo',
    description: 'DynamoDB table',
    accent: 'bg-sky-600',
    category: 'database',
  },
  queue: {
    kind: 'queue',
    label: 'Queue',
    defaultName: 'Queue',
    component: 'sst.aws.Queue',
    description: 'SQS queue with a Lambda subscriber',
    accent: 'bg-amber-600',
    category: 'messaging',
  },
  worker: {
    kind: 'worker',
    label: 'Worker',
    defaultName: 'Worker',
    component: 'sst.aws.Function',
    description: 'Lambda function (queue subscriber / job handler)',
    accent: 'bg-violet-600',
    category: 'compute',
  },
  cron: {
    kind: 'cron',
    label: 'Cron',
    defaultName: 'Cron',
    component: 'sst.aws.CronV2',
    description: 'Scheduled Lambda (CronV2 — not the deprecated Cron)',
    accent: 'bg-rose-600',
    category: 'schedule',
  },
  secret: {
    kind: 'secret',
    label: 'Secret',
    defaultName: 'Secret',
    component: 'sst.Secret',
    description: 'Encrypted secret, set via `sst secret set`',
    accent: 'bg-stone-600',
    category: 'config',
  },
};

export const AWS_CATALOG_ORDER = [
  'nextjs',
  'bucket',
  'dynamo',
  'queue',
  'worker',
  'cron',
  'secret',
];
