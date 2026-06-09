'use client';

import { useMemo, type ReactNode } from 'react';
import { useCanvasStore } from '@/lib/canvas/store';
import { canvasToBlueprint } from '@/lib/core/blueprint/serialize';
import { getTarget } from '@/lib/targets/registry';
import { expandInfra } from '@/lib/core/expansion/expand';
import { estimateCost } from '@/lib/core/cost/estimate';
import { auditInfra } from '@/lib/core/audit/audit';
import type { InfraGroup } from '@/lib/core/expansion/types';
import type { SecurityFinding } from '@/lib/core/audit/types';

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--canvas)] p-8 text-center text-sm text-neutral-500">
      {children}
    </div>
  );
}

function FindingRow({ f }: { f: SecurityFinding }) {
  const warn = f.level === 'warn';
  return (
    <li className="flex items-start gap-2 px-3 py-2">
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
          warn
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400'
        }`}
      >
        {warn ? 'warn' : 'info'}
      </span>
      <div className="min-w-0">
        <div className="text-xs font-medium">{f.title}</div>
        <div className="text-[11px] text-neutral-500">{f.detail}</div>
      </div>
    </li>
  );
}

function GroupCard({
  group,
  accent,
  label,
  cost,
}: {
  group: InfraGroup;
  accent?: string;
  label: string;
  cost?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div
        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-semibold text-white ${accent ?? 'bg-neutral-600'}`}
      >
        <span className="truncate">
          {group.title} <span className="font-normal opacity-80">· {label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {typeof cost === 'number' && cost > 0 && (
            <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
              ~${cost.toFixed(2)}/mo
            </span>
          )}
          <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
            {group.resources.length}
          </span>
        </span>
      </div>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {group.resources.map((r, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 px-3 py-1.5 ${r.conditional ? 'opacity-60' : ''}`}
          >
            <span className="mt-0.5 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {r.service}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-xs">
                <span className="truncate">{r.name}</span>
                {r.paid && (
                  <span title="Costs money" className="text-[10px] text-amber-600">
                    $
                  </span>
                )}
                {r.security && (
                  <span title="Security-relevant (IAM / SG / public access / secret)">🔒</span>
                )}
              </div>
              {r.note && <div className="text-[10px] text-neutral-500">{r.note}</div>}
              {r.conditional && (
                <div className="text-[10px] text-amber-600">only if {r.conditional}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InfraView() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const targetId = useCanvasStore((s) => s.targetId);
  const app = useCanvasStore((s) => s.app);

  const data = useMemo(() => {
    try {
      const bp = canvasToBlueprint({ nodes, edges }, targetId, app, '1970-01-01T00:00:00.000Z');
      return {
        groups: expandInfra(bp),
        cost: estimateCost(bp),
        findings: auditInfra(bp),
      };
    } catch {
      return null;
    }
  }, [nodes, edges, targetId, app]);

  if (targetId !== 'aws-sst-v4') {
    return <Empty>Infrastructure view is AWS-only for now.</Empty>;
  }
  if (!data || !data.groups.length) {
    return <Empty>Add resources on the Design view to see what actually gets deployed.</Empty>;
  }

  const { groups, cost, findings } = data;
  const catalog = getTarget(targetId).catalog;
  const total = groups.reduce((n, g) => n + g.resources.length, 0);
  const costById = new Map(cost.perResource.map((r) => [r.resourceId, r.monthlyUsd]));
  const warns = findings.filter((f) => f.level === 'warn').length;

  return (
    <div className="h-full w-full overflow-auto bg-[var(--canvas)] p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">What actually gets deployed</h2>
            <p className="text-sm text-neutral-500">
              {groups.length} node{groups.length === 1 ? '' : 's'} expand to{' '}
              <strong className="text-neutral-700 dark:text-neutral-200">{total}</strong> AWS
              resources ·{' '}
              <strong className="text-neutral-700 dark:text-neutral-200">
                ~${cost.totalMonthlyUsd.toFixed(2)}/mo
              </strong>
              . Derived from a verified SST v4 map — read-only. Live graph:{' '}
              <code className="text-[11px]">sst diff</code>.
            </p>
          </div>
          <div className="flex gap-3 text-[11px] text-neutral-500">
            <span>
              <span className="text-amber-600">$</span> costs money
            </span>
            <span>🔒 security</span>
            <span className="opacity-60">dimmed = conditional</span>
          </div>
        </div>

        {findings.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="border-b border-neutral-200 px-3 py-1.5 text-xs font-semibold dark:border-neutral-800">
              Security &amp; ops
              {warns > 0 && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  {warns} to review
                </span>
              )}
            </div>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {findings.map((f, i) => (
                <FindingRow key={i} f={f} />
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              accent={catalog[g.kind]?.accent}
              label={catalog[g.kind]?.label ?? 'shared infra'}
              cost={costById.get(g.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
