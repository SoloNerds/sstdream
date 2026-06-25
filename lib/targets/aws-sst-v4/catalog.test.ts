import { describe, it, expect } from 'vitest';
import { AWS_CATALOG, AWS_CATALOG_ORDER } from './catalog';
import { AWS_EDGE_INTENTS, awsDefaultIntent } from './edges';

describe('aws-sst-v4 catalog', () => {
  it('matches snapshot', () => {
    expect(AWS_CATALOG).toMatchSnapshot();
  });

  it('catalog order covers every kind exactly once', () => {
    expect([...AWS_CATALOG_ORDER].sort()).toEqual(Object.keys(AWS_CATALOG).sort());
  });

  it('every catalog entry has a valid PascalCase defaultName', () => {
    for (const meta of Object.values(AWS_CATALOG)) {
      expect(meta.defaultName).toMatch(/^[A-Z][A-Za-z0-9]*$/);
    }
  });
});

describe('aws-sst-v4 edge intents', () => {
  it('the AI Processing App wiring resolves to the expected intents', () => {
    expect(awsDefaultIntent('nextjs', 'bucket')).toBe('uploadsTo');
    expect(awsDefaultIntent('nextjs', 'queue')).toBe('publishesTo');
    expect(awsDefaultIntent('worker', 'queue')).toBe('subscribesTo');
    expect(awsDefaultIntent('worker', 'dynamo')).toBe('writesTo');
  });

  it('returns null for unmapped pairs — the canvas refuses meaningless connections', () => {
    // The old catch-all 'linksTo' silently generated nothing (or a broken link).
    expect(awsDefaultIntent('bucket', 'dynamo')).toBeNull();
    expect(awsDefaultIntent('router', 'staticsite')).toBeNull();
    expect(awsDefaultIntent('worker', 'stripe')).toBeNull();
  });

  it('returns null for a self connection', () => {
    expect(awsDefaultIntent('bucket', 'bucket')).toBeNull();
  });

  it('every default intent exists in the intent registry', () => {
    const known = new Set(AWS_EDGE_INTENTS.map((i) => i.intent));
    for (const from of AWS_CATALOG_ORDER) {
      for (const to of AWS_CATALOG_ORDER) {
        const intent = awsDefaultIntent(from, to);
        if (intent) expect(known.has(intent)).toBe(true);
      }
    }
  });
});
