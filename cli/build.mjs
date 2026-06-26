// Bundle the sst-dream CLI into a single, self-contained scripts/sst-dream.mjs that
// imports the shared SSTDREAM engines (lib/core + lib/targets). Node-only, no deps at
// runtime. This file is COMMITTED so users can drop the scripts/ folder into their own
// project and run it with no clone, no install, no build. CI rebuilds it and fails on
// drift, so the committed copy is always current. (The static web builder keeps its own
// Next build — this is separate.)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [resolve(root, 'cli/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: resolve(root, 'scripts/sst-dream.mjs'),
  alias: { '@': root }, // mirror the tsconfig "@/*" path alias
  logLevel: 'warning',
});

console.log('✓ built scripts/sst-dream.mjs');
