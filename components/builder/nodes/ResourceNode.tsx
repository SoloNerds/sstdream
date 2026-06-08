'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget } from '@/lib/targets/registry';

export function ResourceNode({ data, selected }: NodeProps) {
  const targetId = useCanvasStore((s) => s.targetId);
  const d = data as { name?: string; kind?: string; cost?: number };
  const meta = d.kind ? getTarget(targetId).catalog[d.kind] : undefined;

  return (
    <div
      className={`min-w-36 rounded-md border bg-white shadow-sm dark:bg-neutral-900 ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/40'
          : 'border-neutral-300 dark:border-neutral-700'
      }`}
    >
      <div
        className={`flex items-center justify-between rounded-t-md px-3 py-1 text-xs font-semibold text-white ${meta?.accent ?? 'bg-neutral-700'}`}
      >
        <span>{meta?.label ?? d.kind ?? 'node'}</span>
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-medium">{d.name ?? ''}</div>
        <div className="font-mono text-[10px] text-neutral-400">{meta?.component}</div>
        {typeof d.cost === 'number' && d.cost > 0 && (
          <div className="mt-0.5 text-[10px] text-neutral-500">~${d.cost.toFixed(2)}/mo</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
