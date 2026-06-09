'use client';

import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget } from '@/lib/targets/registry';
import { getTemplates } from '@/lib/templates/registry';
import type { TemplateMeta } from '@/lib/templates/types';
import { Button } from '@/components/ui/button';

export function TemplatePicker({ onClose }: { onClose: () => void }) {
  const targetId = useCanvasStore((s) => s.targetId);
  const setApp = useCanvasStore((s) => s.setApp);
  const loadSnapshot = useCanvasStore((s) => s.loadSnapshot);
  const templates = getTemplates(targetId);

  const pick = (t: TemplateMeta) => {
    setApp(t.app);
    loadSnapshot(t.snapshot);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] w-[min(900px,92vw)] flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
          <div className="text-sm font-semibold">
            Templates <span className="text-neutral-400">— {getTarget(targetId).label}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => pick(t)}
              className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-3 text-left transition-colors hover:border-indigo-500 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t.name}</span>
                <span className="text-[11px] text-neutral-400">
                  {t.snapshot.nodes.length} resources
                </span>
              </div>
              <p className="text-xs text-neutral-500">{t.description}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {t.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
