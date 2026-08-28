/**
 * Per-device preferences: notification sound, talk mode, chosen audio devices
 * and per-participant volume.
 *
 * These are deliberately local and not part of the session. They describe this
 * machine's hardware and this room's noise level, so syncing them to the
 * account would be wrong — the same user on a laptop and on a desktop wants
 * different answers.
 */
const PREFIX = 'shussei:';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    // Private windows and "block site data" both throw on access.
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Nothing here is worth breaking a click over.
  }
}

export function readFlag(key: string, fallback: boolean): boolean {
  const stored = read(key);
  return stored === null ? fallback : stored === '1';
}

export function writeFlag(key: string, value: boolean): void {
  write(key, value ? '1' : '0');
}

export function readString(key: string): string | null {
  return read(key);
}

export function writeString(key: string, value: string): void {
  write(key, value);
}

export function readJson<T>(key: string, fallback: T): T {
  const stored = read(key);
  if (stored === null) return fallback;

  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  write(key, JSON.stringify(value));
}

export const PREF_SOUND = 'sound';
export const PREF_TALK_MODE = 'talk-mode';
export const PREF_INPUT_DEVICE = 'device-input';
export const PREF_OUTPUT_DEVICE = 'device-output';
export const PREF_VOLUMES = 'volumes';
export const PREF_SPRITE = 'sprite';
