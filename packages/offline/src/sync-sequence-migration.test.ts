import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIDIRECTIONAL_SYNC_REGISTRY, LOCAL_ONLY_TABLES } from './sync-registry';

const migration = readFileSync(
  new URL('../../../supabase/migrations/0019_sync_sequence.sql', import.meta.url),
  'utf8',
);

describe('commit-ordered server sequence migration coverage', () => {
  it('adds a sequence column, owner index, and trigger mapping for every sync table', () => {
    expect(BIDIRECTIONAL_SYNC_REGISTRY).toHaveLength(26);

    for (const spec of BIDIRECTIONAL_SYNC_REGISTRY) {
      expect(migration).toContain(
        `alter table public.${spec.table} add column server_seq bigint`,
      );
      expect(migration).toContain(`('${spec.table}', '${spec.ownerColumn}')`);
    }

    expect(migration).toContain("v_table || '_owner_server_seq_uidx'");
    expect(migration).toContain("'a_kayamo_assign_server_seq'");
  });

  it('does not assign server sequences to local-only records', () => {
    for (const table of LOCAL_ONLY_TABLES) {
      expect(migration).not.toContain(
        `alter table public.${table} add column server_seq`,
      );
    }
  });

  it('keeps timestamp metadata while declaring sequence ordering authoritative', () => {
    expect(migration).toContain('server_updated_at remains a diagnostic timestamp');
    expect(migration).toContain('server_seq is the only');
  });
});
