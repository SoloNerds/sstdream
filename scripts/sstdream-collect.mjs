#!/usr/bin/env node
// SSTDREAM import collector. Run this in your SST project; it bundles every
// resource-defining file (sst.config.ts + your packages/infra/*.ts modules, wherever
// they live) into ONE blob you paste into the builder's "From code" import — because
// the browser builder can't read your filesystem.
//
// SAFETY: it runs entirely on YOUR machine and SANITIZES secrets before writing — it
// never reads .env files, and redacts hardcoded keys/tokens/passwords/connection
// strings (over-redacting on purpose). Review the output before pasting; nothing is
// uploaded anywhere by this script.
//
// Usage:  node sstdream-collect.mjs [projectDir]
//   (defaults to the current directory; output -> sstdream-import.txt)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep, basename } from 'node:path';
import { sanitize } from './sanitize.mjs';

const root = process.argv[2] ? process.argv[2] : process.cwd();

// Dirs we never descend into (heavy, generated, or secret-bearing).
const SKIP_DIRS = new Set([
  'node_modules',
  '.sst',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
  'coverage',
  '.cache',
]);
const MAX_FILES = 200;
const MAX_BYTES = 600_000; // keep the paste manageable

/** Recursively list .ts/.tsx files, skipping heavy dirs and any .env / .d.ts. */
function listSourceFiles(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) out = out.concat(listSourceFiles(p));
    } else if (
      /\.(ts|tsx)$/.test(e.name) &&
      !e.name.endsWith('.d.ts') &&
      !/^\.env/i.test(e.name) // never touch env files
    ) {
      out.push(p);
    }
  }
  return out;
}

// A file matters if it DEFINES infrastructure (or is the app config). Resource usage
// (`Resource.Foo`) in a handler doesn't — we only want `new sst.*` / `$config`.
const DEFINES_INFRA = /(\bnew\s+sst\.|sst\.Linkable\b|\$config\s*\(|export\s+default\s+\$config)/;

function main() {
  const all = listSourceFiles(root);
  const infra = all.filter((f) => {
    try {
      return DEFINES_INFRA.test(readFileSync(f, 'utf8'));
    } catch {
      return false;
    }
  });

  if (infra.length === 0) {
    console.error(
      'No SST resource files found (looked for `new sst.*` / `$config`).\n' +
        'Run this from your SST project root (where sst.config.ts lives).',
    );
    process.exit(1);
  }

  // config first, then the rest sorted — stable, readable output.
  infra.sort((a, b) => {
    const ca = /sst\.config\.tsx?$/.test(a) ? 0 : 1;
    const cb = /sst\.config\.tsx?$/.test(b) ? 0 : 1;
    return ca - cb || a.localeCompare(b);
  });

  let blob = '';
  let totalRedactions = 0;
  let used = 0;
  let truncated = false;
  for (const f of infra) {
    if (used >= MAX_FILES || blob.length >= MAX_BYTES) {
      truncated = true;
      break;
    }
    const rel = relative(root, f).split(sep).join('/');
    const { text, redactions } = sanitize(readFileSync(f, 'utf8'));
    totalRedactions += redactions;
    blob += `// ===== FILE: ${rel} =====\n${text}\n\n`;
    used += 1;
  }

  const outPath = join(process.cwd(), 'sstdream-import.txt');
  writeFileSync(outPath, blob);

  console.log(
    `\n✓ Collected ${used} infra file(s)${truncated ? ' (truncated — large project)' : ''}.`,
  );
  console.log(`✓ Redacted ${totalRedactions} potential secret value(s).`);
  console.log(`\n→ Wrote ${basename(outPath)}. REVIEW it, then paste its contents into`);
  console.log(`  the builder's "From code" import (AWS lane).`);
  if (totalRedactions > 0) {
    console.log(`\n  Note: secret values were replaced with <REDACTED>. The diagram only`);
    console.log(`  needs your resources + links, not their secret values.`);
  }
  if (truncated) {
    console.log(`\n  Large project: only the first ${used} files were included. The diagram`);
    console.log(`  will show what was captured; the rest will be listed as "not recognized".`);
  }
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
