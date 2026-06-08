import type { NodeKind } from './types';

export interface NodeKindMeta {
  kind: NodeKind;
  label: string;
  description: string;
  /** Tailwind background class used as the node accent. */
  accent: string;
}

// M1 placeholder catalog (hard-coded). In M2 this is replaced by the active
// target's catalog (lib/targets/<target>/catalog.ts) behind the Target interface.
export const NODE_CATALOG: Record<NodeKind, NodeKindMeta> = {
  nextjs: {
    kind: 'nextjs',
    label: 'Next.js Web',
    description: 'sst.aws.Nextjs app',
    accent: 'bg-neutral-800',
  },
  bucket: {
    kind: 'bucket',
    label: 'Bucket',
    description: 'sst.aws.Bucket (S3)',
    accent: 'bg-emerald-600',
  },
  queue: {
    kind: 'queue',
    label: 'Queue',
    description: 'sst.aws.Queue (SQS)',
    accent: 'bg-amber-600',
  },
  worker: {
    kind: 'worker',
    label: 'Worker',
    description: 'sst.aws.Function subscriber',
    accent: 'bg-violet-600',
  },
  dynamo: {
    kind: 'dynamo',
    label: 'Dynamo',
    description: 'sst.aws.Dynamo table',
    accent: 'bg-sky-600',
  },
};

export const PALETTE_ORDER: NodeKind[] = ['nextjs', 'bucket', 'queue', 'worker', 'dynamo'];
