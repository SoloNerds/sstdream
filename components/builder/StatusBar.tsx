'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/lib/canvas/store';
import type { Diagnostic, ValidationResult } from '@/lib/core/validation/types';

const toneClass: Record<Diagnostic['severity'], string> = {
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-sky-600',
};

export function StatusBar({ validation }: { validation: ValidationResult }) {
  const [open, setOpen] = useState(false);
  const select = useCanvasStore((s) => s.select);
  const { errors, warnings, diagnostics } = validation;

  const summary =
    errors.length > 0
      ? `${errors.length} error${errors.length > 1 ? 's' : ''} block export`
      : warnings.length > 0
        ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`
        : 'Ready to export';
  const summaryTone =
    errors.length > 0
      ? 'text-red-600'
      : warnings.length > 0
        ? 'text-amber-600'
        : 'text-emerald-600';

  return (
    <div className="border-t border-neutral-200 bg-white text-xs dark:border-neutral-800 dark:bg-neutral-950">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-1.5"
      >
        <span className={summaryTone}>● {summary}</span>
        {errors.length > 0 && warnings.length > 0 && (
          <span className="text-amber-600">+{warnings.length} warning(s)</span>
        )}
        <span className="ml-auto text-neutral-400">
          {diagnostics.length > 0 ? (open ? 'hide details' : 'show details') : ''}
        </span>
      </button>
      {open && diagnostics.length > 0 && (
        <ul className="max-h-44 overflow-y-auto px-4 pb-2">
          {diagnostics.map((d, i) => (
            <li
              key={`${d.rule}-${i}`}
              onClick={() => d.resourceId && select(d.resourceId)}
              className={`flex flex-wrap gap-x-2 py-0.5 ${d.resourceId ? 'cursor-pointer hover:underline' : ''}`}
            >
              <span className={`font-medium uppercase ${toneClass[d.severity]}`}>{d.severity}</span>
              <span>{d.message}</span>
              {d.hint && <span className="text-neutral-400">— {d.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
