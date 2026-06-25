import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { CostBreakdown, CostEstimate, CostLine } from '@/lib/core/cost/types';

// Vercel cost model — a rough monthly SIGNPOST, not a forecast. Vercel pricing is
// plan + usage based, and external DB/Redis bill on their own plans, so most lines
// are honest $0 placeholders with a note rather than fabricated precision.

const round2 = (n: number) => Math.round(n * 100) / 100;

function breakdownFor(r: Resource): CostBreakdown {
  let lines: CostLine[] = [];
  switch (r.kind) {
    case 'app':
      lines = [
        { label: 'Plan base (Pro $20; Hobby is $0 for personal use)', usd: 20 },
        { label: 'Functions + bandwidth (included tier)', usd: 0 },
      ];
      break;
    case 'blob':
      lines = [
        { label: 'Blob storage (~5GB @ $0.023/GB)', usd: round2(5 * 0.023) },
        { label: 'Blob operations (included tier)', usd: 0 },
      ];
      break;
    case 'postgres':
      lines = [{ label: 'Neon Postgres (external — free tier → ~$19+)', usd: 0 }];
      break;
    case 'redis':
      lines = [{ label: 'Upstash Redis (external — free tier → usage)', usd: 0 }];
      break;
    case 'queue':
      lines = [{ label: 'Vercel Queue (beta — usage-based)', usd: 0 }];
      break;
    case 'consumer':
      lines = [{ label: 'Consumer function (included compute)', usd: 0 }];
      break;
    case 'cron':
      lines = [{ label: 'Cron Jobs (free)', usd: 0 }];
      break;
    case 'webhook':
      lines = [{ label: 'Webhook function (included compute)', usd: 0 }];
      break;
    case 'email':
      lines = [{ label: 'Resend (free tier → usage)', usd: 0 }];
      break;
    default:
      lines = [];
  }
  const monthlyUsd = round2(lines.reduce((sum, l) => sum + l.usd, 0));
  return { resourceId: r.id, name: r.name, kind: r.kind, monthlyUsd, lines };
}

export function estimateVercelCost(bp: Blueprint): CostEstimate {
  const perResource = bp.resources.map(breakdownFor);
  const totalMonthlyUsd = round2(perResource.reduce((sum, r) => sum + r.monthlyUsd, 0));
  return {
    perResource,
    totalMonthlyUsd,
    region: bp.app.region,
    assumptions: [
      'Vercel Pro plan base $20/mo (Hobby is $0 for personal, non-commercial projects)',
      'Blob: ~5GB storage at $0.023/GB',
      'External Postgres (Neon) and Redis (Upstash) bill on THEIR plans — shown as $0 here',
      'Queues (beta), Cron, and Resend are usage-based / free-tier — shown as $0',
    ],
    disclaimer:
      'Very rough design-time signpost. Vercel is plan + usage based and external DB/Redis bill separately — check vercel.com/pricing and each provider for real numbers.',
  };
}
