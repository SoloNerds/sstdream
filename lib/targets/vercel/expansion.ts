import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { InfraGroup, PhysicalResource } from '@/lib/core/expansion/types';

// Vercel "what actually gets provisioned" map. Verified against docs/vercel-target.md:
// the app is hosted Functions + Edge Network (no app-owned AWS infra); Blob is S3-backed
// and first-party; Postgres/Redis are EXTERNAL Marketplace services the app connects to;
// Queues/Workflows are native (beta). This is the read-only Infrastructure view.

const P = (
  service: string,
  name: string,
  opts: Partial<Omit<PhysicalResource, 'service' | 'name'>> = {},
): PhysicalResource => ({ service, name, ...opts });

function resourcesFor(r: Resource): PhysicalResource[] {
  switch (r.kind) {
    case 'app':
      return [
        P('Vercel', 'Edge Network (CDN)', { paid: true, note: 'global; serves static + caches' }),
        P('Vercel', 'Serverless / Fluid Functions', { paid: true, note: 'one per route handler' }),
        P('Vercel', 'Build & deployments', { note: 'preview per push, prod on the main branch' }),
        P('Vercel', 'Environment variables', { security: true, note: 'encrypted at rest' }),
      ];
    case 'blob':
      return [
        P('Vercel Blob', 'Store (S3-backed)', {
          paid: true,
          security: true,
          note: 'immutable public|private mode',
        }),
        P('Vercel', 'BLOB_READ_WRITE_TOKEN', { security: true }),
      ];
    case 'postgres':
      return [
        P('Neon', 'Serverless Postgres (external)', {
          paid: true,
          security: true,
          note: 'connect via DATABASE_URL',
        }),
      ];
    case 'redis':
      return [
        P('Upstash', 'Serverless Redis (external)', {
          paid: true,
          security: true,
          note: 'REST URL + token',
        }),
      ];
    case 'queue':
      return [
        P('Vercel Queue', 'Topic (beta)', { paid: true, note: 'at-least-once; no built-in DLQ' }),
      ];
    case 'consumer':
      return [
        P('Vercel', 'Consumer function', { paid: true, note: 'push-mode (handleCallback)' }),
        P('Vercel', 'experimentalTriggers (vercel.json)', {
          note: 'queue/v2beta — changes before GA',
        }),
      ];
    case 'cron':
      return [
        P('Vercel Cron', 'Schedule (vercel.json)', { note: 'production deployments only; UTC' }),
        P('Vercel', 'GET route function', { security: true, note: 'must verify CRON_SECRET' }),
      ];
    case 'webhook':
      return [
        P('Vercel', 'Webhook route function', { security: true, note: 'must verify signature' }),
      ];
    case 'email':
      return [P('Resend', 'Email API (external)', { security: true, note: 'RESEND_API_KEY' })];
    default:
      return [];
  }
}

export function expandVercel(bp: Blueprint): InfraGroup[] {
  return bp.resources.map((r) => ({
    id: r.id,
    title: r.name,
    kind: r.kind,
    resources: resourcesFor(r),
  }));
}
