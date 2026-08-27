#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - NATIVE POSTGRESQL USER & PERMISSIONS SYNC
 * ==============================================================================
 * Synchronizes the PostgreSQL database user credentials from .env.production
 * directly with the native PostgreSQL server on Ubuntu/Linux.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n🐘 =========================================================');
console.log('🐘  PACHAS - SINCRONIZACIÓN DE USUARIO POSTGRESQL');
console.log('=========================================================\n');

// 1. Read credentials from .env.production, .env.local, or process.env
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
pass = pass || 'pachas_secure_password_123!';
db = db || 'pachas_db';

console.log(`👤 Usuario:    ${user}`);
console.log(`🗄️  Base de Datos: ${db}`);
console.log(`🔑 Contraseña: [${pass.length} caracteres]`);

// 2. Prepare SQL statements
const escapedPass = pass.replace(/'/g, "''");

const setupUserSql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user}') THEN
    CREATE ROLE "${user}" WITH LOGIN PASSWORD '${escapedPass}';
  ELSE
    ALTER ROLE "${user}" WITH LOGIN PASSWORD '${escapedPass}';
  END IF;
END
$$;

ALTER ROLE "${user}" BYPASSRLS;
GRANT ALL PRIVILEGES ON DATABASE "${db}" TO "${user}";
`;


const setupPermissionsSql = `
GRANT USAGE, CREATE ON SCHEMA public TO "${user}";
GRANT USAGE, CREATE ON SCHEMA auth TO "${user}";
GRANT ALL ON ALL TABLES IN SCHEMA public TO "${user}";
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "${user}";
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO "${user}";
GRANT ALL ON ALL TABLES IN SCHEMA auth TO "${user}";
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO "${user}";
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO "${user}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${user}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${user}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO "${user}";
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO "${user}";
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO "${user}";
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON ROUTINES TO "${user}";
`;

// 3. Attempt automated execution via sudo if on Linux
let executedAutomatically = false;

if (process.platform === 'linux') {
  try {
    console.log('\n⚙️  Intentando aplicar credenciales con sudo en PostgreSQL local...');
    execSync(`sudo -u postgres psql`, {
      input: setupUserSql,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    execSync(`sudo -u postgres psql -d "${db}"`, {
      input: setupPermissionsSql,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    executedAutomatically = true;
    console.log(`\n✅ ¡Usuario "${user}" y permisos de esquemas public y auth configurados exitosamente en PostgreSQL!`);
  } catch (err) {
    console.log('⚠️ No se pudo ejecutar sudo directamente. Ejecuta los comandos manuales abajo:');
  }
}


if (!executedAutomatically) {
  console.log(`
📋 Para configurar este usuario en tu servidor PostgreSQL de Ubuntu, ejecuta:

1️⃣ Crear o actualizar la contraseña del usuario:
   sudo -u postgres psql -c "DO \\$\\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user}') THEN CREATE ROLE \\"${user}\\" WITH LOGIN PASSWORD '${escapedPass}'; ELSE ALTER ROLE \\"${user}\\" WITH LOGIN PASSWORD '${escapedPass}'; END IF; END \\$\\$; GRANT ALL PRIVILEGES ON DATABASE \\"${db}\\" TO \\"${user}\\";"

2️⃣ Conceder permisos sobre las tablas de los esquemas public y auth:
   sudo -u postgres psql -d "${db}" -c "GRANT USAGE, CREATE ON SCHEMA public, auth TO \\"${user}\\"; GRANT ALL ON ALL TABLES IN SCHEMA public, auth TO \\"${user}\\"; GRANT ALL ON ALL SEQUENCES IN SCHEMA public, auth TO \\"${user}\\"; GRANT ALL ON ALL ROUTINES IN SCHEMA public, auth TO \\"${user}\\"; ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth GRANT ALL ON TABLES TO \\"${user}\\"; ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth GRANT ALL ON SEQUENCES TO \\"${user}\\";"

✅ Una vez ejecutado, tu backend tendrá acceso completo a las tablas auth.users y public.*.
`);
}

