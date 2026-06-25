import { describe, it, expect } from 'vitest';
import { AWS_CATALOG } from './catalog';
import { awsDefaultIntent } from './edges';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { AWS_TEMPLATES } from '@/lib/templates/aws';

const NOW = '2026-06-08T00:00:00.000Z';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Completeness backstop (board meeting #3 / Priya): a new catalog kind that isn't
// wired into the generator — or isn't exercised by any template — should fail CI,
// not ship half-finished.
describe('AWS kind coverage', () => {
  it('every catalog kind appears in at least one template (so typecheck-export exercises it)', () => {
    const inTemplates = new Set(AWS_TEMPLATES.flatMap((t) => t.snapshot.nodes.map((n) => n.kind)));
    const missing = Object.keys(AWS_CATALOG).filter((k) => !inTemplates.has(k));
    expect(missing).toEqual([]);
  });

  // Each kind, placed next to the app with its default edge, must generate cleanly.
  for (const [kind, meta] of Object.entries(AWS_CATALOG)) {
    if (kind === 'nextjs') continue;
    it(`${kind} renders into sst.config.ts without crashing`, () => {
      const intent = awsDefaultIntent('nextjs', kind);
      const bp = draftBlueprint(
        {
          nodes: [
            { id: 'app', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
            { id: 'n', kind, name: cap(kind), props: {}, position: { x: 1, y: 0 } },
          ],
          edges: intent ? [{ id: 'e', source: 'app', target: 'n', intent }] : [],
        },
        'aws-sst-v4',
        { name: 'cov', region: 'us-east-1', packageManager: 'yarn' },
        NOW,
      );
      const cfg = generateFiles(bp).find((f) => f.path === 'sst.config.ts')!.content;
      expect(cfg.length).toBeGreaterThan(0);
      // Kinds with an `sst.*` component + a default app edge must actually render.
      const comp = meta.component.split(' ')[0];
      if (comp.startsWith('sst.') && intent) {
        expect(cfg, `${kind} (${comp}) should render in the config`).toContain(comp);
      }
    });
  }
});
