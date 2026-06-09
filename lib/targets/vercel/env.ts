import type { Blueprint } from '@/lib/core/blueprint/types';

export interface EnvVar {
  name: string;
  scope: 'server' | 'client';
  environments: string[];
}

const ALL = ['development', 'preview', 'production'];
const DEPLOYED = ['preview', 'production'];

/** Collect the environment variables this Vercel design needs. */
export function collectEnv(bp: Blueprint): EnvVar[] {
  const has = (kind: string) => bp.resources.some((r) => r.kind === kind);
  const vars: EnvVar[] = [{ name: 'NEXT_PUBLIC_APP_NAME', scope: 'client', environments: ALL }];
  if (has('blob'))
    vars.push({ name: 'BLOB_READ_WRITE_TOKEN', scope: 'server', environments: DEPLOYED });
  if (has('postgres')) vars.push({ name: 'DATABASE_URL', scope: 'server', environments: ALL });
  if (has('redis')) {
    vars.push({ name: 'UPSTASH_REDIS_REST_URL', scope: 'server', environments: ALL });
    vars.push({ name: 'UPSTASH_REDIS_REST_TOKEN', scope: 'server', environments: ALL });
  }
  if (has('email')) vars.push({ name: 'RESEND_API_KEY', scope: 'server', environments: DEPLOYED });
  if (has('webhook')) {
    vars.push({ name: 'STRIPE_SECRET_KEY', scope: 'server', environments: DEPLOYED });
    vars.push({ name: 'STRIPE_WEBHOOK_SECRET', scope: 'server', environments: DEPLOYED });
  }
  if (has('cron'))
    vars.push({ name: 'CRON_SECRET', scope: 'server', environments: ['production'] });
  return vars;
}
