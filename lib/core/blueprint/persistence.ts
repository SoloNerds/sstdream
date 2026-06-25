import { serializeBlueprint, parseBlueprint } from './serialize';
import type { Blueprint } from './types';

const STORAGE_KEY = 'sstdream.blueprint.v1';
export const RECOVERY_KEY = `${STORAGE_KEY}.recovery`;

/**
 * Result of loading the persisted blueprint. Callers must distinguish
 * "nothing stored" from "stored but unreadable": the ~400ms autosave will
 * overwrite the primary slot, so an unreadable blob is copied to
 * {@link RECOVERY_KEY} before this returns.
 */
export type LoadBlueprintResult =
  | { status: 'empty' }
  | { status: 'loaded'; blueprint: Blueprint }
  | { status: 'unreadable'; recoveryKey: string };

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

export function loadBlueprint(): LoadBlueprintResult {
  if (!hasStorage()) return { status: 'empty' };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { status: 'empty' };
  try {
    return { status: 'loaded', blueprint: parseBlueprint(raw) };
  } catch {
    // Preserve the raw blob BEFORE the autosave can overwrite the primary
    // slot, so a parse/validation failure never destroys the user's design.
    try {
      window.localStorage.setItem(RECOVERY_KEY, raw);
    } catch {
      // storage full / disabled — nothing more we can do
    }
    return { status: 'unreadable', recoveryKey: RECOVERY_KEY };
  }
}

export function clearBlueprint(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
