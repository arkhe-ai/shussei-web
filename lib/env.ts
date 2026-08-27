/**
 * Environment access helpers.
 *
 * `process.env.NEXT_PUBLIC_*` is read inline (never cached in a module-level
 * constant) so Next can statically inline it in the client bundle and so tests
 * can override it with `vi.stubEnv`.
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
}

/**
 * Mock mode runs the whole client without `shussei-api`: fake session, channels,
 * ephemeral chat, presence and a simulated voice room.
 */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_MOCK === '1';
}
