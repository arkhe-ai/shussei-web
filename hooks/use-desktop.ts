'use client';

import { useEffect, useRef, useState } from 'react';
import {
  drawBadge,
  getDesktop,
  type DesktopInfo,
  type DesktopVoiceState,
} from '../lib/desktop';
import { getApiBaseUrl } from '../lib/env';

export interface DesktopVoiceBinding extends DesktopVoiceState {
  setPushToTalk: (held: boolean) => void;
  toggleMute: () => void | Promise<void>;
  toggleDeafen: () => void;
  leave: () => void | Promise<void>;
}

/**
 * Wires the running app to its desktop host, and does nothing at all in a
 * browser.
 *
 * Three things cross the bridge: the global push-to-talk key coming in, the
 * tray's mute/deafen/disconnect commands coming in, and the voice state plus
 * unread badge going out.
 */
export function useDesktop(voice: DesktopVoiceBinding, unreadCount: number): DesktopInfo | null {
  const [info, setInfo] = useState<DesktopInfo | null>(null);

  /*
   * The voice room hands back a fresh object every render. Subscribing to it
   * directly would tear the IPC listeners down and rebuild them just as often,
   * and the teardown releases push-to-talk — which would drop the microphone
   * mid-sentence on any unrelated re-render. The listeners are registered once
   * and read the latest binding through this ref instead.
   */
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const { connected, muted, deafened, talkMode, channelName } = voice;

  useEffect(() => {
    const desktop = getDesktop();
    if (!desktop) return;

    let active = true;
    // The main process needs the backend's origin to let the Google sign-in
    // hop leave the app's own origin and come back.
    desktop
      .bootstrap({ apiBaseUrl: getApiBaseUrl() })
      .then((value) => {
        if (active) setInfo(value);
      })
      .catch(() => undefined);

    const releasePushToTalk = desktop.onPushToTalk((held) => voiceRef.current.setPushToTalk(held));

    const releaseCommands = desktop.onCommand((command) => {
      const current = voiceRef.current;
      if (command === 'toggle-mute') void current.toggleMute();
      if (command === 'toggle-deafen') current.toggleDeafen();
      if (command === 'leave-voice') void current.leave();
    });

    return () => {
      active = false;
      releasePushToTalk();
      releaseCommands();
      // Nothing is watching the key any more; never leave the mic open on it.
      voiceRef.current.setPushToTalk(false);
    };
  }, []);

  // Destructured above so the tray menu is only told about changes it shows.
  useEffect(() => {
    getDesktop()?.setVoiceState({ connected, muted, deafened, talkMode, channelName });
  }, [connected, muted, deafened, talkMode, channelName]);

  useEffect(() => {
    getDesktop()?.setBadge(unreadCount, drawBadge(unreadCount));
  }, [unreadCount]);

  return info;
}
