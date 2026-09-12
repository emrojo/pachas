import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('Version API Route (/api/version)', () => {
  it('returns HTTP 200 with deployment version metadata', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.app).toBe('Pachas');
    expect(data.version).toBe('0.1.0');
    expect(data.commit).toBeDefined();
    expect(data.shortCommit).toBeDefined();
    expect(data.deployedAt).toBeDefined();
    expect(data.environment).toBeDefined();
    expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
