import type { Blueprint } from '@/lib/core/blueprint/types';
import type { GeneratedFile } from '@/lib/core/codegen/types';
import { generateSstConfig } from './config';
import { generateRuntimeFiles } from './runtime';

// AWS / SST v4 generator. Emits sst.config.ts (M4) + runtime/app code (M5).
// M6 assembles these into the full export manifest (README, .env.example, …).
export function generateAws(bp: Blueprint): GeneratedFile[] {
  return [
    { path: 'sst.config.ts', content: generateSstConfig(bp), language: 'ts' },
    ...generateRuntimeFiles(bp),
  ];
}

export { generateSstConfig } from './config';
export { generateRuntimeFiles } from './runtime';
export { planAws } from './plan';
