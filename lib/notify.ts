'use client';

import { PREF_SOUND, readFlag, writeFlag } from './prefs';

export type Cue = 'message' | 'join' | 'leave';

/**
 * Two-tone square blips instead of audio files: they match the terminal skin,
 * add nothing to the bundle, and cannot fail to load.
 */
const TONES: Record<Cue, [number, number]> = {
  message: [880, 1320],
  join: [660, 990],
  leave: [990, 660],
};

const PEAK_GAIN = 0.045;

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return null;

  context ??= new AudioContextCtor();
  // Autoplay policy parks the context until the page has been interacted with.
  if (context.state === 'suspended') void context.resume();

  return context;
}

export function isSoundEnabled(): boolean {
  return readFlag(PREF_SOUND, true);
}

export function setSoundEnabled(enabled: boolean): void {
  writeFlag(PREF_SOUND, enabled);
}

export function playCue(cue: Cue): void {
  if (!isSoundEnabled()) return;

  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  TONES[cue].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.value = frequency;

    const startAt = now + index * 0.07;
    // A square wave gated on/off clicks audibly; the ramp is what makes it a
    // blip rather than a pop.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, startAt + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.06);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.075);
  });
}

export type NotificationState = NotificationPermission | 'unsupported';

export function notificationState(): NotificationState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Must be called from a user gesture: browsers reject a bare prompt. */
export async function askNotificationPermission(): Promise<NotificationState> {
  if (notificationState() === 'unsupported') return 'unsupported';
  return Notification.requestPermission();
}

/**
 * Only worth showing when the tab is hidden — a notification for a message the
 * user is already looking at is noise.
 */
export function showMessageNotification(title: string, body: string): void {
  if (notificationState() !== 'granted') return;
  if (typeof document !== 'undefined' && !document.hidden) return;

  try {
    new Notification(title, { body, tag: 'shussei-chat', silent: true });
  } catch {
    // Some browsers only allow notifications from a service worker context.
  }
}
