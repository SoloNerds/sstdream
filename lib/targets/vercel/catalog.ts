import type { ResourceCatalog } from '../types';

// Vercel lane catalog. Verified against docs/vercel-target.md: Blob + Edge Config are
// first-party; KV/Postgres are external Marketplace (Upstash/Neon); Queues + Workflows
// are native. The app hosts on Vercel and integrates services — no app-owned AWS infra.
export const VERCEL_CATALOG: ResourceCatalog = {
  app: {
    kind: 'app',
    label: 'Vercel App',
    defaultName: 'Web',
    component: 'Vercel Next.js Project',
    description: 'Next.js on Vercel (zero-config deploy)',
    accent: 'bg-neutral-800',
    category: 'compute',
    singleton: true,
  },
  blob: {
    kind: 'blob',
    label: 'Blob',
    defaultName: 'Files',
    component: '@vercel/blob',
    description: 'Vercel Blob object storage (first-party)',
    accent: 'bg-emerald-600',
    category: 'storage',
    props: [
      {
        key: 'access',
        label: 'Access',
        type: 'select',
        default: 'public',
        options: [
          { value: 'public', label: 'Public (CDN URLs)' },
          { value: 'private', label: 'Private (signed access)' },
        ],
        help: 'Blob stores have an immutable public|private mode; every method needs a matching access value.',
      },
    ],
  },
  postgres: {
    kind: 'postgres',
    label: 'Postgres',
    defaultName: 'Db',
    component: 'Neon Postgres',
    description: 'External Postgres (Neon / Supabase) via Marketplace',
    accent: 'bg-sky-600',
    category: 'database',
  },
  redis: {
    kind: 'redis',
    label: 'Redis',
    defaultName: 'Cache',
    component: 'Upstash Redis',
    description: 'External Redis (Upstash) via Marketplace',
    accent: 'bg-rose-600',
    category: 'database',
  },
  queue: {
    kind: 'queue',
    label: 'Queue',
    defaultName: 'Jobs',
    component: '@vercel/queue',
    description: 'Vercel Queue (native, beta)',
    accent: 'bg-amber-600',
    category: 'messaging',
  },
  consumer: {
    kind: 'consumer',
    label: 'Consumer',
    defaultName: 'Worker',
    component: 'handleCallback',
    description: 'Queue consumer (push-mode worker)',
    accent: 'bg-violet-600',
    category: 'compute',
    props: [
      {
        key: 'maxDuration',
        label: 'Max duration (seconds)',
        type: 'number',
        placeholder: '300',
        help: 'Function timeout. Default 300s; Pro/Enterprise up to ~800s. Set in vercel.json.',
      },
    ],
  },
  cron: {
    kind: 'cron',
    label: 'Cron',
    defaultName: 'Daily',
    component: 'vercel.json crons',
    description: 'Scheduled API route (production only)',
    accent: 'bg-fuchsia-600',
    category: 'schedule',
    props: [
      {
        key: 'schedule',
        label: 'Schedule (cron)',
        type: 'text',
        default: '0 5 * * *',
        placeholder: '0 5 * * *',
        help: '5-field cron, UTC, numeric only (no MON/JAN). Hobby plan: once/day max.',
      },
    ],
  },
  webhook: {
    kind: 'webhook',
    label: 'Webhook',
    defaultName: 'Webhook',
    component: 'API route',
    description: 'Inbound webhook (Stripe or generic HMAC)',
    accent: 'bg-orange-600',
    category: 'network',
    props: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        default: 'stripe',
        options: [
          { value: 'stripe', label: 'Stripe' },
          { value: 'generic', label: 'Generic (HMAC signature)' },
        ],
        help: 'Stripe emits Stripe signature verification; Generic emits an HMAC check with a per-hook secret.',
      },
    ],
  },
  email: {
    kind: 'email',
    label: 'Email',
    defaultName: 'Mailer',
    component: 'Resend',
    description: 'Transactional email (Resend)',
    accent: 'bg-pink-600',
    category: 'config',
    props: [
      {
        key: 'from',
        label: 'From address',
        type: 'text',
        default: 'noreply@example.com',
        placeholder: 'noreply@yourdomain.com',
        help: 'Verified sender for Resend. Must be on a domain you verified.',
      },
    ],
  },
};

export const VERCEL_CATALOG_ORDER = [
  'app',
  'blob',
  'postgres',
  'redis',
  'queue',
  'consumer',
  'cron',
  'webhook',
  'email',
];
