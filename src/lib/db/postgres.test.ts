import { describe, it, expect } from 'vitest';
import { parseDatabaseConfig } from './postgres';

describe('PostgreSQL Connection Parser', () => {
  it('parses discrete environment variables', () => {
    const config = parseDatabaseConfig(undefined, {
      POSTGRES_USER: 'pachas_admin',
      POSTGRES_PASSWORD: 'complex@password#with$special%chars',
      POSTGRES_HOST: '127.0.0.1',
      POSTGRES_PORT: '5432',
      POSTGRES_DB: 'pachas_prod',
    } as any);

    expect(config).toEqual({
      user: 'pachas_admin',
      password: 'complex@password#with$special%chars',
      host: '127.0.0.1',
      port: 5432,
      database: 'pachas_prod',
    });
  });

  it('parses DATABASE_URL with unencoded @ in password', () => {
    const url = 'postgresql://pachas_prod_admin:CoWhgA_X(@u7$K9!P@j9D(Un~lzW@localhost:5432/pachas_db';
    const config = parseDatabaseConfig(url, {} as any);

    expect(config).toEqual({
      user: 'pachas_prod_admin',
      password: 'CoWhgA_X(@u7$K9!P@j9D(Un~lzW',
      host: 'localhost',
      port: 5432,
      database: 'pachas_db',
    });
  });

  it('parses standard DATABASE_URL', () => {
    const url = 'postgresql://admin:secret123@db.internal:5432/pachas';
    const config = parseDatabaseConfig(url, {} as any);

    expect(config).toEqual({
      user: 'admin',
      password: 'secret123',
      host: 'db.internal',
      port: 5432,
      database: 'pachas',
    });
  });
});
