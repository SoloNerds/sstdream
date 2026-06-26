#!/usr/bin/env node
// sst-dream — Live Infra Intelligence (Phase 1: local scan). Turns a local SST/Vercel
// project into a sanitized, confidence-scored infrastructure map — entirely on your
// machine, with NO credentials and NO network. Reuses SSTDREAM's reverse parser +
// the validation / simulation / cost / expansion / audit engines.
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scanRepo } from './scan';
import { toMarkdown } from './report';

const HELP = `sst-dream — local infrastructure intelligence (no credentials, no network)

Usage:
  sst-dream scan [dir]        Scan a local SST/Vercel project into an infra map
    --out <dir>               Where to write outputs (default: current dir)
    --json-only               Write only the graph JSON (skip the Markdown map)
    --quiet                   Suppress the stdout summary

Outputs:
  ARCHITECTURE.md             A human-readable architecture map
  sstdream-scan.json          The sanitized graph + cost/sim/audit (machine-readable, for CI)

Runs entirely on your machine. No credentials, no network, nothing uploaded.
`;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (flag: string) => process.argv.includes(flag);

function main(): void {
  const cmd = process.argv[2];
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    process.stdout.write(HELP);
    return;
  }
  if (cmd !== 'scan') {
    process.stderr.write(`Unknown command "${cmd}".\n\n${HELP}`);
    process.exitCode = 1;
    return;
  }

  const dirArg = process.argv[3] && !process.argv[3].startsWith('-') ? process.argv[3] : '.';
  const root = resolve(process.cwd(), dirArg);
  const outDir = resolve(process.cwd(), arg('--out') ?? '.');
  const now = new Date().toISOString();

  const result = scanRepo(root, now);

  // The JSON is already sanitized (secrets were redacted before parsing). Strip the
  // engine internals we don't need on disk; keep the shareable map.
  const jsonPath = join(outDir, 'sstdream-scan.json');
  writeFileSync(jsonPath, JSON.stringify(result, null, 2));

  let mdPath: string | undefined;
  if (!has('--json-only')) {
    mdPath = join(outDir, 'ARCHITECTURE.md');
    writeFileSync(mdPath, toMarkdown(result));
  }

  if (!has('--quiet')) {
    const broken = result.simulation.events.filter((e) => e.status === 'broken').length;
    process.stdout.write(
      `\n✓ Scanned ${result.scannedFiles.length} infra file(s) in ${root}\n` +
        `  ${result.nodes.length} resource(s) recovered` +
        (result.unmodeled.length ? ` · ${result.unmodeled.length} not recognized` : '') +
        `\n  ${result.redactions} secret(s) redacted · ~$${result.cost.totalMonthlyUsd.toFixed(2)}/mo` +
        (broken ? ` · ${broken} wiring issue(s)` : ' · wiring OK') +
        (mdPath ? `\n\n→ ${mdPath}  (read this)` : '') +
        `\n→ ${jsonPath}\n`,
    );
  }
}

main();
