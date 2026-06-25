import type { Blueprint } from '@/lib/core/blueprint/types';
import type { DeployTarget } from '@/lib/targets/types';
import { expandAws } from '@/lib/targets/aws-sst-v4/expansion';
import { expandVercel } from '@/lib/targets/vercel/expansion';
import type { InfraGroup } from './types';

// Per-lane "what actually gets deployed" expanders. AWS provisions infra; Vercel
// hosts Functions + integrates external services (see vercel/expansion.ts).
const EXPANDERS: Partial<Record<DeployTarget, (bp: Blueprint) => InfraGroup[]>> = {
  'aws-sst-v4': expandAws,
  vercel: expandVercel,
};

export function expandInfra(bp: Blueprint): InfraGroup[] {
  const fn = EXPANDERS[bp.target.deploy];
  return fn ? fn(bp) : [];
}

export function canExpand(target: DeployTarget): boolean {
  return Boolean(EXPANDERS[target]);
}
