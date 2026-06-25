'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget } from '@/lib/targets/registry';
import { parseAwsConfig } from '@/lib/targets/aws-sst-v4/reverse';
import { Button } from '@/components/ui/button';
import { useDialog } from './useDialog';

// Reverse-engineer: paste an existing sst.config.ts and draw it back out as a design.
// AWS-only for now (the parser targets sst.aws.* components).
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const targetId = useCanvasStore((s) => s.targetId);
  const loadSnapshot = useCanvasStore((s) => s.loadSnapshot);
  const dialogRef = useDialog<HTMLDivElement>(onClose);
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supported = targetId === 'aws-sst-v4';

  const doImport = () => {
    setError(null);
    let result: ReturnType<typeof parseAwsConfig>;
    try {
      result = parseAwsConfig(source);
    } catch {
      setError('Could not parse that file. Paste a full sst.config.ts.');
      return;
    }
    if (result.nodes.length === 0) {
      setError('No sst.aws.* resources found. Paste a full sst.config.ts.');
      return;
    }
    if (
      useCanvasStore.getState().nodes.length > 0 &&
      !window.confirm('Importing replaces the current canvas. Continue?')
    ) {
      return;
    }
    loadSnapshot(result);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Import a config"
        tabIndex={-1}
        className="flex max-h-[82vh] w-[min(760px,92vw)] flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl outline-none dark:border-neutral-700 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
          <div className="text-sm font-semibold">
            Import from code <span className="text-neutral-400">— {getTarget(targetId).label}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {supported ? (
          <div className="flex flex-col gap-3 overflow-y-auto p-4">
            <p className="text-xs text-neutral-500">
              Paste an existing <code>sst.config.ts</code> and we&apos;ll draw it back out as an
              editable design — resources become nodes, <code>link:</code> arrays become edges.
              Auto-infra (Vpc, Cluster) is folded in; env-only integrations (Stripe, Mongo)
              can&apos;t be recovered from code.
            </p>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              placeholder={
                '/// <reference path="./.sst/platform/config.d.ts" />\nexport default $config({ ... })'
              }
              className="h-72 w-full resize-none rounded-md border border-neutral-300 bg-neutral-50 p-3 font-mono text-xs outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={doImport} disabled={!source.trim()}>
                Import design
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-sm text-neutral-500">
            Code import currently supports the <strong>AWS / SST</strong> lane. Switch the target to
            SST to paste an <code>sst.config.ts</code>.
          </div>
        )}
      </div>
    </div>
  );
}
