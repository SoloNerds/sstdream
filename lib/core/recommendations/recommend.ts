import { awsRecommendations } from '@/lib/targets/aws-sst-v4/recommendations';
import type { Blueprint } from '@/lib/core/blueprint/types';
import type { DeployTarget } from '@/lib/targets/types';
import type { Recommendation, Recommender } from './types';

const RECOMMENDERS: Partial<Record<DeployTarget, Recommender>> = {
  'aws-sst-v4': awsRecommendations,
};

export function recommendBlueprint(bp: Blueprint): Recommendation[] {
  const recommender = RECOMMENDERS[bp.target.deploy];
  return recommender ? recommender(bp) : [];
}

export type { Recommendation, RecKind } from './types';
