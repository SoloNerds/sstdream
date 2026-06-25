import type { Blueprint } from '@/lib/core/blueprint/types';
import type { SecurityFinding } from '@/lib/core/audit/types';

// Vercel advisory security/ops findings (verified against docs/vercel-target.md):
// public Blob is world-readable; server keys must stay off NEXT_PUBLIC_; crons run
// on public HTTP GET (need CRON_SECRET); webhooks must verify signatures; Queues are
// beta with no DLQ.
export function auditVercel(bp: Blueprint): SecurityFinding[] {
  const out: SecurityFinding[] = [];
  const byKind = (k: string) => bp.resources.filter((r) => r.kind === k);
  const has = (k: string) => bp.resources.some((r) => r.kind === k);

  for (const b of byKind('blob')) {
    if (b.props.access === 'public') {
      out.push({
        level: 'warn',
        title: `Blob "${b.name}" is public`,
        detail:
          'Public blobs are world-readable by URL. Use private access for anything user-owned or sensitive.',
        resourceId: b.id,
      });
    }
  }

  if (has('postgres') || has('redis') || has('webhook') || has('email')) {
    out.push({
      level: 'info',
      title: 'Keep server keys out of the client',
      detail:
        'DATABASE_URL, UPSTASH_* , STRIPE_SECRET_KEY and RESEND_API_KEY must stay server-only — never prefix them with NEXT_PUBLIC_ (that inlines them into the browser bundle).',
    });
  }

  for (const c of byKind('cron')) {
    out.push({
      level: 'info',
      title: `Cron "${c.name}" runs on a public URL`,
      detail:
        'Vercel triggers crons via public HTTP GET — the generated route checks Authorization: Bearer ${CRON_SECRET}. Keep that check and set CRON_SECRET.',
      resourceId: c.id,
    });
  }

  for (const w of byKind('webhook')) {
    out.push({
      level: 'info',
      title: `Webhook "${w.name}" must verify signatures`,
      detail:
        'The generated route verifies the provider signature before trusting the payload. Never remove that check — webhook URLs are public.',
      resourceId: w.id,
    });
  }

  if (has('queue')) {
    out.push({
      level: 'info',
      title: 'Vercel Queues is beta',
      detail:
        'experimentalTriggers / queue/v2beta will change before GA, and there is no built-in DLQ — make consumers idempotent and handle poison messages in the retry path. Re-verify each release.',
    });
  }

  return out;
}
