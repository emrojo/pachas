import pg, { Pool, PoolConfig } from 'pg';
import { runPendingMigrations } from './migrator';

// Configure node-postgres type parsers to prevent timezone skew on dates and timestamps
// OID 1082 = DATE: return raw string "YYYY-MM-DD"
pg.types.setTypeParser(1082, (val) => val);
// OID 1114 = TIMESTAMP: return ISO string "YYYY-MM-DDTHH:mm:ss"
pg.types.setTypeParser(1114, (val) => (val ? val.replace(' ', 'T') : val));
// OID 1184 = TIMESTAMPTZ: return ISO string
pg.types.setTypeParser(1184, (val) => (val ? val.replace(' ', 'T') : val));

let pool: Pool | null = null;

export function parseDatabaseConfig(
  customUrl?: string,
  env: NodeJS.ProcessEnv = process.env
): PoolConfig | null {
  // 1. If discrete variables are available, use them directly (completely immune to URL parsing errors)
  if (env.POSTGRES_USER && env.POSTGRES_PASSWORD) {
    return {
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      host: env.POSTGRES_HOST || 'localhost',
      port: parseInt(env.POSTGRES_PORT || '5432', 10),
      database: env.POSTGRES_DB || 'pachas',
    };
  }

  const dbUrl = customUrl || env.DATABASE_URL;
  if (!dbUrl) return null;

  try {
    // 2. Robust parser for connection strings with special chars in password (e.g., '@', '#', '$', '!')
    // Matches: postgresql://[user]:[password]@[host]:[port]/[database]
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

let schemaInitialized = false;

export async function ensureGlobalSchema(p: Pool): Promise<void> {
  if (schemaInitialized) return;
  schemaInitialized = true;

  try {
    // 1. Profiles ban columns
    await p.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;`).catch(() => {});
    await p.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;`).catch(() => {});
    await p.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by UUID;`).catch(() => {});
    await p.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;`).catch(() => {});

    // 2. Groups freeze columns
    await p.query(`ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE;`).catch(() => {});
    await p.query(`ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE;`).catch(() => {});
    await p.query(`ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_by UUID;`).catch(() => {});
    await p.query(`ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_reason TEXT;`).catch(() => {});
    await p.query(`ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS freeze_type TEXT DEFAULT 'full';`).catch(() => {});

    // 3. Reports moderation columns
    await p.query(`ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS resolution_notes TEXT;`).catch(() => {});
    await p.query(`ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS evidence_snapshot JSONB;`).catch(() => {});

    // 4. Support Messages Table
    await p.query(`
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
    `).catch(async () => {
      await p.query(`
        CREATE TABLE IF NOT EXISTS public.support_messages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
      `).catch(() => {});
    });

    // 5. Support message indexes
    await p.query(`CREATE INDEX IF NOT EXISTS idx_support_messages_user ON public.support_messages(user_id);`).catch(() => {});
    await p.query(`CREATE INDEX IF NOT EXISTS idx_support_messages_created ON public.support_messages(created_at DESC);`).catch(() => {});
  } catch (err) {
    console.warn('Schema auto-migration notice:', err);
  }
}

export function getDbPool(): Pool | null {
  if (pool) return pool;

  const config = parseDatabaseConfig();
  if (!config) return null;

  pool = new Pool({
    ...config,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Ensure physical columns and run pending SQL migrations asynchronously
  ensureGlobalSchema(pool).catch(() => {});
  runPendingMigrations(pool).catch(() => {});

  return pool;
}
