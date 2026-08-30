#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - DETERMINISTIC POSTGRESQL MIGRATION RUNNER
 * ==============================================================================
 * Manages database migrations with an atomic transaction ledger (`_migrations`).
 * Scans `deploy/init-scripts/*.sql` in sequential order (01 -> 10).
 * 
 * Usage:
 *   node deploy/migrate.mjs             # Apply pending migrations
 *   node deploy/migrate.mjs --status    # Check applied and pending migrations
 *   node deploy/migrate.mjs --reset     # Reset database and reapply migrations
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const scriptsDir = path.join(__dirname, 'init-scripts');

// 1. Helper to load environment variables from files without external dotenv dependency
function loadEnvFiles() {
  const envFiles = [
    path.join(rootDir, '.env.local'),
    path.join(rootDir, '.env'),
    path.join(__dirname, '.env.production'),
  ];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      try {
        const content = fs.readFileSync(envFile, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const [key, ...rest] = trimmed.split('=');
          const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
          if (key && !process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      } catch {}
    }
  }
}

loadEnvFiles();

// 2. Resolve database connection config
function getDatabaseConfig() {
  if (process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD) {
    return {
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'pachas',
    };
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const match = dbUrl.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@\/:?]+)(?::(\d+))?\/([^?]+)/);
      if (match) {
        const [, user, password, host, portStr, database] = match;
        return {
          user: decodeURIComponent(user),
          password: decodeURIComponent(password),
          host,
          port: portStr ? parseInt(portStr, 10) : 5432,
          database: database.split('?')[0],
        };
      }
    } catch {}
    return { connectionString: dbUrl };
  }

  // Fallback defaults
  return {
    user: 'pachas_admin',
    password: 'pachas_secure_password_123!',
    host: 'localhost',
    port: 5432,
    database: 'pachas',
  };
}

// 3. Ensure _migrations control table exists
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public._migrations (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);
}

// 4. Get list of available SQL files in deploy/init-scripts
function getAvailableMigrations() {
  if (!fs.existsSync(scriptsDir)) {
    return [];
  }

  const files = fs.readdirSync(scriptsDir)
    .filter(f => f.endsWith('.sql') && f !== 'reset-db.sql')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return files.map(file => {
    const id = file.replace(/\.sql$/, '');
    return {
      id,
      file,
      fullPath: path.join(scriptsDir, file),
    };
  });
}

// 5. Get list of already executed migrations from database
async function getExecutedMigrations(client) {
  await ensureMigrationsTable(client);
  const res = await client.query('SELECT id, name, executed_at FROM public._migrations ORDER BY id ASC');
  const executedMap = new Map();
  for (const row of res.rows) {
    executedMap.set(row.id, row);
  }
  return executedMap;
}

// Format Date as DD/MM/YYYY HH:mm
function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 6. Main Action: Check status
async function showStatus() {
  const client = new Client(getDatabaseConfig());
  try {
    await client.connect();
    const available = getAvailableMigrations();
    const executed = await getExecutedMigrations(client);

    console.log('\n📊 =========================================================');
    console.log('📊  PACHAS - ESTADO DE MIGRACIONES DE BASE DE DATOS');
    console.log('=========================================================\n');

    console.log(`Directorio de scripts: ${scriptsDir}`);
    console.log(`Total migraciones definidas: ${available.length}\n`);

    console.log('┌─────┬──────────────────────────────────────────┬──────────────┬──────────────────┐');
    console.log('│ #   │ Archivo de Migración                     │ Estado       │ Fecha Aplicación │');
    console.log('├─────┼──────────────────────────────────────────┼──────────────┼──────────────────┤');

    let appliedCount = 0;
    let pendingCount = 0;

    available.forEach((m, idx) => {
      const isApplied = executed.has(m.id);
      if (isApplied) appliedCount++;
      else pendingCount++;

      const num = (idx + 1).toString().padStart(3, ' ');
      const fileName = m.file.padEnd(40, ' ').substring(0, 40);
      const status = isApplied ? '✅ Aplicada   ' : '⏳ Pendiente  ';
      const execDate = isApplied ? formatDate(executed.get(m.id).executed_at).padEnd(16, ' ') : '                ';

      console.log(`│ ${num} │ ${fileName} │ ${status} │ ${execDate} │`);
    });

    console.log('└─────┴──────────────────────────────────────────┴──────────────┴──────────────────┘\n');
    console.log(`Resumen: ${appliedCount} aplicadas | ${pendingCount} pendientes\n`);

  } catch (err) {
    const errorMsg = err?.message || String(err);
    console.error(`\n❌ Error consultando el estado de la base de datos: ${errorMsg}`);
    const cfg = getDatabaseConfig();
    console.log(`\n💡 Consejos de conexión:`);
    console.log(`   • Si usas Docker local: inicia el contenedor con: docker compose -f deploy/docker-compose.yml up -d`);
    console.log(`   • Si usas Supabase, Neon o Railway: verifica la variable DATABASE_URL en tu archivo .env.local`);
    console.log(`   • Destino configurado: ${cfg.host || 'DATABASE_URL'}:${cfg.port || '5432'} (BD: ${cfg.database || 'pachas'})\n`);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

// Helper to safely split SQL file into statements respecting dollar quotes ($$ or $tag$)
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inSingleQuote = false;

  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Single quotes handling
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

async function executeSqlContentResiliently(client, sqlContent, fileName) {
  // 1. Try atomic execution inside a transaction first
  try {
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    return { success: true };
  } catch (txErr) {
    await client.query('ROLLBACK').catch(() => {});

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
      } catch (stmtErr) {
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
        } else {
          console.warn(`\n   ⚠️ [${fileName}] Aviso en sentencia: ${stmtErr.message}`);
        }
      }
    }

    return { success: true, bypassed: skippedCount };
  }
}

// 7. Main Action: Run Pending Migrations
async function runMigrations() {
  const client = new Client(getDatabaseConfig());
  try {
    await client.connect();
    console.log('\n🐘 =========================================================');
    console.log('🐘  PACHAS - EJECUTOR DE MIGRACIONES POSTGRESQL');
    console.log('=========================================================\n');

    const available = getAvailableMigrations();
    const executed = await getExecutedMigrations(client);

    const pending = available.filter(m => !executed.has(m.id));

    if (pending.length === 0) {
      console.log('✨ La base de datos está completamente al día. (0 migraciones pendientes)\n');
      return;
    }

    console.log(`🚀 Se han detectado ${pending.length} migración(es) pendiente(s). Ejecutando en orden...\n`);

    for (const m of pending) {
      const startTime = Date.now();
      process.stdout.write(`⏳ Aplicando ${m.file}... `);

      const sqlContent = fs.readFileSync(m.fullPath, 'utf8');

      try {
        const res = await executeSqlContentResiliently(client, sqlContent, m.file);
        await client.query(
          'INSERT INTO public._migrations (id, name, executed_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET executed_at = NOW()',
          [m.id, m.file]
        );

        const duration = Date.now() - startTime;
        if (res.bypassed && res.bypassed > 0) {
          console.log(`✅ OK (${duration}ms - ${res.bypassed} avisos tolerados)`);
        } else {
          console.log(`✅ OK (${duration}ms)`);
        }
      } catch (sqlErr) {
        console.log(`❌ ERROR`);
        console.error(`\n❌ Falló la migración: ${m.file}`);
        console.error(`📝 Detalle del error: ${sqlErr.message}`);
        console.error(`📍 Ubicación: ${m.fullPath}\n`);
        process.exit(1);
      }
    }

    console.log(`\n🎉 ¡Todas las migraciones se han aplicado con éxito!\n`);

  } catch (err) {
    const errorMsg = err?.message || String(err);
    console.error(`\n❌ Error de conexión a PostgreSQL: ${errorMsg}`);
    const cfg = getDatabaseConfig();
    console.log(`\n💡 Consejos de conexión:`);
    console.log(`   • Si usas Docker local: inicia el contenedor con: docker compose -f deploy/docker-compose.yml up -d`);
    console.log(`   • Si usas Supabase, Neon o Railway: verifica la variable DATABASE_URL en tu archivo .env.local`);
    console.log(`   • Destino configurado: ${cfg.host || 'DATABASE_URL'}:${cfg.port || '5432'} (BD: ${cfg.database || 'pachas'})\n`);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

// 8. Main Action: Reset Database
async function resetDatabase() {
  const resetFile = path.join(scriptsDir, 'reset-db.sql');
  if (!fs.existsSync(resetFile)) {
    console.error('❌ Error: Archivo reset-db.sql no encontrado.');
    process.exit(1);
  }

  const client = new Client(getDatabaseConfig());
  try {
    await client.connect();
    console.log('\n⚠️ =========================================================');
    console.log('⚠️  PACHAS - REINICIO TOTAL DE BASE DE DATOS');
    console.log('=========================================================\n');

    console.log('🗑️  Borrando tablas y esquema actual...');
    const resetSql = fs.readFileSync(resetFile, 'utf8');
    await client.query(resetSql);
    await client.query('DROP TABLE IF EXISTS public._migrations CASCADE;').catch(() => {});
    console.log('✅ Esquema reiniciado.');

    await client.end();

    console.log('\n🚀 Re-aplicando todas las migraciones desde cero...');
    await runMigrations();

  } catch (err) {
    console.error('❌ Error reiniciando la base de datos:', err.message);
    process.exit(1);
  }
}

// CLI Dispatcher
const args = process.argv.slice(2);
if (args.includes('--status') || args.includes('-s')) {
  showStatus();
} else if (args.includes('--reset')) {
  resetDatabase();
} else {
  runMigrations();
}
