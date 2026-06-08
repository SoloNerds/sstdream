import { BLUEPRINT_VERSION, BlueprintSchema } from './schema';
import type { Blueprint } from './types';

// Versioned migration pipeline. For 0.1.0 it is identity, but the structure is in
// place so future schema changes can up-migrate older exported designs in order.
type Migration = (input: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<string, Migration> = {
  // '0.1.0': (bp) => ({ ...bp, version: '0.2.0', /* transform */ }),
};

const ORDER = ['0.1.0'];

export class BlueprintMigrationError extends Error {}

/**
 * Coerce an unknown parsed object into the current Blueprint, running any
 * intermediate migrations and validating the result.
 */
export function migrateBlueprint(raw: unknown): Blueprint {
  if (typeof raw !== 'object' || raw === null) {
    throw new BlueprintMigrationError('Blueprint must be a JSON object.');
  }
  let current = raw as Record<string, unknown>;
  const version = typeof current.version === 'string' ? current.version : undefined;
  if (!version) {
    throw new BlueprintMigrationError('Blueprint is missing a "version" field.');
  }

  let idx = ORDER.indexOf(version);
  if (idx === -1) {
    throw new BlueprintMigrationError(
      `Unknown blueprint version "${version}". This file may come from a newer SSTDREAM.`,
    );
  }

  while (current.version !== BLUEPRINT_VERSION) {
    const v = current.version as string;
    const migrate = MIGRATIONS[v];
    if (!migrate) {
      throw new BlueprintMigrationError(`No migration path from version "${v}".`);
    }
    current = migrate(current);
    idx += 1;
    if (idx > ORDER.length) {
      throw new BlueprintMigrationError('Migration loop did not converge.');
    }
  }

  return BlueprintSchema.parse(current);
}
