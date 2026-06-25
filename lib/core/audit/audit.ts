import type { Blueprint } from '@/lib/core/blueprint/types';
import type { DeployTarget } from '@/lib/targets/types';
import { auditAws } from '@/lib/targets/aws-sst-v4/audit';
import { auditVercel } from '@/lib/targets/vercel/audit';
import type { SecurityFinding } from './types';

const AUDITORS: Partial<Record<DeployTarget, (bp: Blueprint) => SecurityFinding[]>> = {
  'aws-sst-v4': auditAws,
  vercel: auditVercel,
};

export function auditInfra(bp: Blueprint): SecurityFinding[] {
  const fn = AUDITORS[bp.target.deploy];
  return fn ? fn(bp) : [];
}

export type { SecurityFinding } from './types';
