import { estimateAwsCost } from '@/lib/targets/aws-sst-v4/cost';
import type { Blueprint } from '@/lib/core/blueprint/types';
import type { DeployTarget } from '@/lib/targets/types';
import type { CostEstimate, CostProvider } from './types';

const PROVIDERS: Partial<Record<DeployTarget, CostProvider>> = {
  'aws-sst-v4': estimateAwsCost,
};

const EMPTY = (region: string, target: string): CostEstimate => ({
  perResource: [],
  totalMonthlyUsd: 0,
  region,
  assumptions: [],
  disclaimer: `Cost estimation is not available for the "${target}" lane yet.`,
});

export function estimateCost(bp: Blueprint): CostEstimate {
  const provider = PROVIDERS[bp.target.deploy];
  return provider ? provider(bp) : EMPTY(bp.app.region, bp.target.deploy);
}

export type { CostEstimate, CostBreakdown } from './types';
