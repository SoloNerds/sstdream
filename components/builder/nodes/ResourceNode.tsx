'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_CATALOG } from '@/lib/canvas/catalog';
import type { NodeKind } from '@/lib/canvas/types';

export function ResourceNode({ data, selected }: NodeProps) {
  const d = data as { label?: string; kind?: NodeKind };
  const meta = d.kind ? NODE_CATALOG[d.kind] : undefined;
  return (
    <div
      className={`min-w-32 rounded-md border bg-white shadow-sm dark:bg-neutral-900 ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/40'
          : 'border-neutral-300 dark:border-neutral-700'
      }`}
    >
      <div
        className={`rounded-t-md px-3 py-1 text-xs font-semibold text-white ${meta?.accent ?? 'bg-neutral-700'}`}
      >
        {meta?.label ?? d.kind ?? 'node'}
      </div>
      <div className="px-3 py-2 text-sm">{d.label ?? ''}</div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
