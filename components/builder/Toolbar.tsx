'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExportDialog } from './ExportDialog';
import { useCanvasStore } from '@/lib/canvas/store';
import { isTargetImplemented } from '@/lib/targets/registry';
import {
  blueprintToCanvas,
  canvasToBlueprint,
  parseBlueprint,
} from '@/lib/core/blueprint/serialize';
import { buildShareUrl } from '@/lib/core/blueprint/share';
import { TemplatePicker } from './TemplatePicker';
import { ImportDialog } from './ImportDialog';
import type { ValidationResult } from '@/lib/core/validation/types';

export function Toolbar({ validation }: { validation: ValidationResult }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [importingCode, setImportingCode] = useState(false);
  const [shared, setShared] = useState(false);
  const targetId = useCanvasStore((s) => s.targetId);
  const appName = useCanvasStore((s) => s.app.name);
  const setApp = useCanvasStore((s) => s.setApp);
  const loadSnapshot = useCanvasStore((s) => s.loadSnapshot);
  const reset = useCanvasStore((s) => s.reset);

  const onShare = () => {
    const s = useCanvasStore.getState();
    try {
      const bp = canvasToBlueprint(
        { nodes: s.nodes, edges: s.edges, secrets: s.secrets, outputs: s.outputs },
        s.targetId,
        s.app,
        new Date().toISOString(),
      );
      const url = buildShareUrl(window.location.origin, bp);
      void navigator.clipboard?.writeText(url);
      // Reflect it in the address bar so a manual copy / bookmark works too.
      window.history.replaceState(null, '', url);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      alert('Finish editing the app name before sharing.');
    }
  };

  const onImportFile = async (file: File) => {
    try {
      const bp = parseBlueprint(await file.text());
      if (!isTargetImplemented(bp.target.deploy)) {
        alert(`The "${bp.target.deploy}" lane is not implemented yet.`);
        return;
      }
      if (
        useCanvasStore.getState().nodes.length > 0 &&
        !window.confirm('Importing replaces the current canvas. Continue?')
      ) {
        return;
      }
      useCanvasStore.setState({ targetId: bp.target.deploy });
      setApp({ name: bp.app.name, region: bp.app.region, packageManager: bp.app.packageManager });
      loadSnapshot(blueprintToCanvas(bp));
    } catch (err) {
      alert(`Could not import design: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          aria-label="App name"
          className="w-44 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
          value={appName}
          onChange={(e) => setApp({ name: e.target.value })}
          placeholder="app-name"
        />
        <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
          Templates
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          Import
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setImportingCode(true)}
          title={
            targetId === 'vercel'
              ? 'Reverse-engineer: paste a package.json / vercel.json and draw it back out'
              : 'Reverse-engineer: paste an sst.config.ts and draw it back out'
          }
        >
          From code
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onShare}
          title="Copy a shareable link to this design (secret values are stripped)"
        >
          {shared ? 'Copied — no secrets' : 'Share'}
        </Button>
        <Button
          size="sm"
          onClick={() => setExporting(true)}
          disabled={!validation.ok}
          title={
            validation.ok
              ? 'Export the SST project'
              : `Fix ${validation.errors.length} error(s) to export`
          }
        >
          Export
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (
              useCanvasStore.getState().nodes.length > 0 &&
              !window.confirm('Clear the canvas? This removes every node and connection.')
            ) {
              return;
            }
            reset();
          }}
        >
          Clear
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImportFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      {picking && <TemplatePicker onClose={() => setPicking(false)} />}
      {importingCode && <ImportDialog onClose={() => setImportingCode(false)} />}
    </>
  );
}
