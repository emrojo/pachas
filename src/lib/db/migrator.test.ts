import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMigrationFiles,
  ensureMigrationsTable,
  getMigrationStatus,
  runPendingMigrations,
  splitSqlStatements,
} from './migrator';
import path from 'path';

describe('Deterministic Database Migrator (Pachas Migrations Engine)', () => {
  it('discovers and sorts all SQL migration files in chronological sequence', () => {
    const files = getMigrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(10);
    
    // Check ordering
    expect(files[0].id).toBe('01-schema');
    expect(files[1].id).toBe('02-migration-exchange-rates');
    expect(files[files.length - 1].id).toBe('10-support-chat-and-bans');

    // Ensure reset-db is excluded from regular migration sequence
    expect(files.some(f => f.file === 'reset-db.sql')).toBe(false);
  });

  it('creates the _migrations tracking ledger table', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const mockClient = { query: mockQuery } as any;

    await ensureMigrationsTable(mockClient);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS public._migrations');
    expect(mockQuery.mock.calls[0][0]).toContain('id VARCHAR(255) PRIMARY KEY');
  });

  it('correctly maps applied vs pending migration statuses', async () => {
    const mockQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] }) // ensureMigrationsTable
      .mockResolvedValueOnce({
        rows: [
          { id: '01-schema', name: '01-schema.sql', executed_at: '2026-08-30T10:00:00Z' },
          { id: '02-migration-exchange-rates', name: '02-migration-exchange-rates.sql', executed_at: '2026-08-30T10:05:00Z' },
        ],
      });

    const mockPool = { query: mockQuery } as any;
    const status = await getMigrationStatus(mockPool);

    expect(status.length).toBeGreaterThanOrEqual(10);
    expect(status[0].isApplied).toBe(true);
    expect(status[0].executedAt).toBe('2026-08-30T10:00:00Z');
    expect(status[1].isApplied).toBe(true);
    expect(status[2].isApplied).toBe(false);
  });

  it('executes only unapplied migrations inside atomic transactions', async () => {
    const executedQueries: string[] = [];
    const mockClient = {
      query: vi.fn(async (query: string, params?: any[]) => {
        executedQueries.push(typeof query === 'string' ? query.substring(0, 30) : '');
        if (query.includes('SELECT id FROM public._migrations')) {
          // 01 and 02 already executed
          return { rows: [{ id: '01-schema' }, { id: '02-migration-exchange-rates' }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any;

    const result = await runPendingMigrations(mockPool);

    expect(result.errors).toHaveLength(0);
    expect(result.applied.length).toBeGreaterThanOrEqual(8);
    expect(result.applied).not.toContain('01-schema.sql');
    expect(result.applied).toContain('10-support-chat-and-bans.sql');
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('correctly splits SQL statements respecting single quotes and dollar quotes', () => {
    const sql = `
      CREATE TABLE public.test (id UUID PRIMARY KEY);
      DO $$
      BEGIN
        RAISE NOTICE 'Hello; world';
      END
      $$;
      ALTER TABLE public.test ADD COLUMN name TEXT;
    `;

    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain('CREATE TABLE public.test');
    expect(statements[1]).toContain('DO $$');
    expect(statements[1]).toContain("RAISE NOTICE 'Hello; world'");
    expect(statements[2]).toContain('ALTER TABLE public.test ADD COLUMN name TEXT');
  });

  it('switches to resilient statement-by-statement mode if transaction encounters ownership notice', async () => {
    const executedStmts: string[] = [];
    const mockClient = {
      query: vi.fn(async (query: string) => {
        if (query === 'BEGIN') return;
        if (query.includes('CREATE TABLE IF NOT EXISTS public._migrations')) return { rows: [] };
        if (query.includes('SELECT id FROM public._migrations')) return { rows: [] };
        if (query.includes('INSERT INTO public._migrations')) return { rows: [] };
        if (query === 'ROLLBACK') return;

        // Simulate failing on full batch transaction
        if (query.includes('create table if not exists auth.users') && query.length > 500) {
          throw new Error('must be owner of function handle_new_user');
        }

        executedStmts.push(query.substring(0, 40));
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any;

    const result = await runPendingMigrations(mockPool);
    expect(result.errors).toHaveLength(0);
    expect(result.applied.length).toBeGreaterThanOrEqual(10);
    expect(mockClient.release).toHaveBeenCalled();
  });
});
