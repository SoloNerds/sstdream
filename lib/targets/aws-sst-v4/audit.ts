import type { Blueprint } from '@/lib/core/blueprint/types';
import type { SecurityFinding } from '@/lib/core/audit/types';
import { effectiveAwsNat } from './generator/plan';

// Verified security/ops facts (resource-expansion sweep): OpenNext server/image Lambdas
// get PUBLIC Function URLs by default (protection: "none"); Bucket access: "public" is
// world-readable; managed NAT ≈ $32/mo/AZ vs fck-nat ≈ $4/mo; an SST VPC has no NAT, so
// in-VPC Lambdas have no internet egress (RDS access still works).

export function auditAws(bp: Blueprint): SecurityFinding[] {
  const out: SecurityFinding[] = [];
  const byKind = (k: string) => bp.resources.filter((r) => r.kind === k);
  const has = (k: string) => bp.resources.some((r) => r.kind === k);

  // Public buckets — world-readable.
  for (const b of byKind('bucket')) {
    if (b.props.access === 'public') {
      out.push({
        level: 'warn',
        title: `Bucket "${b.name}" is public`,
        detail:
          'access: "public" makes every object readable by anyone on the internet. Use "cloudfront" unless you really want public files.',
        resourceId: b.id,
      });
    }
  }

  // Next.js exposes public Lambda Function URLs by default.
  if (has('nextjs')) {
    out.push({
      level: 'info',
      title: 'Next.js server URLs are public by default',
      detail:
        'OpenNext exposes the server + image Lambdas via public Function URLs (protection: "none"); CloudFront fronts them. Lock origins to CloudFront with `protection` if needed.',
    });
  }

  // App handles data/payments but has no auth.
  const hasData = ['dynamo', 'postgres', 'aurora', 'mongodb', 'bucket', 'stripe'].some(has);
  const hasAuth = has('cognito') || has('clerk');
  if (has('nextjs') && hasData && !hasAuth) {
    out.push({
      level: 'warn',
      title: 'No authentication configured',
      detail:
        'Your app handles data or payments but has no Cognito or Clerk node — server actions and routes are open to anyone. Add an auth node.',
    });
  }

  // Server-only key hygiene.
  if (['stripe', 'mongodb', 'clerk', 'externalApi'].some(has)) {
    out.push({
      level: 'info',
      title: 'Keep server keys out of the client',
      detail:
        'STRIPE_SECRET_KEY / DATABASE_URL / CLERK_SECRET_KEY must stay server-only — never prefix them with NEXT_PUBLIC_. Only *_PUBLISHABLE_KEY values are safe in the browser.',
    });
  }

  // Secrets are in SSM, not .env.
  if (has('secret') || has('ai')) {
    out.push({
      level: 'info',
      title: 'Secrets live in SSM',
      detail:
        'Set them with `sst secret set <Name> <value>` — never hardcode or commit them. They are not part of .env.',
    });
  }

  // NAT cost / egress notes (Postgres + Aurora share the generated VPC).
  // Judged on the EFFECTIVE NAT: the generator floors NAT at "ec2" when app
  // code joins the VPC, so the raw nat prop may understate what ships.
  const dbs = [...byKind('postgres'), ...byKind('aurora')];
  if (dbs.length) {
    const nat = effectiveAwsNat(bp);
    for (const p of dbs.filter((d) => d.props.nat === 'managed')) {
      out.push({
        level: 'info',
        title: 'Managed NAT gateway is pricey',
        detail: '~$32/mo per AZ. fck-nat (nat: "ec2") gives the same egress for ~$4/mo.',
        resourceId: p.id,
      });
    }
    const explicit = dbs.some((d) => d.props.nat === 'ec2' || d.props.nat === 'managed');
    if (nat === 'ec2' && !explicit) {
      out.push({
        level: 'info',
        title: 'fck-nat added automatically',
        detail:
          'App code joins the VPC to reach the database, and in-VPC Lambdas have no internet egress without NAT — so the export ships fck-nat (nat: "ec2", ~$4/mo). Pick "managed" on the database node for heavier egress.',
        resourceId: dbs[0].id,
      });
    } else if (nat === 'none') {
      for (const p of dbs) {
        out.push({
          level: 'info',
          title: `"${p.name}" VPC has no internet egress`,
          detail:
            'With no NAT, Lambdas inside the VPC cannot reach the public internet (RDS access still works). Add fck-nat (nat: "ec2") if they must call external APIs.',
          resourceId: p.id,
        });
      }
    }
  }

  return out;
}
