'use client';

import { useMemo, useState } from 'react';
import { useCanvasStore } from '@/lib/canvas/store';
import { canvasToBlueprint } from '@/lib/core/blueprint/serialize';
import { generateFiles } from '@/lib/core/codegen/generate';
import type { GeneratedFile } from '@/lib/core/codegen/types';
import { Button } from '@/components/ui/button';

export function CodePreview({ onClose }: { onClose: () => void }) {
  const files = useMemo<GeneratedFile[]>(() => {
    const s = useCanvasStore.getState();
    try {
      const bp = canvasToBlueprint(
        { nodes: s.nodes, edges: s.edges },
        s.targetId,
        s.app,
        '1970-01-01T00:00:00.000Z',
      );
      return generateFiles(bp);
    } catch (err) {
      return [{ path: 'error', content: (err as Error).message, language: 'text' }];
    }
  }, []);

  const [active, setActive] = useState(0);
  const file = files[active] ?? files[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[min(960px,92vw)] flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
          <div className="flex flex-wrap gap-1">
            {files.map((f, i) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setActive(i)}
                className={`rounded px-2 py-1 font-mono text-xs ${
                  i === active
                    ? 'bg-neutral-200 dark:bg-neutral-800'
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                }`}
              >
                {f.path}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard?.writeText(file.content)}
            >
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto bg-neutral-50 p-4 font-mono text-xs leading-relaxed dark:bg-neutral-900">
          <code>{file.content}</code>
        </pre>
      </div>
    </div>
  );
}
