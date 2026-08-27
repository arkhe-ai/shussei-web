/**
 * Environment access helpers.
 *
 * `process.env.NEXT_PUBLIC_*` is read inline (never cached in a module-level
 * constant) so Next can statically inline it in the client bundle and so tests
 * can override it with `vi.stubEnv`.
 */
export const API_BASE_URL_FALLBACK = 'http://localhost:3001';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? API_BASE_URL_FALLBACK;
}

/**
 * False when the build ran without NEXT_PUBLIC_API_BASE_URL. This matters
 * because the value is inlined at build time: the client then points every
 * request — including the Google login link — at the *visitor's* own
 * localhost:3001, which looks like the app ignoring the configured address.
 */
export function isApiBaseUrlConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
}

/**
 * Mock mode runs the whole client without `shussei-api`: fake session, channels,
 * ephemeral chat, presence and a simulated voice room.
 */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_MOCK === '1';
}
