import { zipSync, strToU8 } from 'fflate';
import type { GeneratedFile } from '@/lib/core/codegen/types';

/** Build a ZIP (Uint8Array) from generated files, optionally under a root dir. */
export function zipFiles(files: GeneratedFile[], rootDir?: string): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    const path = rootDir ? `${rootDir}/${f.path}` : f.path;
    entries[path] = strToU8(f.content);
  }
  return zipSync(entries, { level: 6 });
}
