import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import { serializeBlueprint, parseBlueprint } from './serialize';
import type { Blueprint } from './types';

// Encode a design into a compact, URL-safe string so any architecture is a
// shareable link. Everything stays client-side: the payload lives in the URL
// hash (never sent to a server), and decode runs the full migrate + Zod parse,
// so a tampered link can only ever produce a valid blueprint or null.

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Compress + URL-encode a blueprint (deflate → base64url). */
export function encodeDesign(bp: Blueprint): string {
  const json = serializeBlueprint(bp);
  const compressed = deflateSync(strToU8(json), { level: 9 });
  return toBase64Url(compressed);
}

/** Decode a shared design back to a validated blueprint, or null if invalid. */
export function decodeDesign(encoded: string): Blueprint | null {
  try {
    const json = strFromU8(inflateSync(fromBase64Url(encoded)));
    return parseBlueprint(json);
  } catch {
    return null;
  }
}

/**
 * Strip anything that could carry a real secret/value from a design before it
 * goes into a shareable link. We share the SHAPE, never the values:
 *  - key-value props (e.g. a Next.js `environment` map) keep their keys but have
 *    every value blanked — a pasted API key or connection string never travels.
 *  - the envelope `secrets`/`outputs` lists are dropped entirely.
 * Names, kinds, edges, schedules, access levels, and env-var *names* are kept —
 * they describe the architecture, not a secret.
 */
export function sanitizeForShare(bp: Blueprint): Blueprint {
  const redactProps = (props: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const blanked: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>)) blanked[k] = '';
        out[key] = blanked;
      } else {
        out[key] = value;
      }
    }
    return out;
  };
  return {
    ...bp,
    resources: bp.resources.map((r) => ({ ...r, props: redactProps(r.props) })),
    secrets: [],
    outputs: [],
  };
}

/** Build a full shareable builder URL (sanitized — no secret values travel). */
export function buildShareUrl(origin: string, bp: Blueprint): string {
  return `${origin}/builder#d=${encodeDesign(sanitizeForShare(bp))}`;
}

/** Read a `#d=...` design from a builder URL hash, or null if absent/invalid. */
export function readDesignFromHash(hash: string): Blueprint | null {
  const match = /[#&]d=([^&]+)/.exec(hash);
  return match ? decodeDesign(match[1]) : null;
}
