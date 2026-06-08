import type { Blueprint } from '@/lib/core/blueprint/types';
import type { GeneratedFile } from '@/lib/core/codegen/types';
import { generateSstConfig } from './config';

// AWS / SST v4 generator. M4 emits sst.config.ts; M5 extends this with runtime
// code; M6 assembles the full export manifest.
export function generateAws(bp: Blueprint): GeneratedFile[] {
  return [{ path: 'sst.config.ts', content: generateSstConfig(bp), language: 'ts' }];
}

export { generateSstConfig } from './config';
export { planAws } from './plan';
