import { describe, it, expect } from 'vitest';
import { TEMPLATES } from './registry';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { generateFiles } from '@/lib/core/codegen/generate';

const NOW = '2026-06-08T00:00:00.000Z';

describe('template library', () => {
  it('has unique template ids', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    'template "%s" validates with zero errors and generates files',
    (_id, tpl) => {
      const bp = draftBlueprint(tpl.snapshot, tpl.target, tpl.app, NOW);
      const result = validateBlueprint(bp);
      expect(result.errors, JSON.stringify(result.errors)).toHaveLength(0);
      expect(generateFiles(bp).length).toBeGreaterThan(0);
    },
  );

  it('every resource name is a valid SST/route identifier', () => {
    for (const tpl of TEMPLATES) {
      for (const node of tpl.snapshot.nodes) {
        expect(node.name, `${tpl.id}:${node.name}`).toMatch(/^[A-Z][A-Za-z0-9]*$/);
      }
    }
  });
});
