import { describe, it, expect } from 'vitest';
import { VERCEL_CATALOG, VERCEL_CATALOG_ORDER } from './catalog';
import { VERCEL_EDGE_INTENTS, vercelDefaultIntent } from './edges';

describe('vercel catalog', () => {
  it('catalog order covers every kind exactly once', () => {
    expect([...VERCEL_CATALOG_ORDER].sort()).toEqual(Object.keys(VERCEL_CATALOG).sort());
  });

  it('every catalog entry has a valid PascalCase defaultName', () => {
    for (const meta of Object.values(VERCEL_CATALOG)) {
      expect(meta.defaultName).toMatch(/^[A-Z][A-Za-z0-9]*$/);
    }
  });

  it('select props declare value/label options', () => {
    for (const meta of Object.values(VERCEL_CATALOG)) {
      for (const prop of meta.props ?? []) {
        if (prop.type === 'select') {
          expect(prop.options?.length).toBeGreaterThan(0);
          for (const opt of prop.options ?? []) {
            expect(typeof opt.value).toBe('string');
            expect(typeof opt.label).toBe('string');
          }
        }
      }
    }
  });
});

describe('vercel edge intents', () => {
  it('the SaaS wiring resolves to the expected intents', () => {
    expect(vercelDefaultIntent('app', 'blob')).toBe('storesFileIn');
    expect(vercelDefaultIntent('app', 'postgres')).toBe('writesToService');
    expect(vercelDefaultIntent('app', 'queue')).toBe('enqueuesTo');
    expect(vercelDefaultIntent('queue', 'consumer')).toBe('consumedBy');
  });

  it('returns null for unmapped pairs and self connections', () => {
    expect(vercelDefaultIntent('blob', 'postgres')).toBeNull();
    expect(vercelDefaultIntent('consumer', 'queue')).toBeNull();
    expect(vercelDefaultIntent('app', 'app')).toBeNull();
  });

  it('every default intent exists in the registry with consistent from/to', () => {
    const byIntent = new Map(VERCEL_EDGE_INTENTS.map((i) => [i.intent, i]));
    for (const from of VERCEL_CATALOG_ORDER) {
      for (const to of VERCEL_CATALOG_ORDER) {
        const intent = vercelDefaultIntent(from, to);
        if (!intent) continue;
        const meta = byIntent.get(intent);
        expect(meta).toBeDefined();
        expect(meta!.from).toContain(from);
        expect(meta!.to).toContain(to);
      }
    }
  });
});
