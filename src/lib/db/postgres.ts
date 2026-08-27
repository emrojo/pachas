import { Pool, PoolConfig } from 'pg';

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

  return pool;
}
