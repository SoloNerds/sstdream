'use client';

import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget } from '@/lib/targets/registry';

const DRAG_MIME = 'application/sstdream-kind';

export function Palette() {
  const targetId = useCanvasStore((s) => s.targetId);
  const target = getTarget(targetId);

  return (
    <div className="flex flex-col gap-2 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Resources</h2>
      {target.catalogOrder.map((kind) => {
        const meta = target.catalog[kind];
        return (
          <div
            key={kind}
            draggable
            onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, kind)}
            className="cursor-grab rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:border-neutral-400 active:cursor-grabbing dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-sm ${meta.accent}`} />
              <span className="font-medium">{meta.label}</span>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-neutral-400">{meta.component}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{meta.description}</p>
          </div>
        );
      })}
      <p className="mt-2 text-xs text-neutral-400">Drag a resource onto the canvas.</p>
    </div>
  );
}

export { DRAG_MIME };
