'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget } from '@/lib/targets/registry';
import { parseAwsConfig, type ReverseResult } from '@/lib/targets/aws-sst-v4/reverse';
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
  const [report, setReport] = useState<ReverseResult | null>(null);

  const supported = targetId === 'aws-sst-v4';

  const load = (result: ReverseResult) => {
    if (
      useCanvasStore.getState().nodes.length > 0 &&
      !window.confirm('Importing replaces the current canvas. Continue?')
    ) {
      return;
    }
    loadSnapshot(result);
    onClose();
  };

  const doImport = () => {
    setError(null);
    let result: ReverseResult;
    try {
      result = parseAwsConfig(source);
    } catch {
      setError('Could not parse that file. Paste a full sst.config.ts.');
      return;
    }
    if (result.nodes.length === 0) {
      setError(
        result.unrecognized.length
          ? `Found ${result.unrecognized.length} resource(s) but couldn't model any of them — see below. Paste a full sst.config.ts.`
          : 'No sst.aws.* resources found. Paste a full sst.config.ts.',
      );
      if (result.unrecognized.length) setReport(result);
      return;
    }
    // Recovered something. If anything was unmodeled, show an honest report first.
    if (result.unrecognized.length) setReport(result);
    else load(result);
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
              onChange={(e) => {
                setSource(e.target.value);
                setReport(null);
                setError(null);
              }}
              spellCheck={false}
              placeholder={
                '/// <reference path="./.sst/platform/config.d.ts" />\nexport default $config({ ... })'
              }
              className="h-72 w-full resize-none rounded-md border border-neutral-300 bg-neutral-50 p-3 font-mono text-xs outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}

            {report && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Recovered {report.nodes.length} resource{report.nodes.length === 1 ? '' : 's'} ·{' '}
                  {report.unrecognized.length} not understood
                </div>
                <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  These lines weren&apos;t turned into nodes — the rest imported fine. Add them by
                  hand after importing:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {report.unrecognized.map((u, i) => (
                    <li key={i} className="text-[11px]">
                      <code className="text-amber-900 dark:text-amber-200">{u.snippet}</code>
                      <span className="text-neutral-500"> — {u.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              {report && report.nodes.length > 0 ? (
                <Button size="sm" onClick={() => load(report)}>
                  Import {report.nodes.length} recovered anyway
                </Button>
              ) : (
                <Button size="sm" onClick={doImport} disabled={!source.trim()}>
                  Import design
                </Button>
              )}
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
