import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InfraReport } from './InfraView';
import { canvasToBlueprint } from '@/lib/core/blueprint/serialize';
import { expandInfra } from '@/lib/core/expansion/expand';
import { estimateCost } from '@/lib/core/cost/estimate';
import { auditInfra } from '@/lib/core/audit/audit';
import { getTarget } from '@/lib/targets/registry';
import { parseAwsConfig } from '@/lib/targets/aws-sst-v4/reverse';
import type { CanvasNode, CanvasEdge } from '@/lib/canvas/types';

// The first UI-component tests. `InfraReport` is the pure presentational half of the
// Infrastructure view — it takes the computed engine output as props, so we render it
// with react-dom/server (no jsdom, no store) and assert on the markup. This also pins
// the wiring between the cost/expansion engines and what the user sees.

function reportHtml(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  const bp = canvasToBlueprint(
    { nodes, edges },
    'aws-sst-v4',
    { name: 'demo', region: 'us-east-1', packageManager: 'yarn' },
    '1970-01-01T00:00:00.000Z',
  );
  return renderToStaticMarkup(
    createElement(InfraReport, {
      groups: expandInfra(bp),
      cost: estimateCost(bp),
      findings: auditInfra(bp),
      catalog: getTarget('aws-sst-v4').catalog,
    }),
  );
}

const node = (id: string, kind: string, name: string): CanvasNode => ({
  id,
  kind,
  name,
  props: {},
  position: { x: 0, y: 0 },
});

describe('InfraReport (UI render)', () => {
  it('renders the deployed AWS resources, a monthly cost, and the SST lifecycle strip', () => {
    const html = reportHtml(
      [node('nextjs_1', 'nextjs', 'Web'), node('postgres_2', 'postgres', 'Database')],
      [{ id: 'e1', source: 'nextjs_1', target: 'postgres_2', intent: 'queriesDb' }],
    );
    // expansion engine → physical resources
    expect(html).toContain('RDS');
    expect(html).toContain('Postgres instance');
    // cost engine → a monthly figure
    expect(html).toMatch(/\$\d+\.\d{2}\/mo/);
    // Track 3 — the lifecycle strip leads with sst dev / Live Lambda
    expect(html).toContain('sst dev');
    expect(html).toContain('Live Lambda');
  });

  it('surfaces a security finding (public bucket) in the Security & ops panel', () => {
    const html = reportHtml(
      [node('nextjs_1', 'nextjs', 'Web'), node('bucket_2', 'bucket', 'Uploads')],
      [{ id: 'e1', source: 'nextjs_1', target: 'bucket_2', intent: 'uploadsTo' }],
    );
    expect(html).toContain('Security &amp; ops');
  });

  it('end-to-end: a pasted sst.config.ts → reverse parser → Infra view shows ElastiCache', () => {
    const { nodes, edges } = parseAwsConfig(
      'const cache = new sst.aws.Redis("Cache", { vpc, engine: "valkey" });\n' +
        'const web = new sst.aws.Nextjs("Web", { link: [cache] });',
    );
    const html = reportHtml(nodes, edges);
    expect(html).toContain('ElastiCache');
  });
});
