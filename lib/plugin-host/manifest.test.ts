import { describe, it, expect } from 'vitest';
import { CapabilityManifestSchema } from './manifest';
import { manifestHash, isGrantCurrent, type PluginGrant } from './grant';

describe('CapabilityManifest schema', () => {
  it('accepts a minimal read-only, no-egress plugin and defaults safely', () => {
    const m = CapabilityManifestSchema.parse({ id: 'my-analyzer', kind: 'analyzer' });
    expect(m.egress).toBe('none');
    expect(m.writes).toBe('none');
    expect(m.egressHosts).toEqual([]);
  });

  it('accepts an allowlisted bare FQDN for a hosted connector', () => {
    const m = CapabilityManifestSchema.parse({
      id: 'cloudwatch',
      kind: 'connector',
      egress: 'hosted',
      egressHosts: ['monitoring.us-east-1.amazonaws.com'],
      reads: ['graph', 'cloud:aws:cloudwatch:ro'],
      credentials: ['aws-readonly'],
    });
    expect(m.egressHosts).toContain('monitoring.us-east-1.amazonaws.com');
  });

  it('REJECTS a wildcard egress host', () => {
    expect(() =>
      CapabilityManifestSchema.parse({
        id: 'x',
        kind: 'connector',
        egress: 'hosted',
        egressHosts: ['*.amazonaws.com'],
      }),
    ).toThrow();
  });

  it('REJECTS egress !== none with an empty host allowlist (no phone-home-anywhere)', () => {
    expect(() =>
      CapabilityManifestSchema.parse({
        id: 'x',
        kind: 'connector',
        egress: 'hosted',
        egressHosts: [],
      }),
    ).toThrow();
  });

  it('REJECTS any write capability (v1 is read-only)', () => {
    expect(() =>
      CapabilityManifestSchema.parse({ id: 'x', kind: 'connector', writes: 'deploy' }),
    ).toThrow();
  });

  it('REJECTS unknown keys (strict)', () => {
    expect(() =>
      CapabilityManifestSchema.parse({ id: 'x', kind: 'connector', sneaky: true }),
    ).toThrow();
  });
});

describe('grant hashing', () => {
  it('pins the manifest hash and forces re-consent when the manifest changes', () => {
    const m = CapabilityManifestSchema.parse({ id: 'cw', kind: 'connector' });
    const grant: PluginGrant = {
      id: 'cw',
      manifestHash: manifestHash(m),
      grantedScopes: { reads: [], egress: 'none', egressHosts: [] },
      grantedAt: '2026-06-26T00:00:00.000Z',
    };
    expect(isGrantCurrent(grant, m)).toBe(true);

    // The plugin now wants network egress — the hash changes, the old grant no longer applies.
    const escalated = CapabilityManifestSchema.parse({
      id: 'cw',
      kind: 'connector',
      egress: 'hosted',
      egressHosts: ['api.example.com'],
    });
    expect(isGrantCurrent(grant, escalated)).toBe(false);
  });
});
