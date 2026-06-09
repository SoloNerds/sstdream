import type { DeployTarget, Target } from './types';
import { awsSstV4Target } from './aws-sst-v4';
import { vercelTarget } from './vercel';

const REGISTRY: Partial<Record<DeployTarget, Target>> = {
  'aws-sst-v4': awsSstV4Target,
  vercel: vercelTarget,
};

export const DEFAULT_TARGET: DeployTarget = 'aws-sst-v4';

export function getTarget(id: DeployTarget): Target {
  const target = REGISTRY[id];
  if (!target) {
    throw new Error(`Unknown or unimplemented deploy target: ${id}`);
  }
  return target;
}

export function listTargets(): Target[] {
  return Object.values(REGISTRY).filter((t): t is Target => Boolean(t));
}

export function isTargetImplemented(id: DeployTarget): boolean {
  return Boolean(REGISTRY[id]);
}
