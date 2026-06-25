import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const gen = (id: string) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const bp = draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW);
  return Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));
};

describe('example frontend (closes backend↔frontend loop)', () => {
  it('generates a list page + create form wired to the table actions', () => {
    const byPath = gen('aws-marketplace');

    const page = byPath['app/listings/page.tsx'];
    expect(page).toBeDefined();
    expect(page).toContain('import { list } from "../actions/listings"');
    expect(page).toContain('const items = await list()');
    expect(page).toContain('<CreateForm />');

    const form = byPath['app/listings/create-form.tsx'];
    expect(form).toContain('"use client"');
    expect(form).toContain('import { create } from "../actions/listings"');
    expect(form).toContain('const [pk, setPk] = useState');
    expect(form).toContain('const [sk, setSk] = useState');
    expect(form).toContain('await create({ pk, sk })');
    expect(form).toContain('router.refresh()');
  });

  it('generates the Mongo example page when the app queries Mongo', () => {
    const byPath = gen('aws-clerk-saas');
    expect(byPath['app/items/page.tsx']).toContain('import { list } from "../actions/items"');
    expect(byPath['app/items/create-form.tsx']).toContain('await create({ name })');
  });
});
