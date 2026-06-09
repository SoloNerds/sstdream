import type { Blueprint } from '@/lib/core/blueprint/types';
import type { GeneratedFile } from '@/lib/core/codegen/types';
import { generateSstConfig } from './config';
import { generateRuntimeFiles } from './runtime';
import { generateScaffold } from './scaffold';

// AWS / SST v4 generator. Emits sst.config.ts + runtime/app code, then a complete
// runnable-project scaffold (package.json, tsconfig, layout/page, AGENTS.md) so the
// export is `yarn install && sst dev`-ready and self-documenting for Claude.
export function generateAws(bp: Blueprint): GeneratedFile[] {
  const config: GeneratedFile = {
    path: 'sst.config.ts',
    content: generateSstConfig(bp),
    language: 'ts',
  };
  const files = [config, ...generateRuntimeFiles(bp)];
  const additions = files.find((f) => f.path === 'package.additions.json');
  const deps = additions
    ? ((JSON.parse(additions.content) as { dependencies?: Record<string, string> }).dependencies ??
      {})
    : {};
  return [...files, ...generateScaffold(bp, files, deps)];
}

export { generateSstConfig } from './config';
export { generateRuntimeFiles } from './runtime';
export { planAws } from './plan';
