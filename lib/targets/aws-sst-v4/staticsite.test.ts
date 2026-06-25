import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { estimateAwsCost } from '@/lib/targets/aws-sst-v4/cost';
import { expandAws } from '@/lib/targets/aws-sst-v4/expansion';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import type { Blueprint } from '@/lib/core/blueprint/types';

const NOW = '2026-06-08T00:00:00.000Z';
const mk = (props: Record<string, unknown> = {}) =>
  draftBlueprint(
    {
      nodes: [{ id: 's1', kind: 'staticsite', name: 'Site', props, position: { x: 0, y: 0 } }],
      edges: [],
    },
    'aws-sst-v4',
    { name: 'site-app', region: 'us-east-1', packageManager: 'yarn' },
    NOW,
  );
const config = (bp: Blueprint) =>
  generateFiles(bp).find((f) => f.path === 'sst.config.ts')!.content;

describe('StaticSite', () => {
  it('validates and renders a standalone StaticSite with a url output', () => {
    const bp = mk();
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    const c = config(bp);
    expect(c).toContain('new sst.aws.StaticSite("Site", {');
    expect(c).toContain('path: "."');
    expect(c).toContain('site: site.url');
  });

  it('emits a build block only when command + output are both set', () => {
    expect(config(mk())).not.toContain('build:');
    const c = config(
      mk({ path: 'packages/web', buildCommand: 'npm run build', buildOutput: 'dist' }),
    );
    expect(c).toContain('build: { command: "npm run build", output: "dist" }');
    expect(c).toContain('path: "packages/web"');
  });

  it('costs S3 + CloudFront and expands to a CDN (no Lambda)', () => {
    const bp = mk();
    expect(estimateAwsCost(bp).perResource[0].monthlyUsd).toBeGreaterThan(0);
    const grp = expandAws(bp).find((g) => g.kind === 'staticsite')!;
    expect(grp.resources.some((r) => r.service === 'CloudFront')).toBe(true);
    expect(grp.resources.some((r) => r.service === 'Lambda')).toBe(false);
  });
});
