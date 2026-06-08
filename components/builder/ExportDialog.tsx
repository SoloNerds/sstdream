'use client';

import { useMemo, useState } from 'react';
import { useCanvasStore } from '@/lib/canvas/store';
import { canvasToBlueprint } from '@/lib/core/blueprint/serialize';
import { buildExport } from '@/lib/core/export/manifest';
import { zipFiles } from '@/lib/core/export/zip';
import type { GeneratedFile } from '@/lib/core/codegen/types';
import { Button } from '@/components/ui/button';

function downloadBlob(name: string, data: Uint8Array | string, type: string) {
  const part: BlobPart = typeof data === 'string' ? data : new Uint8Array(data);
  const blob = new Blob([part], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const appName = useCanvasStore((s) => s.app.name) || 'app';

  const files = useMemo<GeneratedFile[]>(() => {
    const s = useCanvasStore.getState();
    try {
      const bp = canvasToBlueprint(
        { nodes: s.nodes, edges: s.edges },
        s.targetId,
        s.app,
        new Date().toISOString(),
      );
      return buildExport(bp);
    } catch (err) {
      return [{ path: 'error', content: (err as Error).message, language: 'text' }];
    }
  }, []);

  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const file = files[active] ?? files[0];

  const copy = async () => {
    await navigator.clipboard?.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[82vh] w-[min(1040px,94vw)] flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
          <div className="text-sm font-semibold">
            Export <span className="text-neutral-400">— {appName}</span>
            <span className="ml-2 text-xs font-normal text-neutral-400">{files.length} files</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                downloadBlob(`${appName}-sst-export.zip`, zipFiles(files), 'application/zip')
              }
            >
              Download ZIP
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <ul className="w-60 shrink-0 overflow-y-auto border-r border-neutral-200 py-1 text-xs dark:border-neutral-800">
            {files.map((f, i) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={`block w-full truncate px-3 py-1 text-left font-mono ${
                    i === active
                      ? 'bg-neutral-200 dark:bg-neutral-800'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  {f.path}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-1 dark:border-neutral-800">
              <span className="font-mono text-xs text-neutral-500">{file.path}</span>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="flex-1 overflow-auto bg-neutral-50 p-4 font-mono text-xs leading-relaxed dark:bg-neutral-900">
              <code>{file.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
