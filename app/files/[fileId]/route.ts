import type { NextRequest } from 'next/server';

/**
 * Same-origin proxy for stored files.
 *
 * The session cookie is `httpOnly; SameSite=Lax`. With the client on `app.*`
 * and the API on `api.*`, an `<img src="https://api.../files/:id">` is a
 * cross-site request, so the browser sends no cookie and the API answers 401 —
 * in production only, because on localhost the two are same-site and the
 * problem never shows. Routing every read through this handler makes the
 * request same-origin, so the cookie rides along as it always did.
 *
 * Range is forwarded both ways so a browser can still seek in an audio or
 * video file instead of downloading it whole to scrub.
 *
 * Deliberately NOT under `/api`. The dev reverse proxy hands the whole
 * `/api/*` namespace to the backend before the app is ever consulted
 * (`shussei-infra/caddy/Caddyfile.dev`), so a proxy living there is swallowed
 * and answered with the API's own 404. Any deployment that puts client and API
 * behind a single host has the same shape, so this route stays out of it.
 */
export const dynamic = 'force-dynamic';

/**
 * Headers worth passing back. Anything not listed is dropped rather than
 * relayed blindly: hop-by-hop headers (`connection`, `transfer-encoding`)
 * describe the upstream connection, not this one, and copying them corrupts
 * the response.
 */
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'content-disposition',
  'etag',
  'last-modified',
  'cache-control',
];

/**
 * Server-side address of the API. `NEXT_PUBLIC_API_BASE_URL` is the address the
 * *browser* must reach; inside a container the API is often somewhere else
 * entirely, so `API_INTERNAL_URL` can override it without touching the bundle.
 */
function upstreamBase(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:3001'
  );
}

async function proxy(request: NextRequest, fileId: string, method: 'GET' | 'HEAD') {
  /*
   * A plain record rather than a `Headers` instance: `Range` is a forbidden
   * header name under the fetch spec, and any environment that enforces that
   * list drops it silently on a `Headers` object. Forwarding it is the whole
   * point of accepting it, so it must not depend on which implementation of
   * `Headers` happens to be in scope.
   */
  const headers: Record<string, string> = {};

  const cookie = request.headers.get('cookie');
  if (cookie) headers.cookie = cookie;

  const range = request.headers.get('range');
  if (range) headers.range = range;

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch) headers['if-none-match'] = ifNoneMatch;

  let upstream: Response;
  try {
    upstream = await fetch(`${upstreamBase()}/api/v1/files/${encodeURIComponent(fileId)}`, {
      method,
      headers,
      // A redirect answered here would be followed by the browser against this
      // origin, where the target does not exist.
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    // The API being unreachable is this gateway's problem, not the client's.
    return new Response(null, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  // 204/304 and every HEAD must answer without a body, or the response is
  // malformed regardless of what the upstream sent.
  const isBodyless = method === 'HEAD' || upstream.status === 204 || upstream.status === 304;

  return new Response(isBodyless ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  return proxy(request, fileId, 'GET');
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  return proxy(request, fileId, 'HEAD');
}
