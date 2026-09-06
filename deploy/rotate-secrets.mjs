#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - SECRETS & CREDENTIALS ROTATION ENGINE
 * ==============================================================================
 * Comprehensive cryptographic secrets rotation, pre-restart revalidation,
 * and hot-reloading for Systemd (pachas.service), PM2, and Docker.
 *
 * Usage:
 *   node deploy/rotate-secrets.mjs                 # Interactive Mode
 *   node deploy/rotate-secrets.mjs --all           # Rotate all local secrets (.env.local)
 *   node deploy/rotate-secrets.mjs --all --prod    # Rotate all local secrets (deploy/.env.production)
 *   node deploy/rotate-secrets.mjs --jwt           # Rotate only JWT_SECRET
 *   node deploy/rotate-secrets.mjs --postgres      # Rotate only POSTGRES_PASSWORD & DATABASE_URL
 *   node deploy/rotate-secrets.mjs --vapid         # Rotate WebPush VAPID keypair
 *   node deploy/rotate-secrets.mjs --gemini        # Guided rotation for Google Gemini API
 *   node deploy/rotate-secrets.mjs --pexels        # Guided rotation for Pexels API
 *   node deploy/rotate-secrets.mjs --email         # Guided rotation for Email (SMTP/Resend/SendGrid)
 *   node deploy/rotate-secrets.mjs --reload        # Force service reload after validation
 *   node deploy/rotate-secrets.mjs --service systemd # Specify service manager (systemd/pm2/docker/swarm)
 * ==============================================================================
 */

import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { execSync, spawnSync } from 'child_process';
import http from 'http';
import https from 'https';
import pg from 'pg';
import webpush from 'web-push';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ------------------------------------------------------------------------------
// 1. HELPERS & GENERATORS
// ------------------------------------------------------------------------------

export function generateHex(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

export function generatePassword(length = 28) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-~!';
  const randomValues = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

export function generateVapidKeys() {
  return webpush.generateVAPIDKeys();
}

// Format timestamp for backup files
function getTimestampString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// ------------------------------------------------------------------------------
// 2. ENV FILE PARSING, BACKUP & UPDATING
// ------------------------------------------------------------------------------

export function resolveTargetFiles(args) {
  if (args.env) {
    return [path.resolve(rootDir, args.env)];
  }
  if (args['all-targets']) {
    const targets = [];
    const candidates = [
      path.join(rootDir, '.env.local'),
      path.join(rootDir, '.env'),
      path.join(__dirname, '.env.production'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) targets.push(c);
    }
    return targets.length > 0 ? targets : [path.join(rootDir, '.env.local')];
  }
  if (args.prod) {
    return [path.join(__dirname, '.env.production')];
  }
  // Default to .env.local if present, else .env, else deploy/.env.production
  if (fs.existsSync(path.join(rootDir, '.env.local'))) {
    return [path.join(rootDir, '.env.local')];
  }
  if (fs.existsSync(path.join(rootDir, '.env'))) {
    return [path.join(rootDir, '.env')];
  }
  return [path.join(__dirname, '.env.production')];
}

export function createEnvBackup(envPath) {
  if (!fs.existsSync(envPath)) return null;
  const backupPath = `${envPath}.bak-${getTimestampString()}`;
  fs.copyFileSync(envPath, backupPath);
  return backupPath;
}

export function restoreEnvBackup(backupPath, envPath) {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, envPath);
    return true;
  }
  return false;
}

export function parseEnvContent(content) {
  const lines = content.split('\n');
  const parsed = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
    if (key) parsed[key.trim()] = value;
  }
  return parsed;
}

export function updateEnvKeysInContent(content, newKeys) {
  const lines = content.split('\n');
  const updatedKeys = new Set();
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      return line;
    }
    const [keyPart] = trimmed.split('=');
    const key = keyPart.trim();
    if (key in newKeys) {
      updatedKeys.add(key);
      const val = newKeys[key];
      // Format quotes if value contains spaces or special characters
      const needsQuotes = typeof val === 'string' && (val.includes(' ') || val.includes('#') || val.includes('"'));
      const formattedVal = needsQuotes ? `"${val.replace(/"/g, '\\"')}"` : val;
      return `${key}=${formattedVal}`;
    }
    return line;
  });

  // Append any keys that were not present in the original content
  for (const [k, v] of Object.entries(newKeys)) {
    if (!updatedKeys.has(k)) {
      const needsQuotes = typeof v === 'string' && (v.includes(' ') || v.includes('#'));
      const formattedVal = needsQuotes ? `"${v}"` : v;
      newLines.push(`${k}=${formattedVal}`);
    }
  }

  return newLines.join('\n');
}

export function updateEnvFile(filePath, newKeys) {
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    // If it doesn't exist, create it from template if possible or brand new
    let initialContent = '';
    const exampleLocal = path.join(rootDir, '.env.example');
    const exampleProd = path.join(__dirname, 'env.example');
    if (filePath.includes('.production') && fs.existsSync(exampleProd)) {
      initialContent = fs.readFileSync(exampleProd, 'utf8');
    } else if (fs.existsSync(exampleLocal)) {
      initialContent = fs.readFileSync(exampleLocal, 'utf8');
    }
    const updated = updateEnvKeysInContent(initialContent, newKeys);
    fs.writeFileSync(filePath, updated, 'utf8');
    return;
  }

  const currentContent = fs.readFileSync(filePath, 'utf8');
  const updatedContent = updateEnvKeysInContent(currentContent, newKeys);
  fs.writeFileSync(filePath, updatedContent, 'utf8');
}

// ------------------------------------------------------------------------------
// 3. REVALIDATION PIPELINE (PRE-RESTART INTEGRITY & DATABASE TEST)
// ------------------------------------------------------------------------------

export async function validateEnvConfiguration(envPath, options = {}) {
  const issues = [];
  if (!fs.existsSync(envPath)) {
    return { ok: false, issues: [`El archivo destino ${envPath} no existe.`] };
  }

  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch (err) {
    return { ok: false, issues: [`Error de lectura: ${err.message}`] };
  }

  const parsed = parseEnvContent(content);

  // 1. Validate JWT_SECRET
  if (options.checkJwt !== false) {
    const jwt = parsed.JWT_SECRET;
    if (!jwt) {
      issues.push('Falta la variable JWT_SECRET.');
    } else if (jwt.length < 32) {
      issues.push(`JWT_SECRET es demasiado corto (${jwt.length} caracteres; mínimo 32 requeridos).`);
    } else if (jwt.includes('default-pachas') && options.strict) {
      issues.push('JWT_SECRET sigue utilizando el valor predeterminado.');
    }
  }

  // 2. Validate VAPID Keys
  if (options.checkVapid) {
    const pub = parsed.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = parsed.VAPID_PRIVATE_KEY;
    if (pub && !priv) {
      issues.push('Se configuró NEXT_PUBLIC_VAPID_PUBLIC_KEY pero falta VAPID_PRIVATE_KEY.');
    } else if (!pub && priv) {
      issues.push('Se configuró VAPID_PRIVATE_KEY pero falta NEXT_PUBLIC_VAPID_PUBLIC_KEY.');
    }
  }

  // 3. Validate PostgreSQL Connection (Handshake Test)
  if (options.testDbConnection && (parsed.DATABASE_URL || parsed.POSTGRES_PASSWORD)) {
    let clientConfig = null;
    if (parsed.DATABASE_URL) {
      clientConfig = { connectionString: parsed.DATABASE_URL, connectionTimeoutMillis: 4000 };
    } else if (parsed.POSTGRES_USER && parsed.POSTGRES_PASSWORD) {
      clientConfig = {
        user: parsed.POSTGRES_USER,
        password: parsed.POSTGRES_PASSWORD,
        host: parsed.POSTGRES_HOST || 'localhost',
        port: parseInt(parsed.POSTGRES_PORT || '5432', 10),
        database: parsed.POSTGRES_DB || 'pachas',
        connectionTimeoutMillis: 4000,
      };
    }

    if (clientConfig) {
      const client = new Client(clientConfig);
      try {
        await client.connect();
        const res = await client.query('SELECT 1 AS ok');
        if (!res.rows || res.rows.length === 0) {
          issues.push('La consulta de verificación de base de datos no devolvió resultados.');
        }
        await client.end();
      } catch (err) {
        issues.push(`Fallo al autenticar contra PostgreSQL con las credenciales validadas: ${err.message}`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    parsed,
  };
}

// ------------------------------------------------------------------------------
// 4. DATABASE PASSWORD ROTATION (ALTER USER)
// ------------------------------------------------------------------------------

export async function applyPostgresPasswordToDatabase({
  user,
  newPassword,
  oldPassword,
  host = 'localhost',
  port = 5432,
  database = 'pachas',
  databaseUrl,
}) {
  let connectionConfig = null;

  if (databaseUrl) {
    connectionConfig = { connectionString: databaseUrl };
  } else {
    connectionConfig = {
      user: user || 'pachas_admin',
      password: oldPassword,
      host,
      port,
      database,
    };
  }

  const client = new Client(connectionConfig);
  try {
    await client.connect();
    // Escape username to prevent SQL injection
    const cleanUser = user.replace(/[^a-zA-Z0-9_]/g, '');
    // Escape single quotes in password
    const cleanPass = newPassword.replace(/'/g, "''");
    await client.query(`ALTER USER "${cleanUser}" WITH PASSWORD '${cleanPass}';`);
    await client.end();
    return { ok: true };
  } catch (err) {
    try {
      await client.end();
    } catch {}
    return { ok: false, error: err.message };
  }
}

// ------------------------------------------------------------------------------
// 5. SERVICE DETECTION & RELOADING (SYSTEMD, PM2, DOCKER)
// ------------------------------------------------------------------------------

export function detectRunningServices() {
  const detected = [];

  // A. Check systemd pachas.service (Linux)
  try {
    const res = spawnSync('systemctl', ['is-active', 'pachas.service'], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout.trim() === 'active') {
      detected.push('systemd');
    }
  } catch {}

  // B. Check PM2 cluster
  try {
    const res = spawnSync('npx', ['pm2', 'jlist'], { encoding: 'utf8', shell: true });
    if (res.status === 0 && res.stdout.includes('pachas-prod')) {
      detected.push('pm2');
    }
  } catch {}

  // C. Check Docker Compose
  try {
    const res = spawnSync('docker', ['compose', 'ps', '--format', 'json'], { encoding: 'utf8' });
    if (res.status === 0 && (res.stdout.includes('pachas_app') || res.stdout.includes('pachas-app'))) {
      detected.push('docker');
    }
  } catch {}

  // D. Check Docker Swarm
  try {
    const res = spawnSync('docker', ['service', 'ls'], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout.includes('pachas_app')) {
      detected.push('swarm');
    }
  } catch {}

  return detected;
}

export async function reloadService(serviceType, options = {}) {
  console.log(`\n🔄 =======================================================`);
  console.log(`🔄  RECARGANDO SERVICIO: [${serviceType.toUpperCase()}]`);
  console.log(`=======================================================`);

  let success = false;

  switch (serviceType) {
    case 'systemd': {
      console.log('>> Ejecutando: sudo systemctl restart pachas.service ...');
      try {
        execSync('sudo systemctl restart pachas.service', { stdio: 'inherit' });
        success = true;
      } catch (err) {
        // Try without sudo in case user is root
        try {
          execSync('systemctl restart pachas.service', { stdio: 'inherit' });
          success = true;
        } catch (subErr) {
          console.error(`❌ Error al reiniciar pachas.service: ${subErr.message}`);
        }
      }
      break;
    }

    case 'pm2': {
      console.log('>> Ejecutando: npx pm2 reload pachas-prod ...');
      try {
        execSync('npx pm2 reload pachas-prod', { stdio: 'inherit', shell: true });
        success = true;
      } catch (err) {
        console.error(`❌ Error al recargar PM2 cluster: ${err.message}`);
      }
      break;
    }

    case 'docker': {
      console.log('>> Ejecutando: docker compose restart app ...');
      try {
        execSync('docker compose restart app', { stdio: 'inherit' });
        success = true;
      } catch (err) {
        try {
          execSync('docker compose -f deploy/docker-compose.yml restart app', { stdio: 'inherit' });
          success = true;
        } catch (subErr) {
          console.error(`❌ Error al reiniciar contenedor Docker: ${subErr.message}`);
        }
      }
      break;
    }

    case 'swarm': {
      console.log('>> Ejecutando: docker service update --force pachas_app ...');
      try {
        execSync('docker service update --force pachas_app', { stdio: 'inherit' });
        success = true;
      } catch (err) {
        console.error(`❌ Error al actualizar servicio Docker Swarm: ${err.message}`);
      }
      break;
    }

    default:
      console.log(`ℹ️  No se especificó reinicio de servicios.`);
      return { ok: true };
  }

  if (success) {
    console.log(`✅ Comando de reinicio emitido para [${serviceType}].`);
    // Optional Healthcheck probe
    const appUrl = options.appUrl || 'http://127.0.0.1:3000';
    console.log(`>> Verificando estado del servidor en ${appUrl} ...`);
    await new Promise((r) => setTimeout(r, 2500)); // wait for boot

    try {
      const isUp = await probeHttp(appUrl);
      if (isUp) {
        console.log(`✅ [HEALTHCHECK OK] El servicio está activo y respondiendo correctamente.`);
      } else {
        console.warn(`⚠️  [HEALTHCHECK NOTICE] El servidor tardó más de lo esperado en responder. Verifica logs del servicio.`);
      }
    } catch {
      console.warn(`⚠️  No se pudo verificar el puerto 3000 local (puede estar iniciando).`);
    }
  }

  return { ok: success };
}

function probeHttp(urlStr) {
  return new Promise((res) => {
    try {
      const url = new URL(urlStr);
      const requester = url.protocol === 'https:' ? https : http;
      const req = requester.get(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname || '/',
          timeout: 4000,
        },
        (response) => {
          res(response.statusCode >= 200 && response.statusCode < 400);
        }
      );
      req.on('error', () => res(false));
      req.on('timeout', () => {
        req.destroy();
        res(false);
      });
    } catch {
      res(false);
    }
  });
}

// ------------------------------------------------------------------------------
// 6. INTERACTIVE CLI RUNNER
// ------------------------------------------------------------------------------

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function parseCliArgs() {
  const args = {
    all: false,
    jwt: false,
    postgres: false,
    vapid: false,
    gemini: false,
    pexels: false,
    email: false,
    userPassword: false,
    prod: false,
    local: false,
    allTargets: false,
    reload: false,
    noReload: false,
    applyDb: false,
    service: null,
    env: null,
  };

  const rawArgs = process.argv.slice(2);
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--all') args.all = true;
    else if (arg === '--jwt') args.jwt = true;
    else if (arg === '--postgres') args.postgres = true;
    else if (arg === '--vapid') args.vapid = true;
    else if (arg === '--gemini') args.gemini = true;
    else if (arg === '--pexels') args.pexels = true;
    else if (arg === '--email') args.email = true;
    else if (arg === '--user-password') args.userPassword = true;
    else if (arg === '--prod') args.prod = true;
    else if (arg === '--local') args.local = true;
    else if (arg === '--all-targets') args.allTargets = true;
    else if (arg === '--reload') args.reload = true;
    else if (arg === '--no-reload') args.noReload = true;
    else if (arg === '--apply-db') args.applyDb = true;
    else if (arg === '--service' && rawArgs[i + 1]) {
      args.service = rawArgs[++i];
    } else if (arg === '--env' && rawArgs[i + 1]) {
      args.env = rawArgs[++i];
    }
  }

  return args;
}

export async function runRotation() {
  const args = parseCliArgs();

  console.log('\n🔒 =========================================================');
  console.log('🔐  PACHAS - MOTOR DE ROTACIÓN DE SECRETOS Y CREDENCIALES');
  console.log('=========================================================\n');

  const targets = resolveTargetFiles(args);
  console.log(`📁 Archivo(s) objetivo para la rotación:`);
  targets.forEach((t) => console.log(`   └─ ${t}`));
  console.log('');

  // Determine actions to execute
  let actions = {
    jwt: args.jwt || args.all,
    postgres: args.postgres || args.all,
    vapid: args.vapid || args.all,
    gemini: args.gemini,
    pexels: args.pexels,
    email: args.email,
    userPassword: args.userPassword,
  };

  // If no flags were passed, show interactive menu
  const hasSpecificFlag = Object.values(actions).some(Boolean);
  if (!hasSpecificFlag) {
    console.log('Elige qué secreto o credencial deseas rotar:\n');
    console.log('  [1] 🚨 ROTAR TODO (Emergencia: JWT, Postgres, VAPID)');
    console.log('  [2] 🔑 Rotar JWT_SECRET (Sesiones de usuario)');
    console.log('  [3] 🐘 Rotar POSTGRES_PASSWORD y DATABASE_URL');
    console.log('  [4] 🔔 Rotar Claves VAPID (Notificaciones WebPush)');
    console.log('  [5] 🧠 Guía para Rotar Google Gemini API Key');
    console.log('  [6] 📸 Guía para Rotar Pexels API Key');
    console.log('  [7] ✉️  Guía para Rotar Servidor de Correo (SMTP/Resend/SendGrid)');
    console.log('  [8] 👤 Cambiar Contraseña de Usuario en Base de Datos');
    console.log('  [0] Salir sin hacer cambios\n');

    const choice = await askQuestion('Selecciona una opción [1-8]: ');

    switch (choice) {
      case '1':
        actions.jwt = true;
        actions.postgres = true;
        actions.vapid = true;
        break;
      case '2':
        actions.jwt = true;
        break;
      case '3':
        actions.postgres = true;
        break;
      case '4':
        actions.vapid = true;
        break;
      case '5':
        actions.gemini = true;
        break;
      case '6':
        actions.pexels = true;
        break;
      case '7':
        actions.email = true;
        break;
      case '8':
        actions.userPassword = true;
        break;
      default:
        console.log('Operación cancelada.');
        return;
    }
  }

  // ----------------------------------------------------------------------------
  // ROTATION EXECUTION BY COMPONENT
  // ----------------------------------------------------------------------------
  const newEnvEntries = {};
  const externalNotes = [];
  let dbPasswordRotationData = null;

  // A. JWT_SECRET Rotation
  if (actions.jwt) {
    const newJwt = generateHex(32);
    newEnvEntries.JWT_SECRET = newJwt;
    console.log('---------------------------------------------------------');
    console.log('⚡ ROTANDO JWT_SECRET:');
    console.log('   Tipo de efecto: [INVALIDACIÓN INMEDIATA Y TOTAL]');
    console.log('   Explicación: Todas las sesiones existentes y tokens firmados');
    console.log('   con la clave anterior serán rechazados de inmediato.');
    console.log('---------------------------------------------------------');
  }

  // B. POSTGRES_PASSWORD Rotation
  if (actions.postgres) {
    const newPass = generatePassword(28);
    // Read current user & db from first target
    let currentUser = 'pachas_admin';
    let currentDb = 'pachas';
    let currentHost = 'localhost';
    let currentPort = 5432;
    let oldPass = '';

    if (fs.existsSync(targets[0])) {
      const parsed = parseEnvContent(fs.readFileSync(targets[0], 'utf8'));
      currentUser = parsed.POSTGRES_USER || currentUser;
      currentDb = parsed.POSTGRES_DB || currentDb;
      currentHost = parsed.POSTGRES_HOST || currentHost;
      currentPort = parsed.POSTGRES_PORT || currentPort;
      oldPass = parsed.POSTGRES_PASSWORD || '';
    }

    newEnvEntries.POSTGRES_PASSWORD = newPass;
    newEnvEntries.DATABASE_URL = `postgresql://${encodeURIComponent(currentUser)}:${encodeURIComponent(newPass)}@${currentHost}:${currentPort}/${currentDb}`;

    dbPasswordRotationData = {
      user: currentUser,
      oldPassword: oldPass,
      newPassword: newPass,
      host: currentHost,
      port: currentPort,
      database: currentDb,
    };

    console.log('---------------------------------------------------------');
    console.log('⚡ ROTANDO POSTGRES_PASSWORD:');
    console.log('   Tipo de efecto: [INVALIDACIÓN INMEDIATA EN MOTOR SQL]');
    console.log('   Explicación: PostgreSQL solo admite 1 contraseña activa por usuario.');
    console.log('   La contraseña anterior queda completamente inutilizada.');
    console.log('---------------------------------------------------------');
  }

  // C. VAPID Keys Rotation
  if (actions.vapid) {
    try {
      const vapid = generateVapidKeys();
      newEnvEntries.NEXT_PUBLIC_VAPID_PUBLIC_KEY = vapid.publicKey;
      newEnvEntries.VAPID_PRIVATE_KEY = vapid.privateKey;
      console.log('---------------------------------------------------------');
      console.log('⚡ ROTANDO CLAVES VAPID (WEBPUSH):');
      console.log('   Tipo de efecto: [INVALIDACIÓN DE SUSCRIPCIONES PREVIAS]');
      console.log('   Explicación: Los navegadores deberán renovar su token push.');
      console.log('---------------------------------------------------------');
    } catch (err) {
      console.warn(`⚠️  No se pudieron generar claves VAPID: ${err.message}`);
    }
  }

  // D. Google Gemini Guidance & Rotation
  if (actions.gemini) {
    console.log('\n🧠 =======================================================');
    console.log('🧠  ROTACIÓN DE GOOGLE GEMINI API KEY');
    console.log('=======================================================');
    console.log('   ⚠️  Tipo de efecto: [ACCIÓN EXTERNA REQUERIDA]');
    console.log('   Cambiar la clave en Pachas no desactiva la clave en Google.');
    console.log('   Debes REVOCAR la clave vieja para anular accesos no autorizados.');
    console.log('\nPasos a seguir:');
    console.log('  1. Accede a Google AI Studio: https://aistudio.google.com/app/apikey');
    console.log('  2. Busca tu clave comprometida anterior y pulsa el icono de Basura ("Delete / Revoke").');
    console.log('  3. Pulsa "Create API Key" para generar una nueva.');
    console.log('---------------------------------------------------------\n');

    const newKey = await askQuestion('Pega tu nueva GEMINI_API_KEY (deja vacío para omitir): ');
    if (newKey) {
      newEnvEntries.GEMINI_API_KEY = newKey;
    }
    externalNotes.push('Google Gemini: Asegúrate de haber eliminado la clave anterior en aistudio.google.com.');
  }

  // E. Pexels API Guidance & Rotation
  if (actions.pexels) {
    console.log('\n📸 =======================================================');
    console.log('📸  ROTACIÓN DE PEXELS API KEY');
    console.log('=======================================================');
    console.log('   ⚠️  Tipo de efecto: [ACCIÓN EXTERNA REQUERIDA]');
    console.log('   1. Accede a: https://www.pexels.com/api/');
    console.log('   2. Entra a tu panel y solicita generar una nueva clave o revocar la previa.');
    console.log('---------------------------------------------------------\n');

    const newKey = await askQuestion('Pega tu nueva PEXELS_API_KEY (deja vacío para omitir): ');
    if (newKey) {
      newEnvEntries.PEXELS_API_KEY = newKey;
      newEnvEntries.NEXT_PUBLIC_PEXELS_API_KEY = newKey;
    }
    externalNotes.push('Pexels API: Verifica la revocación de la clave previa en pexels.com.');
  }

  // F. Email Services Guidance & Rotation
  if (actions.email) {
    console.log('\n✉️  =======================================================');
    console.log('✉️   ROTACIÓN DE CREDENCIALES DE CORREO (SMTP / RESEND)');
    console.log('=======================================================');
    console.log('   ⚠️  Tipo de efecto: [ACCIÓN EXTERNA REQUERIDA]');
    console.log('   1. Para Gmail: Ve a Seguridad > Verificación en dos pasos > Contraseñas de aplicaciones.');
    console.log('      Borra la contraseña vieja y genera una nueva de 16 caracteres.');
    console.log('   2. Para Resend: Entra a https://resend.com/api-keys, elimina la clave vieja y crea una nueva.');
    console.log('---------------------------------------------------------\n');

    console.log('¿Qué proveedor deseas actualizar?');
    console.log('  [1] Servidor SMTP / Gmail App Password');
    console.log('  [2] Resend API Key');
    console.log('  [0] Omitir');
    const mailChoice = await askQuestion('Opción: ');

    if (mailChoice === '1') {
      const pass = await askQuestion('Nueva SMTP_PASS / App Password: ');
      if (pass) newEnvEntries.SMTP_PASS = pass;
    } else if (mailChoice === '2') {
      const key = await askQuestion('Nueva RESEND_API_KEY: ');
      if (key) newEnvEntries.RESEND_API_KEY = key;
    }
    externalNotes.push('Servidor de Correo: Recuerda eliminar la clave/contraseña vieja en el panel de tu proveedor.');
  }

  // G. User Account Password Rotation in PostgreSQL
  if (actions.userPassword) {
    console.log('\n👤 =======================================================');
    console.log('👤  ROTACIÓN DE CONTRASEÑA DE USUARIO EN BASE DE DATOS');
    console.log('=======================================================');
    console.log('   Tipo de efecto: [INVALIDACIÓN INMEDIATA]');
    console.log('   Llamando al gestor de contraseñas de cuentas de Pachas...');
    try {
      execSync('node deploy/set-user-password.mjs', { stdio: 'inherit' });
    } catch (err) {
      console.error(`Error al ejecutar set-user-password: ${err.message}`);
    }
  }

  // ----------------------------------------------------------------------------
  // WRITING FILES WITH AUTOMATED BACKUP
  // ----------------------------------------------------------------------------
  const keysToUpdateCount = Object.keys(newEnvEntries).length;
  if (keysToUpdateCount === 0) {
    console.log('\nℹ️  No hay claves de variables de entorno para actualizar.');
    return;
  }

  console.log(`\n💾 Aplicando ${keysToUpdateCount} nuevo(s) secreto(s) en los archivos objetivo...`);
  const backups = [];

  for (const target of targets) {
    const backup = createEnvBackup(target);
    if (backup) {
      backups.push({ target, backup });
      console.log(`   📦 Copia de respaldo creada: ${path.basename(backup)}`);
    }
    updateEnvFile(target, newEnvEntries);
    console.log(`   ✅ Actualizado: ${target}`);
  }

  // Optional: Apply password in running PostgreSQL database
  if (dbPasswordRotationData) {
    let shouldApplyDb = args.applyDb;
    if (!shouldApplyDb && !args.all) {
      const ans = await askQuestion('\n¿Deseas aplicar la nueva contraseña en el motor PostgreSQL ahora mismo (ALTER USER)? [S/n]: ');
      shouldApplyDb = ans.toLowerCase() !== 'n';
    } else if (args.all) {
      shouldApplyDb = true;
    }

    if (shouldApplyDb) {
      console.log(`>> Conectando a PostgreSQL para actualizar contraseña de "${dbPasswordRotationData.user}"...`);
      const dbResult = await applyPostgresPasswordToDatabase(dbPasswordRotationData);
      if (dbResult.ok) {
        console.log(`✅ [SQL PASS] Contraseña de PostgreSQL actualizada en el motor con ALTER USER.`);
      } else {
        console.warn(`⚠️  [SQL NOTICE] No se pudo ejecutar ALTER USER automáticamente: ${dbResult.error}`);
        console.log(`   Si usas Docker, recuerda reiniciar el contenedor con la nueva contraseña.`);
      }
    }
  }

  // ----------------------------------------------------------------------------
  // PRE-RESTART REVALIDATION PIPELINE
  // ----------------------------------------------------------------------------
  console.log('\n🛡️  =======================================================');
  console.log('🛡️   REVALIDACIÓN PREVIA ANTES DE REINICIAR SERVICIOS');
  console.log('=======================================================');

  let allValid = true;
  for (const target of targets) {
    const validation = await validateEnvConfiguration(target, {
      checkJwt: Boolean(newEnvEntries.JWT_SECRET),
      checkVapid: Boolean(newEnvEntries.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      testDbConnection: Boolean(newEnvEntries.POSTGRES_PASSWORD) && args.applyDb,
    });

    if (validation.ok) {
      console.log(`  ✅ [PASS] ${path.basename(target)} pasó todas las comprobaciones de integridad.`);
    } else {
      allValid = false;
      console.error(`  ❌ [FAIL] Error de validación en ${path.basename(target)}:`);
      validation.issues.forEach((issue) => console.error(`     └─ ${issue}`));
    }
  }

  // AUTOMATED ROLLBACK IF VALIDATION FAILS
  if (!allValid) {
    console.error('\n🚨 =======================================================');
    console.error('🚨  VALIDACIÓN FALLIDA - EJECUTANDO ROLLBACK AUTOMÁTICO');
    console.error('=======================================================');
    for (const b of backups) {
      restoreEnvBackup(b.backup, b.target);
      console.log(`  ↩️  Restaurado ${path.basename(b.target)} desde ${path.basename(b.backup)}`);
    }
    console.error('❌ Operación abortada. Los servicios en ejecución no han sido modificados.');
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // SERVICE RELOAD PHASE (SYSTEMD pachas.service / PM2 / DOCKER)
  // ----------------------------------------------------------------------------
  let serviceToReload = args.service;
  if (!serviceToReload && !args.noReload) {
    const detected = detectRunningServices();
    if (detected.length > 0) {
      // Prioritize systemd (pachas.service) if detected
      if (detected.includes('systemd')) serviceToReload = 'systemd';
      else if (detected.includes('pm2')) serviceToReload = 'pm2';
      else if (detected.includes('docker')) serviceToReload = 'docker';
      else if (detected.includes('swarm')) serviceToReload = 'swarm';
      console.log(`\n🔎 Servicio en ejecución detectado automáticamente: [${serviceToReload.toUpperCase()}]`);
    }
  }

  if (serviceToReload && serviceToReload !== 'none') {
    let confirmReload = args.reload || args.all;
    if (!confirmReload) {
      const ans = await askQuestion(`\n¿Deseas recargar el servicio [${serviceToReload.toUpperCase()}] para aplicar la configuración? [S/n]: `);
      confirmReload = ans.toLowerCase() !== 'n';
    }

    if (confirmReload) {
      await reloadService(serviceToReload);
    } else {
      console.log('ℹ️  Recarga de servicio omitida por el usuario.');
    }
  } else {
    console.log('\nℹ️  No se detectó un servicio activo para recargar automáticamente.');
    console.log('   Si estás ejecutando en producción con systemd, ejecuta:');
    console.log('     sudo systemctl restart pachas.service');
  }

  // ----------------------------------------------------------------------------
  // EXTERNAL SERVICES CHECKLIST SUMMARY
  // ----------------------------------------------------------------------------
  if (externalNotes.length > 0) {
    console.log('\n📋 =======================================================');
    console.log('📋  RECORDATORIO DE ACCIONES EXTERNAS PENDIENTES');
    console.log('=======================================================');
    externalNotes.forEach((n, idx) => console.log(`  ${idx + 1}. ⚠️  ${n}`));
    console.log('=======================================================\n');
  }

  console.log('🎉 =======================================================');
  console.log('🎉  ROTACIÓN COMPLETADA CON ÉXITO');
  console.log('=======================================================\n');
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runRotation().catch((err) => {
    console.error('Error fatal durante la rotación:', err);
    process.exit(1);
  });
}
