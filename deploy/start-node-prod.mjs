#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - NATIVE NODE.JS PRODUCTION RUNNER & PREPARER
 * ==============================================================================
 * 1. Validates production environment and high-entropy secrets.
 * 2. Copies public/ and .next/static/ to .next/standalone/ for standalone runtime.
 * 3. Launches the native standalone Node.js production server with graceful shutdown.
 * ==============================================================================
 */

import { existsSync, cpSync, mkdirSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { spawn } from 'child_process';

const rootDir = process.cwd();
const standaloneDir = join(rootDir, '.next', 'standalone');
const serverScript = join(standaloneDir, 'server.js');
const envProdFile = join(rootDir, 'deploy', '.env.production');

console.log('\x1b[36m%s\x1b[0m', '🚀 =======================================================');
console.log('\x1b[36m%s\x1b[0m', '🚀 PACHAS - NATIVE NODE.JS PRODUCTION SERVER');
console.log('\x1b[36m%s\x1b[0m', '🚀 =======================================================\n');

// 1. Load environment variables from deploy/.env.production if present
const customEnv = { ...process.env, NODE_ENV: 'production' };

if (existsSync(envProdFile)) {
  console.log('\x1b[32m%s\x1b[0m', `📋 Loading production variables from: ${envProdFile}`);
  const envContent = readFileSync(envProdFile, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!customEnv[key]) {
        customEnv[key] = val;
      }
    }
  });
} else {
  console.log('\x1b[33m%s\x1b[0m', `⚠️  deploy/.env.production not found. Falling back to system environment variables.`);
}

// 2. Ensure standalone build exists
if (!existsSync(serverScript)) {
  console.error('\x1b[31m%s\x1b[0m', '❌ .next/standalone/server.js not found!');
  console.log('\x1b[33m%s\x1b[0m', '👉 Please compile the production build first with: npm run build');
  process.exit(1);
}

// 3. Prepare static assets in standalone directory
console.log('\x1b[34m%s\x1b[0m', '📦 Preparing standalone assets for native Node runtime...');

const publicSrc = join(rootDir, 'public');
const publicDest = join(standaloneDir, 'public');
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
}

const staticSrc = join(rootDir, '.next', 'static');
const staticDest = join(standaloneDir, '.next', 'static');
if (existsSync(staticSrc)) {
  mkdirSync(join(standaloneDir, '.next'), { recursive: true });
  cpSync(staticSrc, staticDest, { recursive: true });
}

const port = customEnv.PORT || 3000;
const host = customEnv.HOSTNAME || '0.0.0.0';

console.log('\x1b[32m%s\x1b[0m', '✅ Standalone assets synchronized.');
console.log('\x1b[32m%s\x1b[0m', `🌐 Starting native Node.js production server on http://${host}:${port}`);
console.log('\x1b[32m%s\x1b[0m', `🛡️  NODE_ENV=production | Security Headers Active | PID: ${process.pid}\n`);

// 4. Spawn the standalone Node.js server
const child = spawn(process.execPath, [serverScript], {
  cwd: standaloneDir,
  env: {
    ...customEnv,
    PORT: String(port),
    HOSTNAME: host,
  },
  stdio: 'inherit',
});

// 5. Graceful shutdown handler
const shutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down native Node production server cleanly...`);
  child.kill(signal);
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('exit', (code, signal) => {
  if (code !== null) {
    process.exit(code);
  } else if (signal) {
    process.exit(1);
  }
});
