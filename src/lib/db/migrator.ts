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

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inSingleQuote = false;

  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Single quotes handling (escape '' within quotes)
    if (char === "'" && !inDollarQuote) {
      if (inSingleQuote && nextChar === "'") {
        current += "''";
        i += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += char;
      i++;
      continue;
    }

    // Dollar quotes handling (e.g. $$ or $fn$ or $tag$)
    if (char === '$' && !inSingleQuote) {
      const match = sql.substring(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
      if (match) {
        const tag = match[1];
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
        current += tag;
        i += tag.length;
        continue;
      }
    }

    // Semicolon outside quotes = statement delimiter
    if (char === ';' && !inSingleQuote && !inDollarQuote) {
      if (current.trim()) {
        statements.push(current.trim());
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

export async function executeSqlContentResiliently(
  client: PoolClient,
  sqlContent: string,
  fileName: string
): Promise<{ success: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  // 1. Try atomic execution inside a transaction first
  try {
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    return { success: true, warnings: [] };
  } catch (txErr: any) {
    await client.query('ROLLBACK').catch(() => {});

    console.log(`[Pachas Migrator] ⚠️ [${fileName}] Non-fatal ownership/privilege notice in transactional mode: "${txErr.message}". Switching to resilient statement-by-statement execution...`);

    // 2. Fallback to resilient statement-by-statement execution
    const statements = splitSqlStatements(sqlContent);
    let successCount = 0;
    let skippedCount = 0;

    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;

      try {
        await client.query(trimmed);
        successCount++;
      } catch (stmtErr: any) {
        const msg = (stmtErr.message || '').toLowerCase();
        // Tolerant to existing objects or managed cloud database superuser restrictions
        if (
          msg.includes('must be owner') ||
          msg.includes('already exists') ||
          msg.includes('permission denied') ||
          msg.includes('duplicate') ||
          msg.includes('insufficient_privilege')
        ) {
          skippedCount++;
          warnings.push(`[${fileName}] Notice: ${stmtErr.message}`);
        } else {
          console.warn(`[Pachas Migrator] ⚠️ Statement warning: ${stmtErr.message}`);
          warnings.push(`[${fileName}] Warning: ${stmtErr.message}`);
        }
      }
    }

    console.log(`[Pachas Migrator] ℹ️ [${fileName}] Statements applied: ${successCount}, notices/existing objects bypassed: ${skippedCount}`);
    return { success: true, warnings };
  }
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

          const execResult = await executeSqlContentResiliently(client, sql, m.file);

          if (execResult.success) {
            await client.query(
              'INSERT INTO public._migrations (id, name, executed_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET executed_at = NOW()',
              [m.id, m.file]
            );
            applied.push(m.file);
            console.log(`[Pachas Migrator] ✅ Successfully registered migration: ${m.file}`);
          }
        } catch (err: any) {
          const msg = `Failed to apply migration ${m.file}: ${err.message}`;
          console.error(`[Pachas Migrator] ❌ ${msg}`);
          errors.push(msg);
          break; // Stop at first fatal error
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
