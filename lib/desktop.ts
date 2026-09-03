/**
 * The desktop client's side of the bridge.
 *
 * Everything here is null-safe by construction: the same bundle is served to a
 * browser, where `window.shussei` simply does not exist, and every caller has
 * to keep working in that case.
 */

export type DesktopCommand = 'toggle-mute' | 'toggle-deafen' | 'leave-voice';

export interface DesktopVoiceState {
  connected: boolean;
  muted: boolean;
  deafened: boolean;
  talkMode: 'open' | 'ptt';
  channelName: string | null;
}

export interface DesktopInfo {
  version: string;
  platform: string;
  serverUrl: string;
  /** Label of the global push-to-talk key, e.g. "Ctrl direito". */
  pushToTalkLabel: string;
  pushToTalkEnabled: boolean;
  /** False when the native key hook is missing and push-to-talk is degraded. */
  globalHookAvailable: boolean;
}

export interface DesktopBridge {
  isDesktop: true;
  bootstrap(payload: { apiBaseUrl: string }): Promise<DesktopInfo>;
  onPushToTalk(listener: (held: boolean) => void): () => void;
  onCommand(listener: (command: DesktopCommand) => void): () => void;
  setVoiceState(state: DesktopVoiceState): void;
  setBadge(count: number, dataUrl: string | null): void;
}

declare global {
  interface Window {
    shussei?: DesktopBridge;
  }
}

export function getDesktop(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return window.shussei ?? null;
}

export function isDesktop(): boolean {
  return getDesktop() !== null;
}

const BADGE_SIZE = 32;

/**
 * Windows wants the taskbar badge as a bitmap, and the main process has no
 * canvas to draw one on — so it is drawn here and sent over as a data URL.
 */
export function drawBadge(count: number): string | null {
  if (count <= 0 || typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = BADGE_SIZE;
  canvas.height = BADGE_SIZE;

  const context = canvas.getContext('2d');
  if (!context) return null;

  const centre = BADGE_SIZE / 2;

  context.beginPath();
  context.arc(centre, centre, centre, 0, Math.PI * 2);
  context.fillStyle = '#ffab3d';
  context.fill();

  // Dark on amber: the overlay sits on the taskbar, whose own colour we do not
  // control, so the badge has to carry its own contrast.
  context.fillStyle = '#0a0705';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const label = count > 99 ? '99+' : String(count);
  context.font = `600 ${label.length > 2 ? 14 : 19}px ui-monospace, monospace`;
  context.fillText(label, centre, centre + 1);

  return canvas.toDataURL('image/png');
}
