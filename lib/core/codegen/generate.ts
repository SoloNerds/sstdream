import { generateAws } from '@/lib/targets/aws-sst-v4/generator';
import type { Blueprint } from '@/lib/core/blueprint/types';
import type { DeployTarget } from '@/lib/targets/types';
import type { GeneratedFile } from './types';

const GENERATORS: Partial<Record<DeployTarget, (bp: Blueprint) => GeneratedFile[]>> = {
  'aws-sst-v4': generateAws,
  // 'vercel': generateVercel,  // M10
};

export function generateFiles(bp: Blueprint): GeneratedFile[] {
  const gen = GENERATORS[bp.target.deploy];
  if (!gen) {
    throw new Error(`No generator implemented for target "${bp.target.deploy}".`);
  }
  return gen(bp);
}

export function canGenerate(target: DeployTarget): boolean {
  return Boolean(GENERATORS[target]);
}
