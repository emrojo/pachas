import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAppVersionInfo } from './version';

describe('App Version and Deployment Metadata', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns valid default version info when env vars are not set', () => {
    delete process.env.NEXT_PUBLIC_GIT_COMMIT;
    delete process.env.GIT_COMMIT;
    delete process.env.NEXT_PUBLIC_BUILD_TIME;

    const info = getAppVersionInfo();
    expect(info).toBeDefined();
    expect(info.shortCommit).toBeDefined();
    expect(info.buildTime).toBeDefined();
    expect(info.formattedBuildDate).toBeDefined();
    expect(info.environment).toBeDefined();
  });

  it('correctly reads and truncates commit hash from NEXT_PUBLIC_GIT_COMMIT', () => {
    process.env.NEXT_PUBLIC_GIT_COMMIT = '48f719a6ebe75659141e2dff2ee943d5946f7be8';
    process.env.NEXT_PUBLIC_BUILD_TIME = '2026-09-12T11:15:12.000Z';

    const info = getAppVersionInfo();
    expect(info.commit).toBe('48f719a6ebe75659141e2dff2ee943d5946f7be8');
    expect(info.shortCommit).toBe('48f719a');
    expect(info.buildTime).toBe('2026-09-12T11:15:12.000Z');
    expect(info.githubCommitUrl).toBe('https://github.com/emrojo/pachas/commit/48f719a6ebe75659141e2dff2ee943d5946f7be8');
  });

  it('handles dev fallback without generating a broken GitHub commit URL', () => {
    process.env.NEXT_PUBLIC_GIT_COMMIT = 'dev';

    const info = getAppVersionInfo();
    expect(info.commit).toBe('dev');
    expect(info.shortCommit).toBe('dev');
    expect(info.githubCommitUrl).toBeNull();
  });
});
