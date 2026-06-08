'use client';

import { useCost } from './useCost';
import { useCanvasStore } from '@/lib/canvas/store';

export function CostPanel() {
  const cost = useCost();
  const select = useCanvasStore((s) => s.select);

  return (
    <div className="flex flex-col gap-2 p-3 text-xs">
      <div className="flex items-baseline justify-between">
        <span className="text-base font-semibold">~${cost.totalMonthlyUsd.toFixed(2)}/mo</span>
        <span className="text-neutral-400">{cost.region}</span>
      </div>

      {cost.perResource.length === 0 ? (
        <p className="text-neutral-500">Add resources to estimate cost.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {cost.perResource.map((r) => (
            <li
              key={r.resourceId}
              onClick={() => select(r.resourceId)}
              className="flex cursor-pointer justify-between rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              <span>
                {r.name} <span className="text-neutral-400">({r.kind})</span>
              </span>
              <span>${r.monthlyUsd.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}

      {cost.assumptions.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-neutral-500">Assumptions</summary>
          <ul className="ml-4 list-disc text-neutral-500">
            {cost.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{cost.disclaimer}</p>
    </div>
  );
}
