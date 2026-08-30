import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';

export interface MigrationRecord {
  id: string;
  name: string;
  file: string;
  isApplied: boolean;
  executedAt?: string;
}

const DEFAULT_SCRIPTS_DIR = path.resolve(process.cwd(), 'deploy', 'init-scripts');

export async function ensureMigrationsTable(client: Pool | PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public._migrations (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);
}

export function getMigrationFiles(scriptsDir: string = DEFAULT_SCRIPTS_DIR): { id: string; file: string; fullPath: string }[] {
  if (!fs.existsSync(scriptsDir)) {
    return [];
  }

  return fs.readdirSync(scriptsDir)
    .filter(f => f.endsWith('.sql') && f !== 'reset-db.sql')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(file => ({
      id: file.replace(/\.sql$/, ''),
      file,
      fullPath: path.join(scriptsDir, file),
    }));
}

export async function getMigrationStatus(pool: Pool, scriptsDir: string = DEFAULT_SCRIPTS_DIR): Promise<MigrationRecord[]> {
  await ensureMigrationsTable(pool);
  const res = await pool.query('SELECT id, name, executed_at FROM public._migrations ORDER BY id ASC');
  const executedMap = new Map<string, { executed_at: string }>();
  for (const row of res.rows) {
    executedMap.set(row.id, row);
  }

  const files = getMigrationFiles(scriptsDir);
  return files.map(m => {
    const executed = executedMap.get(m.id);
    return {
      id: m.id,
      name: m.file,
      file: m.file,
      isApplied: Boolean(executed),
      executedAt: executed?.executed_at,
    };
  });
}

let migrationsInProgress: Promise<{ applied: string[]; errors: string[] }> | null = null;

export async function runPendingMigrations(
  pool: Pool,
  scriptsDir: string = DEFAULT_SCRIPTS_DIR
): Promise<{ applied: string[]; errors: string[] }> {
  if (migrationsInProgress) {
    return migrationsInProgress;
  }

  migrationsInProgress = (async () => {
    const applied: string[] = [];
    const errors: string[] = [];

    const client = await pool.connect();
    try {
      await ensureMigrationsTable(client);

      const res = await client.query('SELECT id FROM public._migrations');
      const executedSet = new Set(res.rows.map(r => r.id));

      const files = getMigrationFiles(scriptsDir);
      const pending = files.filter(f => !executedSet.has(f.id));

      for (const m of pending) {
        try {
          const sql = fs.readFileSync(m.fullPath, 'utf8');

          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            'INSERT INTO public._migrations (id, name, executed_at) VALUES ($1, $2, NOW())',
            [m.id, m.file]
          );
          await client.query('COMMIT');

          applied.push(m.file);
          console.log(`[Pachas Migrator] ✅ Applied migration: ${m.file}`);
        } catch (err: any) {
          await client.query('ROLLBACK').catch(() => {});
          const msg = `Failed to apply migration ${m.file}: ${err.message}`;
          console.error(`[Pachas Migrator] ❌ ${msg}`);
          errors.push(msg);
          break; // Stop at first failing migration
        }
      }
    } catch (err: any) {
      console.error('[Pachas Migrator] Connection or initialization error:', err.message);
      errors.push(err.message);
    } finally {
      client.release();
      migrationsInProgress = null;
    }

    return { applied, errors };
  })();

  return migrationsInProgress;
}
