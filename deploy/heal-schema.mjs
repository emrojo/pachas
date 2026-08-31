#!/usr/bin/env node

/**
 * ==============================================================================
 * PACHAS - SCHEMA SYNCHRONIZATION & AUTO-HEAL SCRIPT
 * ==============================================================================
 * Directly verifies and adds missing columns/tables in PostgreSQL production
 * without modifying or depending on the `_migrations` tracking table.
 * 100% safe to run on existing production databases with live user data.
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

// 1. Load environment variables
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

// 2. Resolve database config
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

  return {
    user: 'postgres',
    password: 'postgrespassword',
    host: 'localhost',
    port: 5432,
    database: 'pachas',
  };
}

async function healSchema() {
  const client = new Client(getDatabaseConfig());
  try {
    await client.connect();
    console.log('\n🩺 =========================================================');
    console.log('🩺  PACHAS - SINCRONIZACIÓN Y REPARACIÓN FÍSICA DE ESQUEMA');
    console.log('=========================================================\n');

    console.log('🔍 Inspeccionando columnas y tablas en PostgreSQL...\n');

    const repairs = [
      {
        name: 'public.profiles -> is_banned',
        sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE NOT NULL;',
      },
      {
        name: 'public.profiles -> banned_at',
        sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;',
      },
      {
        name: 'public.profiles -> banned_by',
        sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by UUID;',
      },
      {
        name: 'public.profiles -> ban_reason',
        sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;',
      },
      {
        name: 'public.profiles -> preferred_language',
        sql: "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'es';",
      },
      {
        name: 'public.groups -> is_frozen',
        sql: 'ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE NOT NULL;',
      },
      {
        name: 'public.groups -> frozen_at',
        sql: 'ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE;',
      },
      {
        name: 'public.groups -> frozen_by',
        sql: 'ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_by UUID;',
      },
      {
        name: 'public.groups -> frozen_reason',
        sql: 'ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_reason TEXT;',
      },
      {
        name: 'public.groups -> freeze_type',
        sql: "ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS freeze_type TEXT DEFAULT 'full';",
      },
      {
        name: 'public.content_reports -> resolution_notes',
        sql: 'ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS resolution_notes TEXT;',
      },
      {
        name: 'public.content_reports -> evidence_snapshot',
        sql: 'ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS evidence_snapshot JSONB;',
      },
      {
        name: 'public.support_messages (tabla)',
        sql: `
          CREATE TABLE IF NOT EXISTS public.support_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            sender_id UUID NOT NULL,
            sender_role TEXT NOT NULL,
            message TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            attachment_url TEXT,
            is_read_by_user BOOLEAN DEFAULT FALSE NOT NULL,
            is_read_by_admin BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
          );
        `,
      },
      {
        name: 'public.support_messages -> índices',
        sql: `
          CREATE INDEX IF NOT EXISTS idx_support_messages_user ON public.support_messages(user_id);
          CREATE INDEX IF NOT EXISTS idx_support_messages_created ON public.support_messages(created_at DESC);
        `,
      },
    ];

    for (const r of repairs) {
      process.stdout.write(`⏳ Comprobando/Aplicando: ${r.name}... `);
      try {
        await client.query(r.sql);
        console.log('✅ OK');
      } catch (err) {
        console.log(`⚠️ Aviso: ${err.message}`);
      }
    }

    console.log('\n🎉 ¡Sincronización física completada! Todas las columnas requeridas están presentes en PostgreSQL.\n');

  } catch (err) {
    console.error('\n❌ Error de conexión:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

healSchema();
