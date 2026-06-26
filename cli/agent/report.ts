import type { ScanResult } from '../scan';
import type { DeprecationHit } from './deprecations';

// `agent report` — one grounded, deterministic markdown report for a whole project. It combines
// the scan's engine output (graph, cost, wiring, audit, validation, the honest unmodeled list)
// with the deprecated-SST check, and ends with suggested checks. No model, no network — every
// line traces to the graph or the verified docs.

function section(out: string[], heading: string, lines: string[]): void {
  if (!lines.length) return;
  out.push(`## ${heading}`, '', ...lines, '');
}

export function buildReport(scan: ScanResult, deprecations: DeprecationHit[]): string {
  const broken = scan.simulation.events.filter((e) => e.status === 'broken');
  const orphanSecrets = scan.validation.warnings.filter((w) => w.rule === 'orphan-secret').length;

  const out: string[] = [];
  out.push(`# ${scan.appName} — agent report`, '');
  out.push(
    `> Grounded in the scanned graph and the verified SST v4 docs. Read-only. ` +
      `${scan.redactions} secret(s) redacted before parsing.`,
    '',
  );

  section(out, 'Summary', [
    `- ${scan.nodes.length} resources, ${scan.edges.length} connections, ~$${scan.cost.totalMonthlyUsd.toFixed(2)}/mo (lane: ${scan.target})`,
    `- ${scan.validation.errors.length} error(s), ${scan.validation.warnings.length} warning(s), ${broken.length} wiring issue(s)`,
    `- ${deprecations.length} deprecated SST pattern(s), ${scan.unmodeled.length} construct(s) not modeled`,
  ]);

  section(
    out,
    'Deprecated SST (update against current docs)',
    deprecations.map((d) => `- **${d.file}:${d.line}** ${d.title}. ${d.fix} _(${d.doc})_`),
  );

  section(
    out,
    'Wiring issues',
    broken.map((e) => `- ${e.label}${e.detail ? ` ${e.detail}` : ''}`),
  );

  section(
    out,
    'Validation',
    scan.validation.diagnostics.map(
      (d) => `- [${d.severity}] ${d.message}${d.hint ? ` ${d.hint}` : ''}`,
    ),
  );

  section(
    out,
    'Security and ops',
    scan.audit.map((a) => `- [${a.level}] ${a.title}. ${a.detail}`),
  );

  section(
    out,
    'Estimated cost',
    scan.cost.perResource
      .filter((p) => p.monthlyUsd > 0)
      .map((p) => `- ${p.name} (${p.kind}): ~$${p.monthlyUsd.toFixed(2)}/mo`),
  );

  out.push('## Not recognized', '');
  if (scan.unmodeled.length) {
    for (const u of scan.unmodeled) out.push(`- \`${u.snippet}\` ${u.reason}`);
  } else {
    out.push('- Everything in your infra files mapped.');
  }
  out.push('');

  const checks: string[] = [];
  if (deprecations.length)
    checks.push(`Update ${deprecations.length} deprecated SST pattern(s) to current syntax.`);
  if (broken.length)
    checks.push(`Wire up ${broken.length} resource(s) that have no consumer or trigger.`);
  if (orphanSecrets)
    checks.push(
      `Confirm ${orphanSecrets} secret(s) flagged unlinked are actually used. The scan only sees link: edges.`,
    );
  if (scan.unmodeled.length)
    checks.push(`Review ${scan.unmodeled.length} construct(s) the static scan could not model.`);
  section(
    out,
    'Suggested checks',
    checks.map((c) => `- ${c}`),
  );

  out.push(
    '---',
    '_Deterministic, grounded report. No model was called. This never writes infrastructure._',
  );
  return out.join('\n') + '\n';
}
