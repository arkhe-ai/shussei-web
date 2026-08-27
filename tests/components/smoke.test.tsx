import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';

describe('apiFetch', () => {
  it('prefixes requests with NEXT_PUBLIC_API_BASE_URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001');

    await apiFetch('/api/v1/health');

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/v1/health', expect.any(Object));
  });

  it('throws an ApiError carrying the http status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001');

    await expect(apiFetch('/api/v1/auth/me')).rejects.toMatchObject({ status: 403 });
  });
});
