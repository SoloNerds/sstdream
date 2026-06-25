import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — plain-JS module shared with the standalone collector script.
import { sanitize } from '@/scripts/sstdream-collect.mjs';

// The import collector ships secrets off the user's machine into a browser paste, so
// its redaction is safety-critical. This runs the sanitizer against an adversarial
// corpus (authored by a 4-agent stress workflow) of real secret shapes hidden in SST
// infra — AWS/Stripe/LLM keys, connection strings incl. Prisma ?api_key= + JDBC params,
// PEM blocks, base64-encoded creds, and secrets split across string fragments. Every
// planted secret VALUE must vanish; resource NAMES + structure must survive.

type Case = { snippet: string; secret: string };
// The corpus is base64-encoded on disk: its fixtures contain real-FORMAT (fake)
// secrets that would otherwise trip GitHub push protection / secret scanners. Decode
// at runtime — no literal secret string is committed.
const corpus = JSON.parse(
  Buffer.from(
    readFileSync(join(process.cwd(), 'scripts/secret-corpus.b64'), 'utf8'),
    'base64',
  ).toString('utf8'),
) as Case[];

const run = (s: string) => (sanitize(s) as { text: string; redactions: number }).text;

describe('import sanitizer — no secret survives the adversarial corpus', () => {
  for (const [i, c] of corpus.entries()) {
    const secret = c.secret.trim();
    if (!secret) continue; // the false-positive guard case is asserted separately below
    it(`redacts case ${i + 1}: ${secret.slice(0, 28).replace(/\s+/g, ' ')}…`, () => {
      const out = run(c.snippet);
      // The literal secret value must not survive verbatim…
      expect(out, 'verbatim secret leaked').not.toContain(secret);
      // …and neither should a long contiguous chunk of it (catches partial leaks).
      const core = secret.replace(/\s+/g, '');
      if (core.length >= 24) {
        const chunk = core.slice(0, Math.min(24, core.length));
        expect(out.replace(/\s+/g, ''), 'a chunk of the secret leaked').not.toContain(chunk);
      }
    });
  }

  it('does NOT redact resource names or structure (false-positive guard)', () => {
    const fp = corpus.find((c) => !c.secret.trim());
    expect(fp, 'corpus should include the false-positive guard case').toBeTruthy();
    const out = run(fp!.snippet);
    // Secret NAMES (first arg of new sst.Secret(...)) and the wiring must survive.
    expect(out).toContain('new sst.Secret("StripeSecretKey")');
    expect(out).toContain('new sst.Secret("ApiToken")');
    expect(out).toContain('new sst.aws.Function("Webhook"');
    expect(out).not.toContain('<REDACTED>');
  });

  it('keeps the structural sst.aws.* calls so the diagram still parses', () => {
    // The secret is dropped but the Function + its NAME survive (so it becomes a node).
    const { text } = sanitize(
      'const db = new sst.aws.Function("Api", { environment: { DATABASE_URL: "postgres://u:p4ss@host/db" } });',
    ) as { text: string };
    expect(text).toContain('new sst.aws.Function("Api"');
    expect(text).not.toContain('p4ss');
  });

  it('a connection string in a NON-secret field keeps scheme+host, drops only the creds', () => {
    const { text } = sanitize('const x = { upstream: "postgres://u:p4ss@host:5432/db" };') as {
      text: string;
    };
    expect(text).not.toContain('p4ss');
    expect(text).toContain('postgres://');
    expect(text).toContain('host:5432/db');
  });
});
