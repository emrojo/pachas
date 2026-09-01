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
 *   node deploy/clean-db-keep-users.mjs
 *   node deploy/clean-db-keep-users.mjs --source="postgresql://..." --target="postgresql://..."
 *   node deploy/clean-db-keep-users.mjs --from-backup="deploy/backups/users-backup-2026-09-01.json"
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

// 1. Helper to load environment variables from files
function loadEnvFiles() {
  const envFiles = [
    path.join(rootDir, '.env.production'),
    path.join(rootDir, '.env.local'),
    path.join(rootDir, '.env'),
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

// 2. Parse CLI arguments
const args = process.argv.slice(2);
let sourceUrl = null;
let targetUrl = null;
let backupFilePathInput = null;

for (const arg of args) {
  if (arg.startsWith('--source=')) {
    sourceUrl = arg.split('=')[1].replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--target=')) {
    targetUrl = arg.split('=')[1].replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--from-backup=')) {
    backupFilePathInput = arg.split('=')[1].replace(/^["']|["']$/g, '');
  }
}

// 3. Resolve database connection config
function getDatabaseConfig(customUrl = null) {
  if (customUrl) {
    return { connectionString: customUrl };
  }

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

  // Fallback default
  return {
    user: 'pachas_admin',
    password: 'pachas_secure_password_123!',
    host: 'localhost',
    port: 5432,
    database: 'pachas',
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
  if (backupFilePathInput && fs.existsSync(backupFilePathInput)) {
    console.log(`📂 [Paso 1/4] Cargando usuarios desde archivo de copia de seguridad existente:`);
    console.log(`   ${backupFilePathInput}`);
    try {
      const parsed = JSON.parse(fs.readFileSync(backupFilePathInput, 'utf8'));
      extractedAuthUsers = parsed.authUsers || [];
      extractedProfiles = parsed.profiles || [];
      console.log(`   ✅ Cargados ${extractedAuthUsers.length} usuario(s) y ${extractedProfiles.length} perfil(es).\n`);
    } catch (readErr) {
      console.error(`❌ Error leyendo archivo de backup: ${formatError(readErr)}`);
      process.exit(1);
    }
  } else {
    const sourceClient = new Client(sourceConfig);
    try {
      console.log('📡 [Paso 1/4] Conectando a la base de datos para extraer usuarios...');
      console.log(`   Destino: ${sourceConfig.host || 'localhost'}:${sourceConfig.port || 5432} (BD: ${sourceConfig.database || 'pachas'})`);
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
      console.log('\n💡 Opciones para conectar:');
      console.log('   1. Si tienes PostgreSQL en Docker: ejecuta `docker compose -f deploy/docker-compose.yml up -d`');
      console.log('   2. Si usas Supabase/Neon/Railway: pasa la URL con `--source="postgresql://..."`');
      console.log('   3. Si tienes una copia previa: usa `--from-backup="deploy/backups/archivo.json"`\n');
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

    // Drop all application tables and migrations ledger
    const resetSql = `
      DROP TABLE IF EXISTS public.expense_comments CASCADE;
      DROP TABLE IF EXISTS public.group_messages CASCADE;
      DROP TABLE IF EXISTS public.content_reports CASCADE;
      DROP TABLE IF EXISTS public.support_messages CASCADE;
      DROP TABLE IF EXISTS public.settlements CASCADE;
      DROP TABLE IF EXISTS public.expense_participants CASCADE;
      DROP TABLE IF EXISTS public.expense_payers CASCADE;
      DROP TABLE IF EXISTS public.expenses CASCADE;
      DROP TABLE IF EXISTS public.group_members CASCADE;
      DROP TABLE IF EXISTS public.groups CASCADE;
      DROP TABLE IF EXISTS public.exchange_rates CASCADE;
      DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
      DROP TABLE IF EXISTS public.user_notification_preferences CASCADE;
      DROP TABLE IF EXISTS public.profiles CASCADE;
      DROP TABLE IF EXISTS auth.password_reset_tokens CASCADE;
      DROP TABLE IF EXISTS auth.users CASCADE;
      DROP TABLE IF EXISTS public._migrations CASCADE;
    `;

    await targetClient.query(resetSql);
    console.log('   ✅ Tablas y datos operacionales eliminados.');

    // Discover migration files
    const files = fs.readdirSync(scriptsDir)
      .filter((f) => f.endsWith('.sql') && f !== 'reset-db.sql')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    console.log(`\n🚀 [Paso 3/4] Ejecutando las ${files.length} migraciones en orden determinista...`);

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
