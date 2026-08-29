import { getApiBaseUrl, isMockMode } from './env';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`api_error:${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * `FormData` must not carry a hand-written `Content-Type`. The browser appends
 * the multipart boundary to that header itself, and a manual value arrives
 * without one, leaving the server a body it cannot split.
 */
function buildHeaders(init?: RequestInit): HeadersInit {
  const provided = init?.headers ?? {};
  const isMultipart = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  return isMultipart ? provided : { 'Content-Type': 'application/json', ...provided };
}

/**
 * A successful `DELETE` answers `204 No Content`. `response.json()` on an empty
 * body throws a `SyntaxError`, which no caller catches and which would surface
 * as a crash rather than as the `ApiError` the UI knows how to render.
 */
async function readBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;

  return JSON.parse(text) as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (isMockMode()) {
    const { mockApiFetch } = await import('./mock/mock-api');
    return mockApiFetch<T>(path, init);
  }

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init),
  });

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return readBody<T>(response);
}
