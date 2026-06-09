import type { Blueprint } from '@/lib/core/blueprint/types';
import type { DeployTarget } from '@/lib/targets/types';
import { expandAws } from '@/lib/targets/aws-sst-v4/expansion';
import type { InfraGroup } from './types';

// Per-lane "what actually gets deployed" expanders. AWS first; Vercel degrades to
// empty (its lane is integration-config, not provisioned infra) until added.
const EXPANDERS: Partial<Record<DeployTarget, (bp: Blueprint) => InfraGroup[]>> = {
  'aws-sst-v4': expandAws,
};

export function expandInfra(bp: Blueprint): InfraGroup[] {
  const fn = EXPANDERS[bp.target.deploy];
  return fn ? fn(bp) : [];
}

export function canExpand(target: DeployTarget): boolean {
  return Boolean(EXPANDERS[target]);
}
