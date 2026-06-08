import type { Blueprint } from '@/lib/core/blueprint/types';

export interface CostLine {
  label: string;
  usd: number;
}

export interface CostBreakdown {
  resourceId: string;
  name: string;
  kind: string;
  monthlyUsd: number;
  lines: CostLine[];
}

export interface CostEstimate {
  perResource: CostBreakdown[];
  totalMonthlyUsd: number;
  region: string;
  assumptions: string[];
  disclaimer: string;
}

export type CostProvider = (bp: Blueprint) => CostEstimate;
