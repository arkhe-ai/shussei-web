import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, HEAD } from '../../app/api/files/[fileId]/route';

/*
 * A stub rather than a real `Request`: the handler only ever reads
 * `headers.get`, and jsdom applies the fetch spec's forbidden-header list when
 * a Request is constructed, which silently drops `Range` — a restriction the
 * Node runtime this route runs on does not impose on inbound headers.
 */
function request(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

function params(fileId: string) {
  return { params: Promise.resolve({ fileId }) };
}

describe('files proxy', () => {
  let upstream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('forwards the session cookie, which is the whole point of the hop', async () => {
    upstream.mockResolvedValue(new Response('bytes', { status: 200 }));

    await GET(request({ cookie: 'shussei_session=abc' }), params('file-1'));

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/v1/files/file-1');
    expect((init.headers as Record<string, string>).cookie).toBe('shussei_session=abc');
  });

  it('prefers the server-side API address when one is configured', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api:3001');
    upstream.mockResolvedValue(new Response('bytes', { status: 200 }));

    await GET(request(), params('file-1'));

    expect(upstream.mock.calls[0][0]).toBe('http://api:3001/api/v1/files/file-1');
  });

  it('encodes the id instead of pasting it into the path', async () => {
    upstream.mockResolvedValue(new Response('bytes', { status: 200 }));

    await GET(request(), params('a/b'));

    expect(upstream.mock.calls[0][0]).toBe('http://localhost:3001/api/v1/files/a%2Fb');
  });

  it('carries Range up and the partial response back', async () => {
    upstream.mockResolvedValue(
      new Response('part', {
        status: 206,
        headers: {
          'content-type': 'video/mp4',
          'content-range': 'bytes 0-3/100',
          'content-length': '4',
          'accept-ranges': 'bytes',
        },
      }),
    );

    const response = await GET(request({ range: 'bytes=0-3' }), params('file-1'));

    expect((upstream.mock.calls[0][1].headers as Record<string, string>).range).toBe(
      'bytes=0-3',
    );
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-3/100');
    expect(response.headers.get('content-length')).toBe('4');
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
  });

  it.each([401, 404, 416])('passes status %i through untouched', async (status) => {
    upstream.mockResolvedValue(new Response(null, { status }));

    const response = await GET(request(), params('file-1'));

    expect(response.status).toBe(status);
  });

  it('answers a HEAD with headers and no body', async () => {
    upstream.mockResolvedValue(
      new Response('bytes', { status: 200, headers: { 'content-length': '5' } }),
    );

    const response = await HEAD(request(), params('file-1'));

    expect(upstream.mock.calls[0][1].method).toBe('HEAD');
    expect(response.headers.get('content-length')).toBe('5');
    expect(response.body).toBeNull();
  });

  it('drops hop-by-hop headers rather than relaying them', async () => {
    upstream.mockResolvedValue(
      new Response('bytes', {
        status: 200,
        headers: { 'content-type': 'image/png', 'x-powered-by': 'nest' },
      }),
    );

    const response = await GET(request(), params('file-1'));

    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it('reports an unreachable API as a gateway failure, not as a client error', async () => {
    upstream.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await GET(request(), params('file-1'));

    expect(response.status).toBe(502);
  });
});
