'use client';

import { useCallback, useEffect, useState } from 'react';
import { type AudioDevice, listAudioDevices } from '../lib/audio-devices';

/**
 * The machine's audio hardware, refreshed when it changes.
 *
 * Enumeration is deliberately not run on mount: before any permission is held
 * the browser returns unlabelled placeholder entries, so the picker is only
 * worth filling in once the user is actually in a room.
 */
export function useAudioDevices(enabled: boolean): {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  refresh: () => void;
} {
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);

  const refresh = useCallback(() => {
    void listAudioDevices().then(({ inputs: nextInputs, outputs: nextOutputs }) => {
      setInputs(nextInputs);
      setOutputs(nextOutputs);
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    refresh();

    const target = navigator.mediaDevices;
    if (!target?.addEventListener) return;

    target.addEventListener('devicechange', refresh);
    return () => target.removeEventListener('devicechange', refresh);
  }, [enabled, refresh]);

  return { inputs, outputs, refresh };
}
