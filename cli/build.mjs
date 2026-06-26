// Bundle the sst-dream CLI into a single, self-contained dist/sst-dream.mjs that
// imports the shared SSTDREAM engines (lib/core + lib/targets). Node-only, no deps
// at runtime. The static web builder keeps its own (Next) build — this is separate.
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
  outfile: resolve(root, 'dist/sst-dream.mjs'),
  alias: { '@': root }, // mirror the tsconfig "@/*" path alias
  logLevel: 'warning',
});

console.log('✓ built dist/sst-dream.mjs');
