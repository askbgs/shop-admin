import 'server-only';
import { pool } from './db';
import { MIGRATION_SQL } from './migrations';

const g = globalThis as unknown as { shopMigration?: Promise<void> };

// Runs the idempotent migration once per server process, under an advisory lock
// so two instances starting together don't race.
export function ensureSchema(): Promise<void> {
  if (!g.shopMigration) {
    g.shopMigration = (async () => {
      const client = await pool().connect();
      try {
        await client.query('SELECT pg_advisory_lock(842001)');
        await client.query('BEGIN');
        await client.query(MIGRATION_SQL);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        g.shopMigration = undefined;
        throw e;
      } finally {
        await client.query('SELECT pg_advisory_unlock(842001)').catch(() => {});
        client.release();
      }
    })();
  }
  return g.shopMigration;
}
