'use client';

export type AudioDeviceKind = 'audioinput' | 'audiooutput';

export type AudioDevice = {
  deviceId: string;
  label: string;
  kind: AudioDeviceKind;
};

/** The browser's own "whatever the OS is using" entry. */
export const DEFAULT_DEVICE_ID = 'default';

function labelFor(device: MediaDeviceInfo, index: number): string {
  // Labels are blank until the page holds a media permission, which is exactly
  // the state a user is in before their first join.
  if (device.label) return device.label;
  return device.kind === 'audioinput' ? `entrada ${index + 1}` : `saída ${index + 1}`;
}

export async function listAudioDevices(): Promise<{
  inputs: AudioDevice[];
  outputs: AudioDevice[];
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();

  const pick = (kind: AudioDeviceKind): AudioDevice[] =>
    devices
      .filter((device) => device.kind === kind)
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: labelFor(device, index),
        kind,
      }));

  return { inputs: pick('audioinput'), outputs: pick('audiooutput') };
}

/**
 * Firefox and Safari still ship without `setSinkId`, so output selection has to
 * be hidden rather than offered and then silently ignored.
 */
export function supportsOutputSelection(): boolean {
  return typeof window !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}

type SinkCapable = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };

export async function applySinkId(element: HTMLMediaElement, deviceId: string): Promise<void> {
  const sinkable = element as SinkCapable;
  if (!sinkable.setSinkId) return;

  try {
    await sinkable.setSinkId(deviceId);
  } catch {
    // A device unplugged between enumeration and use: the element keeps the
    // system default, which is the right fallback anyway.
  }
}
