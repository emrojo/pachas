#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - USER PASSWORD & AUTHENTICATION MANAGER CLI
 * ==============================================================================
 * Allows listing users, inspecting accounts, and setting/updating passwords
 * directly in PostgreSQL (auth.users & public.profiles).
 *
 * Usage:
 *   # List all users in the database:
 *   node deploy/set-user-password.mjs --list
 *   
 *   # Set password for a specific user:
 *   node deploy/set-user-password.mjs --email="admin@pachas.com" --password="nueva_password_123"
 *   
 *   # Specify database credentials:
 *   node deploy/set-user-password.mjs --email="admin@pachas.com" --password="123" --db="mi_bd_prod" --user="postgres" --password-db="mi_pass_db"
 *   node deploy/set-user-password.mjs --email="admin@pachas.com" --password="123" --url="postgresql://..."
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { randomBytes, pbkdf2Sync } from 'crypto';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Password hashing function
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

// 2. Load env files
function loadEnvFiles() {
  const envFiles = [
    path.join(rootDir, '.env.production'),
    path.join(rootDir, '.env.production.local'),
    path.join(__dirname, '.env.production'),
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
          const cleanKey = key.trim();
          const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
          if (cleanKey && !process.env[cleanKey]) {
            process.env[cleanKey] = value;
          }
        }
      } catch {}
    }
  }
}

loadEnvFiles();

// 3. Parse CLI args
const args = process.argv.slice(2);
let targetEmail = null;
let newPassword = null;
let shouldList = false;
let customUrl = null;
let cliDbName = null;
let cliHost = null;
let cliUser = null;
let cliDbPassword = null;
let cliPort = null;

for (const arg of args) {
  if (arg.startsWith('--email=')) {
    targetEmail = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '').trim().toLowerCase();
  } else if (arg.startsWith('--password=')) {
    newPassword = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg === '--list') {
    shouldList = true;
  } else if (arg.startsWith('--url=')) {
    customUrl = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--db=') || arg.startsWith('--database=')) {
    cliDbName = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--host=')) {
    cliHost = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--user=')) {
    cliUser = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--password-db=')) {
    cliDbPassword = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--port=')) {
    cliPort = parseInt(arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, ''), 10);
  }
}

// 4. Resolve DB config
function getDbConfig() {
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

  const host = cliHost || process.env.POSTGRES_HOST || 'localhost';
  const port = cliPort || parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const database = cliDbName || process.env.POSTGRES_DB || process.env.PGDATABASE || 'pachas';
  const user = cliUser || process.env.POSTGRES_USER || process.env.PGUSER || 'pachas_admin';
  const password = cliDbPassword || process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || 'pachas_secure_password_123!';
  const ssl = process.env.POSTGRES_SSL === 'true' || (host !== 'localhost' && host !== '127.0.0.1');

  return {
    user,
    password,
    host,
    port,
    database,
    ssl: ssl ? { rejectUnauthorized: false } : false,
  };
}

async function main() {
  console.log('\n=============================================================');
  console.log('🔐  PACHAS - GESTOR DE USUARIOS Y CONTRASEÑAS');
  console.log('=============================================================\n');

  const config = getDbConfig();
  console.log(`📡 Conectando a: ${config.host || 'remoto'}:${config.port || 5432} (BD: ${config.database || 'pachas'}) con usuario: ${config.user || 'postgres'}\n`);

  const client = new Client(config);
  try {
    await client.connect();

    // 1. List users
    const usersRes = await client.query(`
      SELECT u.id, u.email, u.encrypted_password, u.created_at,
             p.full_name, p.role, p.is_banned, p.preferred_language
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      ORDER BY u.created_at ASC
    `);

    console.log(`📊 Usuarios registrados en la base de datos (${usersRes.rows.length}):`);
    console.log('--------------------------------------------------------------------------------');
    usersRes.rows.forEach((row, i) => {
      const email = row.email.padEnd(30, ' ');
      const name = (row.full_name || 'Sin nombre').padEnd(20, ' ');
      const role = (row.role || 'member').padEnd(8, ' ');
      const hasPass = row.encrypted_password ? '✅ Con contraseña' : '❌ Sin contraseña';
      const passType = row.encrypted_password ? (row.encrypted_password.startsWith('pbkdf2:') ? '(PBKDF2)' : '(Otro formato)') : '';
      console.log(`  ${i + 1}. [${role}] ${name} <${email}> ${hasPass} ${passType}`);
    });
    console.log('--------------------------------------------------------------------------------\n');

    // 2. Set password if requested
    if (targetEmail && newPassword) {
      console.log(`🔄 Actualizando contraseña para el usuario: ${targetEmail}...`);

      const userMatch = usersRes.rows.find((u) => u.email.toLowerCase() === targetEmail);
      const hashedPassword = hashPassword(newPassword);

      if (userMatch) {
        // Update existing user
        await client.query(
          'UPDATE auth.users SET encrypted_password = $1 WHERE id = $2',
          [hashedPassword, userMatch.id]
        );
        console.log(`✅ ¡Contraseña actualizada con éxito para <${targetEmail}>!`);
        console.log(`   Ya puedes iniciar sesión en Pachas con tu nueva contraseña.\n`);
      } else {
        // Create user if not exists
        const { randomUUID } = await import('crypto');
        const newId = randomUUID();
        await client.query(
          `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data)
           VALUES ($1, $2, $3, $4)`,
          [newId, targetEmail, hashedPassword, JSON.stringify({ full_name: targetEmail.split('@')[0], role: 'admin' })]
        );
        await client.query(
          `INSERT INTO public.profiles (id, email, full_name, role)
           VALUES ($1, $2, $3, 'admin')
           ON CONFLICT (id) DO NOTHING`,
          [newId, targetEmail, targetEmail.split('@')[0]]
        );
        console.log(`✅ ¡Usuario <${targetEmail}> creado con éxito como Administrador con la contraseña indicada!`);
        console.log(`   Ya puedes iniciar sesión en Pachas.\n`);
      }
    } else if (!shouldList) {
      console.log('💡 Para cambiar o establecer una contraseña, ejecuta:');
      console.log('   node deploy/set-user-password.mjs --email="tu_email@ejemplo.com" --password="tu_nueva_password"');
      console.log('\n   O si usas una base de datos específica:');
      console.log('   node deploy/set-user-password.mjs --email="tu_email@ejemplo.com" --password="tu_password" --db="nombre_bd" --user="postgres" --password-db="pass_db"\n');
    }

  } catch (err) {
    console.error(`❌ Error conectando a la base de datos: ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
