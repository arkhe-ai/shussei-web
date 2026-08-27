import { apiFetch } from './api';
import { getApiBaseUrl, isMockMode } from './env';
import type { SessionUser } from './types';

/**
 * Entry point of the backend Google OAuth flow. `shussei-api` is expected to
 * redirect back to `/channels` on success and `/access-denied` when the email
 * is not on the allowlist.
 */
export function buildGoogleLoginUrl() {
  if (isMockMode()) {
    return '/channels';
  }

  return `${getApiBaseUrl()}/api/v1/auth/google`;
}

export function buildLogoutUrl() {
  if (isMockMode()) {
    return '/login';
  }

  return `${getApiBaseUrl()}/api/v1/auth/logout`;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const data = await apiFetch<{ user: SessionUser | null }>('/api/v1/auth/me');
  return data.user;
}
