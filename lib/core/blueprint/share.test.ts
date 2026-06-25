import { describe, it, expect } from 'vitest';
import {
  encodeDesign,
  decodeDesign,
  buildShareUrl,
  readDesignFromHash,
  sanitizeForShare,
} from './share';
import { canvasToBlueprint, draftBlueprint } from './serialize';
import { AI_PROCESSING_APP } from '@/lib/templates/ai-processing-app';
import { VERCEL_SAAS } from '@/lib/templates/vercel-saas';

const NOW = '2026-06-08T00:00:00.000Z';
const aws = canvasToBlueprint(AI_PROCESSING_APP.snapshot, 'aws-sst-v4', AI_PROCESSING_APP.app, NOW);
const vercel = canvasToBlueprint(VERCEL_SAAS.snapshot, 'vercel', VERCEL_SAAS.app, NOW);

describe('shareable design URLs', () => {
  it('round-trips a blueprint through encode → decode (both lanes)', () => {
    expect(decodeDesign(encodeDesign(aws))).toEqual(aws);
    expect(decodeDesign(encodeDesign(vercel))).toEqual(vercel);
  });

  it('produces a URL-safe payload (no +, /, = or whitespace)', () => {
    const encoded = encodeDesign(aws);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('compresses well below the raw JSON size', () => {
    const raw = JSON.stringify(aws).length;
    expect(encodeDesign(aws).length).toBeLessThan(raw);
  });

  it('builds a /builder#d=... URL and reads it back from the hash', () => {
    const url = buildShareUrl('https://example.com', aws);
    expect(url.startsWith('https://example.com/builder#d=')).toBe(true);
    const hash = url.slice(url.indexOf('#'));
    expect(readDesignFromHash(hash)).toEqual(aws);
  });

  it('returns null for a tampered or absent payload (never throws)', () => {
    expect(decodeDesign('not-valid-base64!!')).toBeNull();
    expect(decodeDesign('')).toBeNull();
    expect(readDesignFromHash('#nope')).toBeNull();
    expect(readDesignFromHash('')).toBeNull();
  });

  it('a shared link strips secret values — keeps the shape, never the values', () => {
    const withSecrets = draftBlueprint(
      {
        nodes: [
          {
            id: 'web',
            kind: 'nextjs',
            name: 'Web',
            // a key-value env prop holding a REAL value (the only value-bearing field)
            props: { environment: { API_KEY: 'sk-super-secret-123', PUBLIC_URL: 'https://x.com' } },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        secrets: [{ id: 'sec_1', name: 'StripeSecretKey' }],
      },
      'aws-sst-v4',
      { name: 'leaky-app', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );

    // direct sanitizer: keys kept, values blanked, secrets dropped
    const clean = sanitizeForShare(withSecrets);
    expect(clean.resources[0].props.environment).toEqual({ API_KEY: '', PUBLIC_URL: '' });
    expect(clean.secrets).toEqual([]);
    // the design SHAPE is preserved (name, kind, env-var NAMES)
    expect(clean.resources[0].name).toBe('Web');

    // end-to-end: the secret value never appears in the link, and decoding it back
    // yields the blanked design
    const url = buildShareUrl('https://example.com', withSecrets);
    expect(url).not.toContain('sk-super-secret-123');
    const decoded = readDesignFromHash(url.slice(url.indexOf('#')))!;
    expect(decoded.resources[0].props.environment).toEqual({ API_KEY: '', PUBLIC_URL: '' });
    expect(decoded.secrets).toEqual([]);
  });
});
