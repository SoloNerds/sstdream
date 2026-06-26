import type { ScanResult } from './scan';

const KIND_NOTE = (c: 'high' | 'low') => (c === 'high' ? '' : ' _(low confidence)_');

/** A human-readable architecture map for a scanned project (Markdown). */
export function toMarkdown(r: ScanResult): string {
  const out: string[] = [];
  out.push(`# ${r.appName} — infrastructure map`);
  out.push('');
  out.push(
    `> Scanned locally by **sst-dream** — no credentials, no network. ` +
      `${r.redactions} potential secret${r.redactions === 1 ? '' : 's'} redacted before parsing. ` +
      `Lane: \`${r.target}\`.`,
  );
  out.push('');

  // Resources
  out.push(`## Resources (${r.nodes.length})`);
  out.push('');
  if (r.nodes.length) {
    out.push('| Resource | Kind | Confidence |');
    out.push('| --- | --- | --- |');
    for (const n of r.nodes) out.push(`| ${n.name} | \`${n.kind}\` | ${n.confidence} |`);
  } else {
    out.push('_No resources recovered. Is this an SST/Vercel project root?_');
  }
  out.push('');

  // Data flow
  if (r.edges.length) {
    out.push('## Data flow');
    out.push('');
    const byId = new Map(r.nodes.map((n) => [n.id, n.name]));
    for (const e of r.edges) {
      out.push(
        `- **${byId.get(e.source) ?? e.source}** → **${byId.get(e.target) ?? e.target}** (\`${e.intent}\`)`,
      );
    }
    out.push('');
  }

  // Cost
  out.push('## Estimated cost');
  out.push('');
  out.push(`**~$${r.cost.totalMonthlyUsd.toFixed(2)}/mo** (rough design-time ballpark).`);
  const paid = r.cost.perResource.filter((p) => p.monthlyUsd > 0);
  if (paid.length) {
    out.push('');
    for (const p of paid) out.push(`- ${p.name} (\`${p.kind}\`): ~$${p.monthlyUsd.toFixed(2)}/mo`);
  }
  out.push('');

  // Simulation — does everything talk?
  const broken = r.simulation.events.filter((e) => e.status === 'broken');
  out.push('## Wiring check');
  out.push('');
  if (broken.length === 0) {
    out.push('✅ Every resource is reachable / wired.');
  } else {
    out.push(`⚠️ ${broken.length} wiring issue(s):`);
    for (const e of broken) out.push(`- ${e.label}${e.detail ? ` — ${e.detail}` : ''}`);
  }
  out.push('');

  // Audit (security/ops)
  if (r.audit.length) {
    out.push('## Security & ops');
    out.push('');
    for (const f of r.audit) out.push(`- **[${f.level}]** ${f.title} — ${f.detail}`);
    out.push('');
  }

  // The honest "couldn't model" section.
  out.push('## Not recognized (review by hand)');
  out.push('');
  if (r.unmodeled.length === 0) {
    out.push('Everything in your infra files mapped cleanly. 🎉');
  } else {
    out.push(
      `${r.unmodeled.length} thing(s) the static scan couldn't model — dynamic/loop/helper ` +
        `patterns or components not in the catalog. These are **not** in the map above:`,
    );
    out.push('');
    for (const u of r.unmodeled) out.push(`- \`${u.snippet}\` — ${u.reason}`);
  }
  out.push('');

  out.push('---');
  out.push(
    `_Generated ${r.generatedAt} from ${r.scannedFiles.length} file(s). ` +
      `This is a **local-inferred** view of your code — not deployed truth._${KIND_NOTE('high')}`,
  );
  return out.join('\n') + '\n';
}
