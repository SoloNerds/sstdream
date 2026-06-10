'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget } from '@/lib/targets/registry';
import type { PropField } from '@/lib/targets/types';
import type { CanvasNode } from '@/lib/canvas/types';

const inputClass =
  'w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700';

/**
 * Rows live in local draft state so empty-key rows ("+ add variable") survive
 * until the user types a key; only rows with a key are committed via onChange.
 * The parent keys this component by node id + field key, so switching nodes
 * remounts it and re-seeds the draft from the stored value.
 */
function KeyValueEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const [rows, setRows] = useState<[string, string][]>(() => Object.entries(value));
  const update = (next: [string, string][]) => {
    setRows(next);
    onChange(Object.fromEntries(next.filter(([k]) => k.length > 0)));
  };

  return (
    <div className="flex flex-col gap-1">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex gap-1">
          <input
            className={inputClass}
            value={k}
            placeholder="KEY"
            onChange={(e) => update(rows.map((r, idx) => (idx === i ? [e.target.value, r[1]] : r)))}
          />
          <input
            className={inputClass}
            value={v}
            placeholder="value"
            onChange={(e) => update(rows.map((r, idx) => (idx === i ? [r[0], e.target.value] : r)))}
          />
          <button
            type="button"
            className="px-1 text-neutral-400 hover:text-red-600"
            onClick={() => update(rows.filter((_, idx) => idx !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="self-start text-xs text-indigo-600 hover:underline"
        onClick={() => setRows([...rows, ['', '']])}
      >
        + add variable
      </button>
    </div>
  );
}

function Field({ field, node }: { field: PropField; node: CanvasNode }) {
  const setNodeProps = useCanvasStore((s) => s.setNodeProps);
  const set = (v: unknown) => setNodeProps(node.id, { [field.key]: v });
  const raw = node.props[field.key];

  if (field.type === 'keyvalue') {
    const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, string>;
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">{field.label}</span>
        <KeyValueEditor key={`${node.id}:${field.key}`} value={value} onChange={set} />
      </label>
    );
  }

  if (field.type === 'boolean') {
    const checked = typeof raw === 'boolean' ? raw : Boolean(field.default);
    return (
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
        <span className="text-xs text-neutral-500">{field.label}</span>
      </label>
    );
  }

  if (field.type === 'select') {
    const value = typeof raw === 'string' ? raw : String(field.default ?? '');
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">{field.label}</span>
        <select className={inputClass} value={value} onChange={(e) => set(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500">{field.label}</span>
      <input
        className={inputClass}
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        placeholder={
          field.placeholder ?? (field.default !== undefined ? String(field.default) : '')
        }
        onChange={(e) => set(field.type === 'number' ? Number(e.target.value) : e.target.value)}
      />
      {field.help && <span className="text-[11px] text-neutral-400">{field.help}</span>}
    </label>
  );
}

export function PropsForm({ node }: { node: CanvasNode }) {
  const targetId = useCanvasStore((s) => s.targetId);
  const fields = getTarget(targetId).catalog[node.kind]?.props ?? [];
  if (!fields.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wide text-neutral-500">Configuration</span>
      {fields.map((f) => (
        <Field key={f.key} field={f} node={node} />
      ))}
    </div>
  );
}
