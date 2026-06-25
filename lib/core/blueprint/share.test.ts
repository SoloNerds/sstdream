import { describe, it, expect } from 'vitest';
import { encodeDesign, decodeDesign, buildShareUrl, readDesignFromHash } from './share';
import { canvasToBlueprint } from './serialize';
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
});
