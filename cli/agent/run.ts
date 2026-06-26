// The agent's deterministic core: it builds answers ONLY from the scan graph + the
// verified SST docs. No model, no network — this is the grounded backbone the optional
// model layer narrates over (and can never contradict). NOTE: this module must never
// import the generator (lib/core/codegen | lib/core/export) — enforced by a CI test.
import type { ScanResult } from '../scan';
import { findDeprecations } from './deprecations';
import type { AgentAnswer, Cited } from './types';

/** `agent check` — flag deprecated SST patterns against the verified docs. */
export function runCheck(files: { path: string; text: string }[]): AgentAnswer {
  const hits = findDeprecations(files);
  return {
    title: hits.length
      ? `${hits.length} deprecated SST pattern${hits.length === 1 ? '' : 's'} found`
      : 'No deprecated SST patterns found — your config matches current SST v4',
    knownFacts: hits.map((h) => ({
      text: `${h.file}:${h.line} — ${h.title} (\`${h.snippet}\`)`,
      source: h.doc,
    })),
    likelyCauses: [],
    suggestedChecks: hits.map((h) => `${h.file}:${h.line} → ${h.fix}`),
    unknowns: [],
    grounding: 'the verified SST v4 facts in docs/sst-v4-target.md',
  };
}

/** `agent explain <resource>` — describe a resource purely from the scanned graph. */
export function runExplain(scan: ScanResult, resourceName: string): AgentAnswer {
  const node = scan.nodes.find((n) => n.name.toLowerCase() === resourceName.toLowerCase());
  if (!node) {
    return {
      title: `No resource named "${resourceName}" in the scan`,
      knownFacts: [],
      likelyCauses: [],
      suggestedChecks: [
        `Resources in this scan: ${scan.nodes.map((n) => n.name).join(', ') || '(none)'}`,
      ],
      unknowns: [],
      grounding: 'the scanned graph',
    };
  }

  const nameOf = new Map(scan.nodes.map((n) => [n.id, n.name]));
  const known: Cited[] = [
    { text: `${node.name} is a \`${node.kind}\` resource.`, source: node.id },
  ];

  for (const e of scan.edges.filter((x) => x.source === node.id)) {
    known.push({
      text: `${node.name} ${e.intent} ${nameOf.get(e.target) ?? e.target}.`,
      source: e.id,
    });
  }
  for (const e of scan.edges.filter((x) => x.target === node.id)) {
    known.push({
      text: `${nameOf.get(e.source) ?? e.source} ${e.intent} ${node.name}.`,
      source: e.id,
    });
  }

  const cost = scan.cost.perResource.find((c) => c.resourceId === node.id);
  if (cost)
    known.push({
      text: `Estimated cost ~$${cost.monthlyUsd.toFixed(2)}/mo.`,
      source: 'cost engine',
    });
  const exp = scan.expansion.find((g) => g.id === node.id);
  if (exp) {
    known.push({
      text: `Expands to ${exp.resources.length} real AWS resource(s) when deployed.`,
      source: 'expansion engine',
    });
  }

  const checks = scan.validation.diagnostics
    .filter((d) => d.resourceId === node.id)
    .map((d) => `[${d.severity}] ${d.message}${d.hint ? ` — ${d.hint}` : ''}`);

  const unknowns: string[] = [];
  if (node.kind === 'unknown') {
    const sst =
      typeof node.props.sstComponent === 'string' ? node.props.sstComponent : 'unknown component';
    unknowns.push(
      `${node.name} is an unmodeled construct (${sst}) — shown for reference, not fully understood.`,
    );
  }
  for (const u of scan.unmodeled) {
    if (u.snippet.includes(node.name)) unknowns.push(`${u.snippet} — ${u.reason}`);
  }

  return {
    title: `${node.name} (${node.kind})`,
    knownFacts: known,
    likelyCauses: [],
    suggestedChecks: checks,
    unknowns,
    grounding: 'the scanned graph + verified SST v4 facts',
  };
}
