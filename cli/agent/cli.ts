import { resolve } from 'node:path';
import { scanRepo, listInfraSources } from '../scan';
import { runCheck, runExplain } from './run';
import { renderAnswer } from './types';

const HELP = `sst-dream agent — local, read-only, SST-aware analysis (grounded; never writes infra)

Usage:
  sst-dream agent check [dir]               Flag deprecated SST patterns vs current docs
  sst-dream agent explain <resource> [dir]  Describe a resource from the scanned graph

Grounded in YOUR scanned graph + the verified SST v4 docs (cited). No model is called in
this build — zero network. BYO-model / local-LLM narration is opt-in and coming next.
`;

const dirArg = (a: string | undefined) => (a && !a.startsWith('-') ? a : '.');

/** Entry for `sst-dream agent <sub> …` (process.argv passed through). */
export function runAgent(argv: string[]): void {
  const sub = argv[3];
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    process.stdout.write(HELP);
    return;
  }

  if (sub === 'check') {
    const root = resolve(process.cwd(), dirArg(argv[4]));
    process.stdout.write(renderAnswer(runCheck(listInfraSources(root))));
    return;
  }

  if (sub === 'explain') {
    const resource = argv[4];
    if (!resource || resource.startsWith('-')) {
      process.stderr.write('Usage: sst-dream agent explain <resource> [dir]\n');
      process.exitCode = 1;
      return;
    }
    const root = resolve(process.cwd(), dirArg(argv[5]));
    const scan = scanRepo(root, new Date().toISOString());
    process.stdout.write(renderAnswer(runExplain(scan, resource)));
    return;
  }

  process.stderr.write(`Unknown agent command "${sub}".\n\n${HELP}`);
  process.exitCode = 1;
}
