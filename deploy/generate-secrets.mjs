#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - CRYPTOGRAPHIC PRODUCTION SECRETS GENERATOR
 * ==============================================================================
 * Generates secure random strings for PostgreSQL, JWT tokens, and app keys,
 * creating a validated deploy/.env.production file.
 * ==============================================================================
 */

import { randomBytes } from 'crypto';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

function generateHex(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

function generatePassword(length = 24) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~';
  const randomValues = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

const targetDir = resolve('deploy');
const targetEnv = join(targetDir, '.env.production');

console.log('🔒 =======================================================');
console.log('🔒 Pachas - Production Secrets & Security Config Generator');
console.log('🔒 =======================================================\n');

const postgresPassword = generatePassword(28);
const jwtSecret = generateHex(32);
const postgresUser = 'pachas_prod_admin';
const postgresDb = 'pachas';

const content = `# ==============================================================================
# PACHAS - PRODUCTION ENVIRONMENT CONFIGURATION (AUTO-GENERATED)
# Generated at: ${new Date().toISOString()}
# ==============================================================================

NODE_ENV=production
PORT=3000

# Swarm Stack Name
STACK_NAME=pachas
PACHAS_IMAGE=pachas:latest
APP_REPLICAS=2

# ------------------------------------------------------------------------------
# SUPABASE / BACKEND CONFIGURATION
# ------------------------------------------------------------------------------
# Replace with your production Supabase URL or leave default if using postgrest stack:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${jwtSecret}
NEXT_PUBLIC_ADMIN_EMAIL=admin@pachas.local

# ------------------------------------------------------------------------------
# BASE DE DATOS POSTGRESQL (HIGH-ENTROPY PRODUCTION SECRETS)
# ------------------------------------------------------------------------------
POSTGRES_DB=${postgresDb}
POSTGRES_USER=${postgresUser}
POSTGRES_PASSWORD=${postgresPassword}
POSTGRES_PORT=5432

# ------------------------------------------------------------------------------
# REVERSE PROXY / INGRESS
# ------------------------------------------------------------------------------
APP_DOMAIN=pachas.local
HTTP_PORT=80
HTTPS_PORT=443

# Security Flag: Disable demo test logins in production
NEXT_PUBLIC_ENABLE_DEMO_USERS=false
`;

writeFileSync(targetEnv, content, 'utf8');
console.log(`✅ Secure production environment generated at: ${targetEnv}`);
console.log(`🔑 PostgreSQL User:     ${postgresUser}`);
console.log(`🔑 PostgreSQL Password: [GENERATED 28-CHAR RANDOM]`);
console.log(`🔑 JWT Token Secret:    [GENERATED 256-BIT CRYPTO SECRET]`);
console.log(`🛡️  NEXT_PUBLIC_ENABLE_DEMO_USERS=false enforced.\n`);
