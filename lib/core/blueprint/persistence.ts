import { serializeBlueprint, parseBlueprint } from './serialize';
import type { Blueprint } from './types';

const STORAGE_KEY = 'sstdream.blueprint.v1';

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function saveBlueprint(bp: Blueprint): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeBlueprint(bp));
  } catch {
    // storage full / disabled — non-fatal for an autosave
  }
}

export function loadBlueprint(): Blueprint | null {
  if (!hasStorage()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return parseBlueprint(raw);
  } catch {
    return null;
  }
}

export function clearBlueprint(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
