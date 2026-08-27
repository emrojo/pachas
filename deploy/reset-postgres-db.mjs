#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - COMPLETE POSTGRESQL DATABASE RESET SCRIPT
 * ==============================================================================
 * Completely wipes and reinitializes the PostgreSQL database (pachas_db).
 * Drops all public and auth schemas, recreates extensions, tables, triggers,
 * RLS policies, and re-grants all permissions to the production database user.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n⚠️  =========================================================');
console.log('💥  PACHAS - RESET COMPLETO DE BASE DE DATOS POSTGRESQL');
console.log('=========================================================\n');

// 1. Read credentials from env files
let user = process.env.POSTGRES_USER;
let pass = process.env.POSTGRES_PASSWORD;
let db = process.env.POSTGRES_DB;

const envFiles = [
  path.join(rootDir, 'deploy', '.env.production'),
  path.join(rootDir, '.env.production'),
  path.join(rootDir, '.env.local'),
];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      const val = v.join('=').trim();
      if (k === 'POSTGRES_USER' && !user) user = val;
      if (k === 'POSTGRES_PASSWORD' && !pass) pass = val;
      if (k === 'POSTGRES_DB' && !db) db = val;
      if (k === 'DATABASE_URL' && (!user || !pass || !db)) {
        const match = val.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@\/:?]+)(?::(\d+))?\/([^?]+)/);
        if (match) {
          if (!user) user = decodeURIComponent(match[1]);
          if (!pass) pass = decodeURIComponent(match[2]);
          if (!db) db = match[5].split('?')[0];
        }
      }
    }
  }
}

user = user || 'pachas_prod_admin';
pass = pass || 'Pachas_Prod_2026_SecureKey';
db = db || 'pachas_db';

const schemaFile = path.join(rootDir, 'deploy', 'init-scripts', '01-schema.sql');

console.log(`📌 Base de datos objetivo: "${db}"`);
console.log(`📌 Usuario de aplicación:   "${user}"`);
console.log(`📌 Archivo de esquema SQL: "${schemaFile}"\n`);

const isForce = process.argv.includes('--force') || process.argv.includes('-y') || process.argv.includes('-f');

async function confirmReset() {
  if (isForce) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      '🚨 ATENCIÓN: Esta acción BORRARÁ TODOS los usuarios, grupos, gastos y datos de la base de datos.\n¿Estás seguro de que deseas continuar? (escribe "si" para confirmar): ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'si' || answer.trim().toLowerCase() === 'yes');
      }
    );
  });
}

async function run() {
  const confirmed = await confirmReset();
  if (!confirmed) {
    console.log('\n❌ Operación cancelada. No se ha modificado la base de datos.\n');
    process.exit(0);
  }

  console.log('\n⏳ Iniciando reset de la base de datos...\n');

  // SQL Statements for wiping and recreating schemas
  const wipeSchemasSql = `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA auth;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA auth TO postgres;
`;

  const setupPermissionsSql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user}') THEN
    CREATE ROLE "${user}" WITH LOGIN PASSWORD '${pass.replace(/'/g, "''")}';
  ELSE
    ALTER ROLE "${user}" WITH LOGIN PASSWORD '${pass.replace(/'/g, "''")}';
  END IF;
END
$$;

ALTER ROLE "${user}" BYPASSRLS;
GRANT ALL PRIVILEGES ON DATABASE "${db}" TO "${user}";
GRANT USAGE, CREATE ON SCHEMA public, auth TO "${user}";
GRANT ALL ON ALL TABLES IN SCHEMA public, auth TO "${user}";
GRANT ALL ON ALL SEQUENCES IN SCHEMA public, auth TO "${user}";
GRANT ALL ON ALL ROUTINES IN SCHEMA public, auth TO "${user}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth GRANT ALL ON TABLES TO "${user}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth GRANT ALL ON SEQUENCES TO "${user}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth GRANT ALL ON ROUTINES TO "${user}";
`;

  let automatedSuccess = false;

  if (process.platform === 'linux') {
    try {
      console.log('1️⃣ Limpiando esquemas public y auth...');
      execSync(`sudo -u postgres psql -d "${db}"`, {
        input: wipeSchemasSql,
        stdio: ['pipe', 'inherit', 'inherit'],
      });

      console.log('2️⃣ Importando esquema completo desde 01-schema.sql...');
      execSync(`sudo -u postgres psql -d "${db}" -f "${schemaFile}"`, {
        stdio: 'inherit',
      });

      console.log('3️⃣ Configurando permisos y usuario de aplicación...');
      execSync(`sudo -u postgres psql -d "${db}"`, {
        input: setupPermissionsSql,
        stdio: ['pipe', 'inherit', 'inherit'],
      });

      automatedSuccess = true;
      console.log('\n🎉 =========================================================');
      console.log('✅  ¡BASE DE DATOS POSTGRESQL RESETEADA CON ÉXITO AL 100%!');
      console.log('=========================================================\n');
      console.log('La base de datos está completamente limpia, con tablas nuevas, RLS y permisos listos.\n');
    } catch (err) {
      console.log('\n⚠️ No se pudo ejecutar sudo directamente.');
    }
  }


  if (!automatedSuccess) {
    console.log(`
📋 Para resetear la base de datos manualmente en tu servidor Ubuntu, ejecuta:

1️⃣ Limpiar esquemas y recrear estructura:
   sudo -u postgres psql -d "${db}" -c "DROP SCHEMA IF EXISTS public, auth CASCADE; CREATE SCHEMA public; CREATE SCHEMA auth; GRANT ALL ON SCHEMA public, auth TO postgres, public;"

2️⃣ Cargar esquema completo:
   sudo -u postgres psql -d "${db}" < deploy/init-scripts/01-schema.sql

3️⃣ Conceder permisos de aplicación:
   sudo -u postgres psql -d "${db}" -c "ALTER ROLE \\"${user}\\" BYPASSRLS; GRANT ALL PRIVILEGES ON DATABASE \\"${db}\\" TO \\"${user}\\"; GRANT USAGE, CREATE ON SCHEMA public, auth TO \\"${user}\\"; GRANT ALL ON ALL TABLES IN SCHEMA public, auth TO \\"${user}\\"; GRANT ALL ON ALL SEQUENCES IN SCHEMA public, auth TO \\"${user}\\"; ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth GRANT ALL ON TABLES TO \\"${user}\\";"

✅ ¡Una vez ejecutado, tu base de datos estará 100% reseteada e inicializada!
`);
  }
}

run();
