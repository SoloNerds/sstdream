import type { Blueprint } from '@/lib/core/blueprint/types';

export interface AwsEnvVar {
  name: string;
  scope: 'server' | 'client';
  /** Placeholder/format hint shown in .env.example (e.g. "sk_test_..."). */
  hint?: string;
  /** Short grouping comment. */
  group?: string;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/**
 * Collect the .env variables an AWS export needs. External integrations (Stripe,
 * MongoDB, generic APIs) are env-driven (Next.js inlines them at build). SST secrets
 * (sst.Secret / the AI key) are set via `sst secret set`, NOT here.
 */
export function collectAwsEnv(bp: Blueprint): AwsEnvVar[] {
  const has = (kind: string) => bp.resources.some((r) => r.kind === kind);
  const vars: AwsEnvVar[] = [{ name: 'NEXT_PUBLIC_APP_NAME', scope: 'client', group: 'App' }];

  if (has('stripe')) {
    vars.push({ name: 'STRIPE_SECRET_KEY', scope: 'server', hint: 'sk_test_...', group: 'Stripe' });
    vars.push({
      name: 'STRIPE_WEBHOOK_SECRET',
      scope: 'server',
      hint: 'whsec_...',
      group: 'Stripe',
    });
    vars.push({
      name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      scope: 'client',
      hint: 'pk_test_...',
      group: 'Stripe',
    });
  }

  if (has('clerk')) {
    vars.push({
      name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      scope: 'client',
      hint: 'pk_test_...',
      group: 'Clerk',
    });
    vars.push({ name: 'CLERK_SECRET_KEY', scope: 'server', hint: 'sk_test_...', group: 'Clerk' });
    vars.push({
      name: 'CLERK_WEBHOOK_SIGNING_SECRET',
      scope: 'server',
      hint: 'whsec_...',
      group: 'Clerk',
    });
  }

  if (has('mongodb')) {
    vars.push({
      name: 'DATABASE_URL',
      scope: 'server',
      hint: 'mongodb+srv://user:pass@cluster.mongodb.net/db',
      group: 'MongoDB',
    });
  }

  for (const r of bp.resources.filter((res) => res.kind === 'externalApi')) {
    const baseUrlEnv = str(r.props.baseUrlEnv) ?? 'API_BASE_URL';
    const keyEnv = str(r.props.keyEnv) ?? 'API_KEY';
    vars.push({
      name: baseUrlEnv,
      scope: 'server',
      hint: 'https://api.example.com',
      group: r.name,
    });
    vars.push({ name: keyEnv, scope: 'server', group: r.name });
  }

  // de-dup by name (keep first)
  const seen = new Set<string>();
  return vars.filter((v) => (seen.has(v.name) ? false : (seen.add(v.name), true)));
}
