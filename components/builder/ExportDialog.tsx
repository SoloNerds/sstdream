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

const ROOT_ORDER = [
  'README.md',
  'AGENTS.md',
  'sst.config.ts',
  'package.json',
  'tsconfig.json',
  'next.config.ts',
  '.env.example',
  '.gitignore',
  'package.additions.json',
  'required-env.json',
  'sstdream.design.json',
];
const FOLDER_ORDER = ['app', 'lib', 'src'];

type Group = { label: string; items: { path: string; index: number }[] };

// Group the export into "project root" + top-level folders, ordered for scannability.
function groupFiles(files: GeneratedFile[]): Group[] {
  const withIndex = files.map((f, index) => ({ path: f.path, index }));
  const rank = (arr: string[], v: string) => (arr.indexOf(v) === -1 ? 99 : arr.indexOf(v));

  const root = withIndex
    .filter((f) => !f.path.includes('/'))
    .sort(
      (a, b) => rank(ROOT_ORDER, a.path) - rank(ROOT_ORDER, b.path) || a.path.localeCompare(b.path),
    );

  const folders = new Map<string, { path: string; index: number }[]>();
  for (const f of withIndex.filter((f) => f.path.includes('/'))) {
    const seg = f.path.slice(0, f.path.indexOf('/'));
    (folders.get(seg) ?? folders.set(seg, []).get(seg)!).push(f);
  }

  const groups: Group[] = [];
  if (root.length) groups.push({ label: 'project root', items: root });
  for (const key of [...folders.keys()].sort(
    (a, b) => rank(FOLDER_ORDER, a) - rank(FOLDER_ORDER, b) || a.localeCompare(b),
  )) {
    groups.push({
      label: `${key}/`,
      items: folders.get(key)!.sort((a, b) => a.path.localeCompare(b.path)),
    });
  }
  return groups;
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const appName = useCanvasStore((s) => s.app.name) || 'app';

  const files = useMemo<GeneratedFile[]>(() => {
    const s = useCanvasStore.getState();
    try {
      const bp = canvasToBlueprint(
        { nodes: s.nodes, edges: s.edges, secrets: s.secrets, outputs: s.outputs },
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
  const groups = useMemo(() => groupFiles(files), [files]);

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
          <div className="w-64 shrink-0 overflow-y-auto border-r border-neutral-200 py-1 text-xs dark:border-neutral-800">
            {groups.map((g) => (
              <div key={g.label} className="mb-1">
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  {g.label}
                </div>
                <ul>
                  {g.items.map(({ path, index }) => (
                    <li key={path}>
                      <button
                        type="button"
                        onClick={() => setActive(index)}
                        className={`block w-full truncate px-3 py-1 pl-4 text-left font-mono ${
                          index === active
                            ? 'bg-neutral-200 dark:bg-neutral-800'
                            : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                        }`}
                      >
                        {path.includes('/') ? path.slice(path.indexOf('/') + 1) : path}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
