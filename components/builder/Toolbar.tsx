'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/lib/canvas/store';
import { isTargetImplemented } from '@/lib/targets/registry';
import {
  canvasToBlueprint,
  blueprintToCanvas,
  serializeBlueprint,
  parseBlueprint,
} from '@/lib/core/blueprint/serialize';
import { AI_PROCESSING_APP } from '@/lib/templates/ai-processing-app';

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const appName = useCanvasStore((s) => s.app.name);
  const setApp = useCanvasStore((s) => s.setApp);
  const loadSnapshot = useCanvasStore((s) => s.loadSnapshot);
  const reset = useCanvasStore((s) => s.reset);

  const onExport = () => {
    const s = useCanvasStore.getState();
    const bp = canvasToBlueprint(
      { nodes: s.nodes, edges: s.edges },
      s.targetId,
      s.app,
      new Date().toISOString(),
    );
    download('sstdream.design.json', serializeBlueprint(bp));
  };

  const onImportFile = async (file: File) => {
    try {
      const bp = parseBlueprint(await file.text());
      if (!isTargetImplemented(bp.target.deploy)) {
        alert(`The "${bp.target.deploy}" lane is not implemented yet.`);
        return;
      }
      useCanvasStore.setState({ targetId: bp.target.deploy });
      setApp({ name: bp.app.name, region: bp.app.region, packageManager: bp.app.packageManager });
      loadSnapshot(blueprintToCanvas(bp));
    } catch (err) {
      alert(`Could not import design: ${(err as Error).message}`);
    }
  };

  const onLoadTemplate = () => {
    setApp(AI_PROCESSING_APP.app);
    loadSnapshot(AI_PROCESSING_APP.snapshot);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        aria-label="App name"
        className="w-44 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
        value={appName}
        onChange={(e) => setApp({ name: e.target.value })}
        placeholder="app-name"
      />
      <Button size="sm" variant="outline" onClick={onLoadTemplate}>
        Load template
      </Button>
      <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
        Import
      </Button>
      <Button size="sm" variant="outline" onClick={onExport}>
        Export design
      </Button>
      <Button size="sm" variant="ghost" onClick={reset}>
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
  );
}
