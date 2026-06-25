import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'a', region: 'us-east-1', packageManager: 'yarn' as const };
const t = TEMPLATES.find((x) => x.id === 'aws-cdn-router')!;
const bp = draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW);
const config = generateFiles(bp).find((f) => f.path === 'sst.config.ts')!.content;

describe('Router (sst.aws.Router)', () => {
  it('validates clean and renders router + routeBucket + the StaticSite router option', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    expect(config).toContain('new sst.aws.Router("Router", {');
    expect(config).toContain('domain: "example.com"');
    expect(config).toContain('router.routeBucket("/assets", assets);');
    expect(config).toContain('router: { instance: router, path: "/docs" }');
    expect(config).toContain('router: router.url');
  });

  it('errors when a routed bucket is not access: cloudfront (would ship a 403ing site)', () => {
    const bad = draftBlueprint(
      {
        nodes: [
          { id: 'r1', kind: 'router', name: 'Router', props: {}, position: { x: 0, y: 0 } },
          { id: 'b2', kind: 'bucket', name: 'Files', props: {}, position: { x: 1, y: 0 } },
        ],
        edges: [{ id: 'e', source: 'r1', target: 'b2', intent: 'routesBucket' }],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    expect(validateBlueprint(bad).errors.map((w) => w.rule)).toContain('routed-bucket-cloudfront');
  });
});
