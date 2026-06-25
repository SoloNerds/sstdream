import type { Blueprint } from '@/lib/core/blueprint/types';

export type RecKind = 'wiring' | 'reliability' | 'best-practice';

export interface Recommendation {
  id: string;
  kind: RecKind;
  title: string;
  detail: string;
  resourceId?: string;
  /**
   * Pure, idempotent blueprint transform that applies the fix. Absent means the
   * recommendation is advisory only. Applying twice must equal applying once.
   */
  apply?: (bp: Blueprint) => Blueprint;
}

export type Recommender = (bp: Blueprint) => Recommendation[];
