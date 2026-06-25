import { describe, it, expect } from 'vitest';
import { auditAws } from '@/lib/targets/aws-sst-v4/audit';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'a', region: 'us-east-1', packageManager: 'yarn' as const };
const fromTpl = (id: string) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  return draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW);
};
const titles = (id: string | ReturnType<typeof fromTpl>) =>
  auditAws(typeof id === 'string' ? fromTpl(id) : id).map((f) => f.title);

describe('AWS security & ops audit', () => {
  it('flags a public bucket as a warning', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'b2',
            kind: 'bucket',
            name: 'Public',
            props: { access: 'public' },
            position: { x: 1, y: 0 },
          },
        ],
        edges: [{ id: 'e', source: 'n1', target: 'b2', intent: 'uploadsTo' }],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    const f = auditAws(bp).find((x) => x.title === 'Bucket "Public" is public')!;
    expect(f.level).toBe('warn');
  });

  it('warns when an app handles data but has no auth (CMS)', () => {
    expect(titles('aws-cms')).toContain('No authentication configured');
  });

  it('treats Aurora as data — a Next.js + Aurora + no-auth app is flagged', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'a1', kind: 'aurora', name: 'Db', props: {}, position: { x: 1, y: 0 } },
        ],
        edges: [{ id: 'e', source: 'n1', target: 'a1', intent: 'queriesDb' }],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    expect(titles(bp)).toContain('No authentication configured');
  });

  it('does NOT warn about auth when Clerk is present, but flags server-key hygiene', () => {
    const t = titles('aws-clerk-saas');
    expect(t).not.toContain('No authentication configured');
    expect(t).toContain('Keep server keys out of the client');
  });

  it('notes managed NAT cost, the auto-added fck-nat floor, and no-egress for a consumer-less VPC', () => {
    const managed = draftBlueprint(
      {
        nodes: [
          { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'p2',
            kind: 'postgres',
            name: 'Db',
            props: { nat: 'managed' },
            position: { x: 1, y: 0 },
          },
        ],
        edges: [{ id: 'e', source: 'n1', target: 'p2', intent: 'queriesDb' }],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    expect(titles(managed)).toContain('Managed NAT gateway is pricey');
    // relational-saas has a queriesDb consumer → the export floors NAT at fck-nat,
    // so the audit reports the auto-add instead of a (now false) no-egress finding.
    const saas = titles('aws-relational-saas');
    expect(saas).toContain('fck-nat added automatically');
    expect(saas.some((t) => /no internet egress/.test(t))).toBe(false);

    const standalone = draftBlueprint(
      {
        nodes: [{ id: 'p1', kind: 'postgres', name: 'Db', props: {}, position: { x: 0, y: 0 } }],
        edges: [],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    expect(titles(standalone).some((t) => /no internet egress/.test(t))).toBe(true);
  });
});
