import { describe, it, expect, vi } from 'vitest';
import { GET } from './route';

describe('Health Liveness Route (/api/health)', () => {
  it('returns HTTP 200 with healthy web status', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.services.web).toBe('healthy');
    expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(data.timestamp).toBeDefined();
  });
});
