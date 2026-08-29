import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';

/*
 * Real `Response` objects rather than `{ ok, json }` stand-ins: `apiFetch` reads
 * the body as text so it can tell an empty 204 from a JSON payload, and a
 * partial fake stops exercising the path the app actually takes.
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  it('prefixes requests with NEXT_PUBLIC_API_BASE_URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })));
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001');

    await apiFetch('/api/v1/health');

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/v1/health', expect.any(Object));
  });

  it('throws an ApiError carrying the http status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 403)));
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001');

    await expect(apiFetch('/api/v1/auth/me')).rejects.toMatchObject({ status: 403 });
  });
});
