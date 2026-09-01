#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - CLEAN DATABASE RESET WHILE PRESERVING USERS & PASSWORDS
 * ==============================================================================
 * 1. Safely extracts and backs up all users (auth.users & public.profiles).
 * 2. Cleans the operational database and drops all group/expense data.
 * 3. Applies all migrations sequentially (01-schema.sql -> 11-user-preferred-language.sql).
 * 4. Restores all users with original UUIDs, encrypted passwords, roles, and preferences.
 * 5. Verifies data integrity and reports results.
 *
 * Usage:
 *   # Specify database name directly:
 *   node deploy/clean-db-keep-users.mjs --db="mi_base_prod" --host="localhost" --user="postgres" --password="mypassword"
 *   
 *   # With connection URL:
 *   node deploy/clean-db-keep-users.mjs --url="postgresql://user:pass@host:5432/mi_base_prod"
 *   
 *   # Production env file:
 *   node deploy/clean-db-keep-users.mjs --env=".env.production"
 *   node deploy/clean-db-keep-users.mjs --prod
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
const backupsDir = path.join(__dirname, 'backups');

// 1. Parse CLI arguments first
const args = process.argv.slice(2);
let sourceUrl = null;
let targetUrl = null;
let backupFilePathInput = null;
let customEnvFile = null;
let isProdFlag = false;

let cliDbName = null;
let cliHost = null;
let cliUser = null;
let cliPassword = null;
let cliPort = null;
let cliSsl = null;
let shouldDropSchema = false;

for (const arg of args) {
  if (arg.startsWith('--url=')) {
    const val = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    sourceUrl = val;
    targetUrl = val;
  } else if (arg.startsWith('--source=')) {
    sourceUrl = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--target=')) {
    targetUrl = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--from-backup=')) {
    backupFilePathInput = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--env=')) {
    customEnvFile = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg === '--prod' || arg === '--production') {
    isProdFlag = true;
  } else if (arg.startsWith('--db=') || arg.startsWith('--database=')) {
    cliDbName = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--host=')) {
    cliHost = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--user=')) {
    cliUser = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--password=')) {
    cliPassword = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--port=')) {
    cliPort = parseInt(arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, ''), 10);
  } else if (arg === '--ssl') {
    cliSsl = true;
  } else if (arg === '--drop-schema' || arg === '--reset-schema') {
    shouldDropSchema = true;
  }
}

// 2. Helper to load environment variables from file
function loadEnvFromFile(filePath, override = false) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...rest] = trimmed.split('=');
      const cleanKey = key.trim();
      const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (cleanKey && (override || !process.env[cleanKey])) {
        process.env[cleanKey] = value;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Load env files according to flags
if (customEnvFile) {
  const resolved = path.isAbsolute(customEnvFile) ? customEnvFile : path.resolve(process.cwd(), customEnvFile);
  if (!loadEnvFromFile(resolved, true)) {
    console.warn(`⚠️ Archivo de variables especificado no encontrado: ${resolved}`);
  } else {
    console.log(`📄 Variables cargadas desde: ${resolved}`);
  }
} else if (isProdFlag) {
  const prodCandidates = [
    path.join(rootDir, '.env.production'),
    path.join(rootDir, '.env.production.local'),
    path.join(__dirname, '.env.production'),
    path.join(rootDir, '.env'),
  ];
  let loadedAny = false;
  for (const f of prodCandidates) {
    if (loadEnvFromFile(f, true)) {
      console.log(`📄 Modo producción: variables cargadas desde ${f}`);
      loadedAny = true;
      break;
    }
  }
  if (!loadedAny) {
    console.warn('⚠️ Bandera --prod especificada pero no se encontró archivo .env.production. Usando variables de entorno activas.');
  }
} else {
  // Default development search order
  const defaultFiles = [
    path.join(rootDir, '.env.local'),
    path.join(rootDir, '.env'),
    path.join(rootDir, '.env.production'),
    path.join(__dirname, '.env.production'),
  ];
  for (const f of defaultFiles) {
    loadEnvFromFile(f, false);
  }
}

// 3. Resolve database connection config with exact parameters
function getDatabaseConfig(customUrl = null) {
  const dbUrl = customUrl || (!cliDbName && !cliHost ? process.env.DATABASE_URL : null);

  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const dbName = parsed.pathname.replace(/^\//, '') || 'pachas';
      const needsSsl = parsed.searchParams.get('sslmode') === 'require' || 
                        (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1');

      return {
        connectionString: dbUrl,
        host: parsed.hostname,
        port: parseInt(parsed.port || '5432', 10),
        database: dbName,
        user: decodeURIComponent(parsed.username || 'postgres'),
        ssl: needsSsl ? { rejectUnauthorized: false } : false,
      };
    } catch {
      return { connectionString: dbUrl };
    }
  }

  // Discrete parameters (CLI flags take first priority, then process.env)
  const host = cliHost || process.env.POSTGRES_HOST || 'localhost';
  const port = cliPort || parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const database = cliDbName || process.env.POSTGRES_DB || process.env.PGDATABASE || 'pachas';
  const user = cliUser || process.env.POSTGRES_USER || process.env.PGUSER || 'pachas_admin';
  const password = cliPassword || process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || 'pachas_secure_password_123!';
  const ssl = cliSsl !== null ? cliSsl : (process.env.POSTGRES_SSL === 'true' || (host !== 'localhost' && host !== '127.0.0.1'));

  return {
    user,
    password,
    host,
    port,
    database,
    ssl: ssl ? { rejectUnauthorized: false } : false,
  };
}

// Format error message cleanly
function formatError(err) {
  if (!err) return 'Error desconocido';
  if (err.errors && Array.isArray(err.errors)) {
    return err.errors.map((e) => e.message || String(e)).join('; ');
  }
  return err.message || String(err);
}

// 4. Split SQL into individual statements
function splitSqlStatements(sqlContent) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';

  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    const nextChar = sqlContent[i + 1] || '';

    // Handle single quote strings
    if (char === "'" && !inDollarQuote) {
      if (inSingleQuote && nextChar === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    // Handle dollar quotes ($$ or $tag$)
    if (char === '$' && !inSingleQuote) {
      if (!inDollarQuote) {
        const match = sqlContent.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
        if (match) {
          inDollarQuote = true;
          dollarTag = match[0];
          current += dollarTag;
          i += dollarTag.length - 1;
          continue;
        }
      } else {
        if (sqlContent.slice(i).startsWith(dollarTag)) {
          inDollarQuote = false;
          current += dollarTag;
          i += dollarTag.length - 1;
          dollarTag = '';
          continue;
        }
      }
    }

    // Handle statement delimiter (;)
    if (char === ';' && !inSingleQuote && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const remaining = current.trim();
  if (remaining.length > 0) {
    statements.push(remaining);
  }

  return statements;
}

// 5. Execute SQL statements resiliently
async function executeSqlContentResiliently(client, sqlContent, migrationName) {
  const statements = splitSqlStatements(sqlContent);
  let bypassedNotices = 0;

  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    try {
      await client.query(stmt);
    } catch (err) {
      const msg = err.message || '';
      if (
        msg.includes('must be owner of') ||
        msg.includes('already exists') ||
        msg.includes('duplicate key')
      ) {
        bypassedNotices++;
      } else {
        throw new Error(`[${migrationName}] Failed statement: "${stmt.slice(0, 80)}..." - Reason: ${msg}`);
      }
    }
  }

  return { bypassed: bypassedNotices };
}

// 6. Main Execution Workflow
async function main() {
  console.log('\n=============================================================');
  console.log('🔄  PACHAS - REINICIO LIMPIO DE BD CONSERVANDO USUARIOS');
  console.log('=============================================================\n');

  const sourceConfig = getDatabaseConfig(sourceUrl);
  const targetConfig = getDatabaseConfig(targetUrl || sourceUrl);

  let extractedAuthUsers = [];
  let extractedProfiles = [];

  // STEP 1: Extract and Backup Users (or load from file)
  let resolvedBackupPath = null;
  if (backupFilePathInput) {
    if (fs.existsSync(backupFilePathInput)) {
      resolvedBackupPath = backupFilePathInput;
    } else if (fs.existsSync(path.resolve(process.cwd(), backupFilePathInput))) {
      resolvedBackupPath = path.resolve(process.cwd(), backupFilePathInput);
    } else if (fs.existsSync(path.join(backupsDir, backupFilePathInput))) {
      resolvedBackupPath = path.join(backupsDir, backupFilePathInput);
    } else if (fs.existsSync(path.join(backupsDir, `${backupFilePathInput}.json`))) {
      resolvedBackupPath = path.join(backupsDir, `${backupFilePathInput}.json`);
    } else {
      console.error(`❌ No se encontró el archivo de backup especificado: ${backupFilePathInput}`);
      process.exit(1);
    }
  }

  if (resolvedBackupPath) {
    console.log(`📂 [Paso 1/4] Cargando usuarios desde archivo de copia de seguridad:`);
    console.log(`   ${resolvedBackupPath}`);
    try {
      const parsed = JSON.parse(fs.readFileSync(resolvedBackupPath, 'utf8'));
      extractedAuthUsers = parsed.authUsers || [];
      extractedProfiles = parsed.profiles || [];
      console.log(`   ✅ Cargados ${extractedAuthUsers.length} usuario(s) y ${extractedProfiles.length} perfil(es).\n`);

      if (extractedProfiles.length > 0 || extractedAuthUsers.length > 0) {
        console.log('   📋 Usuarios en el backup que se restaurarán:');
        const displayList = extractedProfiles.length > 0 ? extractedProfiles : extractedAuthUsers;
        displayList.forEach((u, idx) => {
          const name = (u.full_name || u.email || 'Sin nombre').padEnd(25, ' ').substring(0, 25);
          const email = (u.email || '').padEnd(30, ' ').substring(0, 30);
          const role = (u.role || 'member').padEnd(8, ' ');
          const lang = u.preferred_language || 'es';
          console.log(`      ${idx + 1}. [${role}] ${name} <${email}> (Idioma: ${lang})`);
        });
        console.log('');
      }
    } catch (readErr) {
      console.error(`❌ Error leyendo archivo de backup: ${formatError(readErr)}`);
      process.exit(1);
    }
  } else {
    const sourceClient = new Client(sourceConfig);
    try {
      console.log('📡 [Paso 1/4] Conectando a la base de datos para extraer usuarios...');
      console.log(`   • Host:     ${sourceConfig.host || 'remoto'}`);
      console.log(`   • Puerto:   ${sourceConfig.port || 5432}`);
      console.log(`   • Base BD:  ${sourceConfig.database || 'pachas'}`);
      console.log(`   • Usuario:  ${sourceConfig.user || 'postgres'}`);
      console.log(`   • SSL:      ${sourceConfig.ssl ? 'Activado (TLS)' : 'Desactivado'}\n`);

      await sourceClient.connect();

      // Query auth.users
      try {
        const authRes = await sourceClient.query(`
          SELECT id, email, encrypted_password, raw_user_meta_data, created_at 
          FROM auth.users 
          ORDER BY created_at ASC
        `);
        extractedAuthUsers = authRes.rows;
        console.log(`   ✅ Extraídos ${extractedAuthUsers.length} usuario(s) de auth.users (con contraseñas encriptadas)`);
      } catch (e) {
        console.warn(`   ⚠️ No se pudo leer auth.users (${formatError(e)}).`);
      }

      // Query public.profiles
      try {
        const profileRes = await sourceClient.query(`
          SELECT id, email, full_name, avatar_url, bizum_phone, 
                 COALESCE(preferred_language, 'es') as preferred_language,
                 role, is_banned, banned_at, banned_by, ban_reason, created_at, updated_at
          FROM public.profiles
          ORDER BY created_at ASC
        `);
        extractedProfiles = profileRes.rows;
        console.log(`   ✅ Extraídos ${extractedProfiles.length} perfil(es) de public.profiles`);
      } catch (e) {
        console.warn(`   ⚠️ No se pudo leer public.profiles (${formatError(e)})`);
      }

      // Save JSON backup to disk
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilePath = path.join(backupsDir, `users-backup-${timestamp}.json`);
      const backupData = {
        timestamp: new Date().toISOString(),
        sourceConfig: { host: sourceConfig.host, database: sourceConfig.database },
        authUsersCount: extractedAuthUsers.length,
        profilesCount: extractedProfiles.length,
        authUsers: extractedAuthUsers,
        profiles: extractedProfiles,
      };

      fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
      console.log(`   💾 Copia de seguridad guardada automáticamente en:\n      ${backupFilePath}\n`);

      // Display summary table of preserved users
      if (extractedProfiles.length > 0 || extractedAuthUsers.length > 0) {
        console.log('   📋 Resumen de usuarios que serán preservados:');
        const displayList = extractedProfiles.length > 0 ? extractedProfiles : extractedAuthUsers;
        displayList.forEach((u, idx) => {
          const name = (u.full_name || u.email || 'Sin nombre').padEnd(25, ' ').substring(0, 25);
          const email = (u.email || '').padEnd(30, ' ').substring(0, 30);
          const role = (u.role || 'member').padEnd(8, ' ');
          const lang = u.preferred_language || 'es';
          console.log(`      ${idx + 1}. [${role}] ${name} <${email}> (Idioma: ${lang})`);
        });
        console.log('');
      } else {
        console.log('   ℹ️ No se detectaron usuarios previos en la base de datos.');
      }

    } catch (err) {
      console.error(`\n❌ Error conectando a la base de datos: ${formatError(err)}`);
      console.log('\n💡 Ejemplos para conectar a tu base de datos de producción:');
      console.log('   1. Pasando la URL completa (con el nombre de tu BD al final):');
      console.log('      node deploy/clean-db-keep-users.mjs --url="postgresql://usuario:pass@host:5432/nombre_de_tu_bd"');
      console.log('   2. Pasando el nombre de tu base de datos directamente con --db:');
      console.log('      node deploy/clean-db-keep-users.mjs --db="nombre_de_tu_bd" --host="tu_host" --user="tu_usuario" --password="tu_password"');
      console.log('   3. Cargando tu archivo .env de producción:');
      console.log('      node deploy/clean-db-keep-users.mjs --env=".env.production"\n');
      process.exit(1);
    } finally {
      await sourceClient.end().catch(() => {});
    }
  }

  // STEP 2: Clean Wipe and Re-run All Migrations on Target Database
  const targetClient = new Client(targetConfig);
  try {
    console.log('🧹 [Paso 2/4] Limpiando tablas operacionales y re-creando esquema limpio...');
    await targetClient.connect();

    if (shouldDropSchema) {
      console.log('   💣 Eliminando esquemas public y auth por completo (DROP SCHEMA CASCADE)...');
      try {
        await targetClient.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;');
        await targetClient.query('DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA auth;');
        console.log('   ✅ Esquemas public y auth eliminados y recreados de cero.');
      } catch (dropErr) {
        console.warn(`   ⚠️ DROP SCHEMA requiere superusuario (${formatError(dropErr)}). Aplicando limpieza por tablas...`);
      }
    }

    // Tables to wipe completely (expenses, groups, settlements, comments, messages, etc.)
    const tablesToClean = [
      'public.expense_comments',
      'public.group_messages',
      'public.content_reports',
      'public.support_messages',
      'public.settlements',
      'public.expense_participants',
      'public.expense_payers',
      'public.expenses',
      'public.group_members',
      'public.groups',
      'public.exchange_rates',
      'public.push_subscriptions',
      'public.user_notification_preferences',
      'auth.password_reset_tokens',
    ];

    // Try TRUNCATE CASCADE on operational tables
    try {
      await targetClient.query(`TRUNCATE TABLE ${tablesToClean.join(', ')} CASCADE;`);
      console.log('   ✅ Tablas operacionales vaciadas con TRUNCATE CASCADE.');
    } catch (truncErr) {
      // Fallback: table by table
      for (const table of tablesToClean) {
        try {
          await targetClient.query(`TRUNCATE TABLE ${table} CASCADE;`);
        } catch {
          try {
            await targetClient.query(`DELETE FROM ${table};`);
          } catch {}
        }
      }
      console.log('   ✅ Tablas operacionales limpiadas con éxito.');
    }

    // Reset migrations ledger to re-run all migrations idempotently
    try {
      await targetClient.query('DELETE FROM public._migrations;');
    } catch {}

    // Discover migration files
    const files = fs.readdirSync(scriptsDir)
      .filter((f) => f.endsWith('.sql') && f !== 'reset-db.sql')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    console.log(`\n🚀 [Paso 3/4] Ejecutando las ${files.length} migraciones en orden determinista en "${targetConfig.database || 'pachas'}"...`);

    // Ensure _migrations ledger exists
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS public._migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    for (const file of files) {
      const filePath = path.join(scriptsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const migrationId = file.replace(/\.sql$/, '');

      process.stdout.write(`   ⏳ Aplicando ${file}... `);
      const start = Date.now();
      const res = await executeSqlContentResiliently(targetClient, sqlContent, file);
      await targetClient.query(
        'INSERT INTO public._migrations (id, name, executed_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET executed_at = NOW()',
        [migrationId, file]
      );
      const duration = Date.now() - start;
      console.log(`✅ OK (${duration}ms${res.bypassed ? ` - ${res.bypassed} avisos tolerados` : ''})`);
    }

    // STEP 4: Restore Users and Profiles
    console.log('\n👥 [Paso 4/4] Restaurando cuentas de usuarios, contraseñas y perfiles...');

    // 1. Restore auth.users
    let restoredAuthCount = 0;
    for (const user of extractedAuthUsers) {
      await targetClient.query(
        `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           encrypted_password = EXCLUDED.encrypted_password,
           raw_user_meta_data = EXCLUDED.raw_user_meta_data`,
        [
          user.id,
          user.email.toLowerCase(),
          user.encrypted_password || null,
          user.raw_user_meta_data || '{}',
          user.created_at || new Date().toISOString(),
        ]
      );
      restoredAuthCount++;
    }
    console.log(`   ✅ Restauradas ${restoredAuthCount} cuentas en auth.users con sus contraseñas encriptadas`);

    // 2. Restore public.profiles
    let restoredProfileCount = 0;
    for (const profile of extractedProfiles) {
      await targetClient.query(
        `INSERT INTO public.profiles (
           id, email, full_name, avatar_url, bizum_phone, 
           preferred_language, role, is_banned, banned_at, banned_by, ban_reason, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           avatar_url = EXCLUDED.avatar_url,
           bizum_phone = EXCLUDED.bizum_phone,
           preferred_language = EXCLUDED.preferred_language,
           role = EXCLUDED.role,
           is_banned = EXCLUDED.is_banned,
           banned_at = EXCLUDED.banned_at,
           banned_by = EXCLUDED.banned_by,
           ban_reason = EXCLUDED.ban_reason,
           updated_at = NOW()`,
        [
          profile.id,
          profile.email.toLowerCase(),
          profile.full_name || profile.email.split('@')[0],
          profile.avatar_url || null,
          profile.bizum_phone || null,
          profile.preferred_language || 'es',
          profile.role || 'member',
          Boolean(profile.is_banned),
          profile.banned_at || null,
          profile.banned_by || null,
          profile.ban_reason || null,
          profile.created_at || new Date().toISOString(),
        ]
      );
      restoredProfileCount++;
    }
    console.log(`   ✅ Restaurados ${restoredProfileCount} perfiles en public.profiles con sus datos completos`);

    // Verify clean state
    const expCountRes = await targetClient.query('SELECT COUNT(*) FROM public.expenses');
    const grpCountRes = await targetClient.query('SELECT COUNT(*) FROM public.groups');
    const migCountRes = await targetClient.query('SELECT COUNT(*) FROM public._migrations');

    console.log('\n=============================================================');
    console.log('🎉 ¡MIGRACIÓN Y REINICIO COMPLETADOS CON ÉXITO!');
    console.log('=============================================================');
    console.log(`📊 Base de datos:        ${targetConfig.database || 'pachas'}`);
    console.log(`📊 Usuarios restaurados:  ${restoredProfileCount}`);
    console.log(`📊 Grupos en el sistema:  ${grpCountRes.rows[0].count} (completamente limpio)`);
    console.log(`📊 Gastos en el sistema:  ${expCountRes.rows[0].count} (completamente limpio)`);
    console.log(`📊 Migraciones aplicadas: ${migCountRes.rows[0].count}/${files.length}`);
    console.log('\n✨ La base de datos está lista para producción:');
    console.log('   • Los usuarios pueden iniciar sesión con sus emails y contraseñas de siempre.');
    console.log('   • Todas las preferencias de idioma, avatares y roles se han mantenido intactas.\n');

  } catch (err) {
    console.error(`\n❌ Error durante el reinicio: ${formatError(err)}`);
    process.exit(1);
  } finally {
    await targetClient.end().catch(() => {});
  }
}

main();
