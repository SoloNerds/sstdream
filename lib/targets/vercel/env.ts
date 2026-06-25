import type { Blueprint } from '@/lib/core/blueprint/types';
import { kebabCase } from '@/lib/core/codegen/strings';

export interface EnvVar {
  name: string;
  scope: 'server' | 'client';
  environments: string[];
}

const ALL = ['development', 'preview', 'production'];
const DEPLOYED = ['preview', 'production'];

const screamingSnake = (s: string): string => kebabCase(s).replace(/-/g, '_').toUpperCase();

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
  for (const wh of bp.resources.filter((r) => r.kind === 'webhook')) {
    const provider = typeof wh.props.provider === 'string' ? wh.props.provider : 'stripe';
    if (provider === 'stripe') {
      vars.push({ name: 'STRIPE_SECRET_KEY', scope: 'server', environments: DEPLOYED });
      vars.push({ name: 'STRIPE_WEBHOOK_SECRET', scope: 'server', environments: DEPLOYED });
    } else {
      vars.push({
        name: `${screamingSnake(wh.name)}_WEBHOOK_SECRET`,
        scope: 'server',
        environments: DEPLOYED,
      });
    }
  }
  if (has('cron'))
    vars.push({ name: 'CRON_SECRET', scope: 'server', environments: ['production'] });
  if (has('edgeConfig')) vars.push({ name: 'EDGE_CONFIG', scope: 'server', environments: ALL });
  if (has('aiGateway'))
    vars.push({ name: 'AI_GATEWAY_API_KEY', scope: 'server', environments: DEPLOYED });
  for (const api of bp.resources.filter((r) => r.kind === 'externalApi')) {
    const baseUrl =
      typeof api.props.baseUrlEnv === 'string' && api.props.baseUrlEnv
        ? api.props.baseUrlEnv
        : `${screamingSnake(api.name)}_BASE_URL`;
    const key =
      typeof api.props.keyEnv === 'string' && api.props.keyEnv
        ? api.props.keyEnv
        : `${screamingSnake(api.name)}_API_KEY`;
    vars.push({ name: baseUrl, scope: 'server', environments: ALL });
    vars.push({ name: key, scope: 'server', environments: ALL });
  }

  // Dedupe by name (multiple Stripe webhooks share STRIPE_* vars).
  const seen = new Set<string>();
  return vars.filter((v) => (seen.has(v.name) ? false : (seen.add(v.name), true)));
}
