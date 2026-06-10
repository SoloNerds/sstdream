import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveBlueprint, loadBlueprint, clearBlueprint, RECOVERY_KEY } from './persistence';
import { createEmptyBlueprint, serializeBlueprint } from './serialize';

const STORAGE_KEY = 'sstdream.blueprint.v1';

function makeLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    _store: store,
  };
}

let storage: ReturnType<typeof makeLocalStorageMock>;

beforeEach(() => {
  storage = makeLocalStorageMock();
  vi.stubGlobal('window', { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const validBlueprint = () =>
  createEmptyBlueprint(
    'aws-sst-v4',
    { name: 'my-app', packageManager: 'yarn', region: 'us-east-1' },
    '2026-06-10T00:00:00.000Z',
  );

describe('loadBlueprint', () => {
  it('returns empty when no environment storage exists', () => {
    vi.unstubAllGlobals();
    expect(loadBlueprint()).toEqual({ status: 'empty' });
  });

  it('returns empty when nothing is stored', () => {
    expect(loadBlueprint()).toEqual({ status: 'empty' });
    expect(storage._store.has(RECOVERY_KEY)).toBe(false);
  });

  it('loads a valid stored blueprint', () => {
    const bp = validBlueprint();
    storage.setItem(STORAGE_KEY, serializeBlueprint(bp));
    const result = loadBlueprint();
    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.blueprint.app.name).toBe('my-app');
      expect(result.blueprint.target.deploy).toBe('aws-sst-v4');
    }
    expect(storage._store.has(RECOVERY_KEY)).toBe(false);
  });

  it('preserves corrupt JSON under the recovery key and signals failure', () => {
    storage.setItem(STORAGE_KEY, '{not json');
    const result = loadBlueprint();
    expect(result).toEqual({ status: 'unreadable', recoveryKey: RECOVERY_KEY });
    expect(storage.getItem(RECOVERY_KEY)).toBe('{not json');
    // the primary slot is untouched by the load itself
    expect(storage.getItem(STORAGE_KEY)).toBe('{not json');
  });

  it('preserves schema-invalid blueprints under the recovery key and signals failure', () => {
    const futureBlob = JSON.stringify({ version: '99.0.0', resources: [] });
    storage.setItem(STORAGE_KEY, futureBlob);
    const result = loadBlueprint();
    expect(result).toEqual({ status: 'unreadable', recoveryKey: RECOVERY_KEY });
    expect(storage.getItem(RECOVERY_KEY)).toBe(futureBlob);
  });

  it('still signals failure when writing the recovery copy throws', () => {
    storage.setItem(STORAGE_KEY, '{not json');
    storage.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(loadBlueprint()).toEqual({ status: 'unreadable', recoveryKey: RECOVERY_KEY });
  });
});

describe('saveBlueprint / clearBlueprint', () => {
  it('round-trips through save and load', () => {
    saveBlueprint(validBlueprint());
    const result = loadBlueprint();
    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') expect(result.blueprint).toEqual(validBlueprint());
  });

  it('clear removes the stored blueprint', () => {
    saveBlueprint(validBlueprint());
    clearBlueprint();
    expect(loadBlueprint()).toEqual({ status: 'empty' });
  });

  it('swallows storage errors on save', () => {
    storage.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(() => saveBlueprint(validBlueprint())).not.toThrow();
  });
});
