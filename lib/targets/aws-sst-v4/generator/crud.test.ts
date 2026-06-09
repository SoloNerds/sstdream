import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'a', region: 'us-east-1', packageManager: 'yarn' as const };
const gen = (id: string) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const bp = draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW);
  return Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));
};

describe('CRUD server actions baseline', () => {
  it('generates FULL CRUD (incl. read/list) for a table even when only writesTo was drawn', () => {
    // Marketplace: the app only "writesTo Listings" — but a real app needs reads too.
    const byPath = gen('aws-marketplace');
    const actions = byPath['app/actions/listings.ts'];
    expect(actions).toBeDefined();
    expect(actions).toContain('"use server"');
    expect(actions).toContain('Resource.Listings.name');
    expect(actions).toContain('export async function create(');
    expect(actions).toContain('export async function get(');
    expect(actions).toContain('export async function list('); // the missing "read" side
    expect(actions).toContain('export async function update(');
    expect(actions).toContain('export async function remove(');
    expect(actions).toContain('ScanCommand');
    expect(actions).toContain('type Key = { pk: string; sk: string }');
  });

  it('generates Mongo example actions + a Clerk auth guard for the Clerk SaaS', () => {
    const byPath = gen('aws-clerk-saas');
    expect(byPath['app/actions/items.ts']).toContain('getDb');
    expect(byPath['app/actions/items.ts']).toContain('insertOne');
    expect(byPath['lib/auth-guard.ts']).toContain('@clerk/nextjs/server');
    expect(byPath['lib/auth-guard.ts']).toContain('requireUser');
  });

  it('does NOT generate frontend actions for a table only a worker touches', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'q2', kind: 'queue', name: 'Jobs', props: {}, position: { x: 1, y: 0 } },
          { id: 'w3', kind: 'worker', name: 'Proc', props: {}, position: { x: 2, y: 0 } },
          { id: 'd4', kind: 'dynamo', name: 'Data', props: {}, position: { x: 3, y: 0 } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'q2', intent: 'publishesTo' },
          { id: 'e2', source: 'w3', target: 'q2', intent: 'subscribesTo' },
          { id: 'e3', source: 'w3', target: 'd4', intent: 'writesTo' },
        ],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    const paths = generateFiles(bp).map((f) => f.path);
    expect(paths).not.toContain('app/actions/data.ts');
  });
});
