import { getApiBaseUrl, isMockMode } from './env';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`api_error:${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
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
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return response.json() as Promise<T>;
}
