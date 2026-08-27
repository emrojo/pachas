#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - POSTGRESQL PRODUCTION DATABASE INITIALIZER / MIGRATOR
 * ==============================================================================
 * Connects to PostgreSQL and applies 01-schema.sql (tables, triggers, RLS).
 * Supports any PostgreSQL database (Docker, Supabase, Neon, Railway, AWS RDS).
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
console.log('🐘  PACHAS - INICIALIZADOR DE BASE DE DATOS POSTGRESQL');
console.log('=========================================================\n');

// 1. Locate schema file
const schemaPath = path.join(rootDir, 'deploy', 'init-scripts', '01-schema.sql');
if (!fs.existsSync(schemaPath)) {
  console.error(`❌ Error: No se encontró el archivo de esquema en: ${schemaPath}`);
  process.exit(1);
}

const schemaSql = fs.readFileSync(schemaPath, 'utf8');
console.log(`📄 Esquema SQL cargado (${schemaSql.length} bytes, 7 tablas principales).`);

// 2. Read connection string from environment or .env files
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  const prodEnvPath = path.join(rootDir, 'deploy', '.env.production');
  if (fs.existsSync(prodEnvPath)) {
    const lines = fs.readFileSync(prodEnvPath, 'utf8').split('\n');
    for (const line of lines) {
      if (line.startsWith('DATABASE_URL=')) {
        dbUrl = line.split('=')[1]?.trim();
        break;
      }
    }
  }
}

if (!dbUrl) {
  const user = process.env.POSTGRES_USER || 'pachas_admin';
  const pass = process.env.POSTGRES_PASSWORD || 'pachas_secure_password_123!';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'pachas';
  dbUrl = `postgresql://${user}:${pass}@${host}:${port}/${db}`;
}

const sanitizedDbUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
console.log(`🔗 Destino PostgreSQL: ${sanitizedDbUrl}`);

// 3. Execution instructions / automated docker execution if container is running
console.log('\n🚀 Verificando estado del contenedor Docker...');
try {
  const runningContainers = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  if (runningContainers.includes('pachas_postgres')) {
    console.log('📦 Contenedor pachas_postgres detectado. Aplicando esquema SQL directamente...');
    execSync('docker exec -i pachas_postgres psql -U pachas_admin -d pachas', {
      input: schemaSql,
      stdio: ['pipe', 'inherit', 'inherit']
    });
    console.log('\n✅ ¡Esquema de PostgreSQL inicializado con éxito en el contenedor Docker!');
    process.exit(0);
  }
} catch (e) {
  // Docker not available or not running, continue with instructions
}

console.log(`
📋 Para aplicar este esquema en tu base de datos PostgreSQL de producción:

1️⃣ Si usas Docker Compose:
   docker compose -f deploy/docker-compose.yml up -d
   (El esquema se aplica de forma automática al iniciar el contenedor)

2️⃣ Si usas psql en terminal:
   psql "${dbUrl}" -f deploy/init-scripts/01-schema.sql

3️⃣ Si usas Supabase Cloud, Neon, Railway o AWS RDS:
   - Abre el SQL Editor del panel de tu proveedor
   - Pega y ejecuta el contenido de: deploy/init-scripts/01-schema.sql

✅ Tablas incluidas en el esquema:
   • auth.users / public.profiles
   • public.groups / public.group_members
   • public.expenses / public.expense_payers / public.expense_participants
   • public.settlements
   • Políticas Row Level Security (RLS) y Triggers
`);
