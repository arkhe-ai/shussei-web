'use client';

import type { Room } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LevelMeter, createLevelMeter } from '../lib/audio-level';
import { DEFAULT_DEVICE_ID } from '../lib/audio-devices';
import { isMockMode, isMockTrafficEnabled } from '../lib/env';
import {
  type MediaFeed,
  ROOM_EVENTS,
  connectToVoiceRoom,
  disconnectFromVoiceRoom,
  feedsChanged,
  participantsChanged,
  readAudioFeeds,
  readParticipants,
  readScreenFeeds,
  resumeRoomAudio,
  setMicrophoneEnabled,
  startScreenShare,
  stopScreenShare,
  switchAudioInput,
} from '../lib/livekit';
import {
  PREF_INPUT_DEVICE,
  PREF_OUTPUT_DEVICE,
  PREF_TALK_MODE,
  PREF_VOLUMES,
  readJson,
  readString,
  writeJson,
  writeString,
} from '../lib/prefs';
import { createMockScreenFeed } from '../lib/mock/mock-screen';
import { getAppSocket } from '../lib/socket';
import type { MicStatus, ScreenShareMode, TalkMode, VoiceParticipant } from '../lib/types';

/** Minimal emitter view of Room, so a single handler can cover every event. */
type RoomEmitter = {
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
};

const POLL_INTERVAL_MS = 120;

function describeVoiceError(cause: unknown): string {
  const name = cause instanceof Error ? cause.name : '';
  const message = cause instanceof Error ? cause.message : String(cause);

  if (name === 'NotAllowedError' || message.includes('Permission denied')) {
    return 'Permissão de microfone negada. Libere o microfone para este site nas configurações do navegador e tente de novo.';
  }

  if (name === 'NotFoundError') {
    return 'Nenhum microfone encontrado neste dispositivo.';
  }

  if (message.startsWith('api_error:403')) {
    return 'Você não tem acesso a este canal de voz.';
  }

  return 'Não foi possível conectar ao canal de voz. Verifique sua rede e tente de novo.';
}

/**
 * Mock mode has no SFU reporting levels for other people, so remote rows pulse
 * on a per-id sine wave. Local level is always the real microphone.
 */
function simulatedLevel(id: string, tick: number): number {
  const seed = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  const wave = Math.sin(tick / 6 + seed);
  return wave > 0.55 ? (wave - 0.55) / 0.45 : 0;
}

export type VoiceRoom = {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSharingScreen: boolean;
  /** True while the microphone is actually open, mute/deafen/PTT considered. */
  isTransmitting: boolean;
  talkMode: TalkMode;
  micStatus: MicStatus;
  micLevel: number;
  micWarning: string | null;
  participants: VoiceParticipant[];
  screenFeeds: MediaFeed[];
  audioFeeds: MediaFeed[];
  connectedChannelId: string | null;
  error: string | null;
  inputDeviceId: string;
  outputDeviceId: string;
  volumes: Record<string, number>;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
  setTalkMode: (mode: TalkMode) => void;
  setPushToTalk: (held: boolean) => void;
  selectInputDevice: (deviceId: string) => Promise<void>;
  selectOutputDevice: (deviceId: string) => void;
  setParticipantVolume: (participantId: string, volume: number) => void;
  startShare: () => Promise<ScreenShareMode>;
  stopShare: () => Promise<void>;
};

export function useVoiceRoom(
  channelId: string | null,
  options: { fallbackParticipants?: VoiceParticipant[]; selfId?: string } = {},
): VoiceRoom {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isPushHeld, setIsPushHeld] = useState(false);
  const [talkMode, setTalkModeState] = useState<TalkMode>('open');
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [roomParticipants, setRoomParticipants] = useState<VoiceParticipant[]>([]);
  const [screenFeeds, setScreenFeeds] = useState<MediaFeed[]>([]);
  const [mockRemoteFeeds, setMockRemoteFeeds] = useState<MediaFeed[]>([]);
  const [audioFeeds, setAudioFeeds] = useState<MediaFeed[]>([]);
  const [connectedChannelId, setConnectedChannelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [isMicAvailable, setIsMicAvailable] = useState(true);
  const [inputDeviceId, setInputDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [outputDeviceId, setOutputDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const mockScreenStreamRef = useRef<MediaStream | null>(null);
  const mockRemoteStopsRef = useRef<Array<() => void>>([]);
  const mockMicStreamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<LevelMeter | null>(null);
  const fallbackRef = useRef<VoiceParticipant[]>(options.fallbackParticipants ?? []);
  const appliedMicRef = useRef<boolean | null>(null);

  roomRef.current = room;
  fallbackRef.current = options.fallbackParticipants ?? [];

  // Read on mount only: localStorage is unavailable during SSR, so seeding
  // these through useState would desync hydration.
  useEffect(() => {
    setTalkModeState(readString(PREF_TALK_MODE) === 'ptt' ? 'ptt' : 'open');
    setInputDeviceId(readString(PREF_INPUT_DEVICE) ?? DEFAULT_DEVICE_ID);
    setOutputDeviceId(readString(PREF_OUTPUT_DEVICE) ?? DEFAULT_DEVICE_ID);
    setVolumes(readJson<Record<string, number>>(PREF_VOLUMES, {}));
  }, []);

  /**
   * The single rule for whether the microphone is open. Mute, deafen and
   * push-to-talk are three independent reasons to close it, so they are
   * resolved once here instead of each one writing to the device itself.
   */
  const isTransmitting =
    isConnected && isMicAvailable && !isMuted && !isDeafened && (talkMode === 'open' || isPushHeld);

  const stopMockShare = useCallback(() => {
    mockScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
    mockScreenStreamRef.current = null;
    setScreenFeeds([]);
    setIsSharingScreen(false);
  }, []);

  /** Other people's fake shares; see `lib/mock/mock-screen.ts`. */
  const stopMockRemoteShares = useCallback(() => {
    mockRemoteStopsRef.current.splice(0).forEach((stop) => stop());
    setMockRemoteFeeds([]);
  }, []);

  const stopMockMic = useCallback(() => {
    meterRef.current?.stop();
    meterRef.current = null;
    mockMicStreamRef.current?.getTracks().forEach((track) => track.stop());
    mockMicStreamRef.current = null;
    setMicLevel(0);
  }, []);

  // Hardware follows the rule above. Guarded by the last applied value so the
  // level poll cannot spam LiveKit with redundant publishes.
  useEffect(() => {
    if (!isConnected) {
      appliedMicRef.current = null;
      return;
    }

    if (appliedMicRef.current === isTransmitting) return;
    appliedMicRef.current = isTransmitting;

    if (isMockMode()) {
      mockMicStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = isTransmitting;
      });
      return;
    }

    if (room) {
      void setMicrophoneEnabled(room, isTransmitting);
    }
  }, [isConnected, isTransmitting, room]);

  useEffect(() => {
    if (!room) return;

    const emitter = room as unknown as RoomEmitter;

    const sync = () => {
      setRoomParticipants((current) => {
        const next = readParticipants(room);
        return participantsChanged(current, next) ? next : current;
      });
      setIsSharingScreen(room.localParticipant.isScreenShareEnabled);
      setScreenFeeds((current) => {
        const next = readScreenFeeds(room);
        return feedsChanged(current, next) ? next : current;
      });
      setAudioFeeds((current) => {
        const next = readAudioFeeds(room);
        return feedsChanged(current, next) ? next : current;
      });
    };

    const handleDisconnected = () => {
      setRoom(null);
      setIsConnected(false);
      setRoomParticipants([]);
      setScreenFeeds([]);
      setAudioFeeds([]);
      setIsSharingScreen(false);
      setConnectedChannelId(null);
    };

    for (const event of ROOM_EVENTS) {
      emitter.on(event, sync);
    }
    emitter.on('disconnected', handleDisconnected);
    sync();

    return () => {
      for (const event of ROOM_EVENTS) {
        emitter.off(event, sync);
      }
      emitter.off('disconnected', handleDisconnected);
    };
  }, [room]);

  // Levels are polled: LiveKit updates `audioLevel` continuously but does not
  // emit an event per frame, and the mock meter has no events at all.
  useEffect(() => {
    if (!isConnected) return;

    const id = window.setInterval(() => {
      setTick((current) => current + 1);

      if (room) {
        setMicLevel(room.localParticipant.audioLevel);
        setRoomParticipants((current) => {
          const next = readParticipants(room);
          return participantsChanged(current, next) ? next : current;
        });
        return;
      }

      setMicLevel(meterRef.current?.level() ?? 0);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [isConnected, room]);

  // Leaving the app should not keep a room or a capture running.
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        disconnectFromVoiceRoom(roomRef.current);
      }
      meterRef.current?.stop();
      mockScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
      mockMicStreamRef.current?.getTracks().forEach((track) => track.stop());
      mockRemoteStopsRef.current.splice(0).forEach((stop) => stop());
    };
  }, []);

  /** Opens the real microphone in mock mode, honouring the chosen input. */
  const openMockMic = useCallback(
    async (deviceId: string) => {
      stopMockMic();

      const constraint: MediaTrackConstraints =
        deviceId === DEFAULT_DEVICE_ID ? {} : { deviceId: { exact: deviceId } };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraint });
      mockMicStreamRef.current = stream;
      meterRef.current = createLevelMeter(stream);
    },
    [stopMockMic],
  );

  const join = useCallback(async () => {
    if (!channelId || isConnecting || isConnected) return;

    setError(null);
    setMicWarning(null);
    setIsConnecting(true);
    appliedMicRef.current = null;

    try {
      if (isMockMode()) {
        // Still asks for the real microphone: the level meter and the denied
        // permission path are exactly what this mode exists to exercise.
        try {
          await openMockMic(inputDeviceId);
          setIsMicAvailable(true);
        } catch (cause) {
          setIsMicAvailable(false);
          setMicWarning(describeVoiceError(cause));
        }

        if (isMockTrafficEnabled()) {
          const simulated = [
            createMockScreenFeed('u-ana', 'ana', 1),
            createMockScreenFeed('u-caio', 'caio', 2),
          ];
          mockRemoteStopsRef.current = simulated.map((entry) => entry.stop);
          setMockRemoteFeeds(simulated.map((entry) => entry.feed));
        }
      } else {
        const connection = await connectToVoiceRoom(channelId);
        await resumeRoomAudio(connection.room);
        if (inputDeviceId !== DEFAULT_DEVICE_ID) {
          await switchAudioInput(connection.room, inputDeviceId);
        }
        setRoom(connection.room);
        setIsMicAvailable(true);
      }

      setIsMuted(false);
      setIsConnected(true);
      setConnectedChannelId(channelId);
      getAppSocket().emit('voice.join', { channelId });
    } catch (cause) {
      setError(describeVoiceError(cause));
    } finally {
      setIsConnecting(false);
    }
  }, [channelId, inputDeviceId, isConnected, isConnecting, openMockMic]);

  const leave = useCallback(async () => {
    const leavingChannelId = connectedChannelId;

    if (room) {
      disconnectFromVoiceRoom(room);
    }
    stopMockShare();
    stopMockMic();
    stopMockRemoteShares();

    setRoom(null);
    setIsConnected(false);
    setRoomParticipants([]);
    setAudioFeeds([]);
    setConnectedChannelId(null);
    setError(null);
    setMicWarning(null);
    setIsPushHeld(false);
    appliedMicRef.current = null;

    if (leavingChannelId) {
      getAppSocket().emit('voice.leave', { channelId: leavingChannelId });
    }
  }, [connectedChannelId, room, stopMockMic, stopMockRemoteShares, stopMockShare]);

  const toggleMute = useCallback(async () => {
    setIsMuted((current) => {
      // Unmuting while deafened is what a user means by "let me back in".
      if (current) setIsDeafened(false);
      return !current;
    });
  }, []);

  const toggleDeafen = useCallback(() => {
    setIsDeafened((current) => !current);
  }, []);

  const setTalkMode = useCallback((mode: TalkMode) => {
    setTalkModeState(mode);
    setIsPushHeld(false);
    writeString(PREF_TALK_MODE, mode);
  }, []);

  const setPushToTalk = useCallback((held: boolean) => {
    setIsPushHeld(held);
  }, []);

  const selectInputDevice = useCallback(
    async (deviceId: string) => {
      setInputDeviceId(deviceId);
      writeString(PREF_INPUT_DEVICE, deviceId);

      if (!isConnected) return;

      try {
        if (isMockMode()) {
          await openMockMic(deviceId);
          // The freshly opened track ignores the current gate until reapplied.
          appliedMicRef.current = null;
          setIsMicAvailable(true);
        } else if (room) {
          await switchAudioInput(room, deviceId);
        }
        setMicWarning(null);
      } catch (cause) {
        setMicWarning(describeVoiceError(cause));
      }
    },
    [isConnected, openMockMic, room],
  );

  const selectOutputDevice = useCallback((deviceId: string) => {
    setOutputDeviceId(deviceId);
    writeString(PREF_OUTPUT_DEVICE, deviceId);
  }, []);

  const setParticipantVolume = useCallback((participantId: string, volume: number) => {
    setVolumes((current) => {
      const next = { ...current, [participantId]: Math.max(0, Math.min(1, volume)) };
      writeJson(PREF_VOLUMES, next);
      return next;
    });
  }, []);

  const startShare = useCallback(async (): Promise<ScreenShareMode> => {
    if (isMockMode()) {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      mockScreenStreamRef.current = stream;

      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopMockShare());

      setScreenFeeds([
        {
          id: 'mock-screen',
          participantId: options.selfId ?? 'self',
          participantName: 'voce',
          isLocal: true,
          attach: (element) => {
            element.srcObject = stream;
            element.play?.().catch(() => {});
          },
          detach: (element) => {
            element.srcObject = null;
          },
        },
      ]);
      setIsSharingScreen(true);

      return stream.getAudioTracks().length > 0 ? 'screen+audio' : 'screen-only';
    }

    if (!room) return 'screen-only';

    const mode = await startScreenShare(room);
    setIsSharingScreen(true);
    return mode;
  }, [options.selfId, room, stopMockShare]);

  const stopShare = useCallback(async () => {
    if (isMockMode()) {
      stopMockShare();
      return;
    }

    if (!room) return;

    await stopScreenShare(room);
    setIsSharingScreen(false);
  }, [room, stopMockShare]);

  const micStatus: MicStatus = !isConnected
    ? 'idle'
    : !isMicAvailable
      ? 'unavailable'
      : isTransmitting
        ? 'live'
        : 'muted';

  const participants = useMemo<VoiceParticipant[]>(() => {
    if (roomParticipants.length > 0) return roomParticipants;

    const selfId = options.selfId;
    return fallbackRef.current.map((participant) => {
      const isSelf = participant.id === selfId;
      const level = isSelf
        ? isTransmitting
          ? micLevel
          : 0
        : isConnected && !isDeafened
          ? simulatedLevel(participant.id, tick)
          : 0;

      return {
        ...participant,
        audioLevel: level,
        isSpeaking: level > 0.12,
        isMuted: isSelf ? !isTransmitting : participant.isMuted,
        isSharingScreen: isSelf ? isSharingScreen : participant.isSharingScreen,
      };
    });
    // `tick` drives the simulated levels; fallbackRef is read fresh on purpose.
  }, [
    isConnected,
    isDeafened,
    isSharingScreen,
    isTransmitting,
    micLevel,
    options.selfId,
    roomParticipants,
    tick,
  ]);

  return {
    isConnected,
    isConnecting,
    isMuted,
    isDeafened,
    isSharingScreen,
    isTransmitting,
    talkMode,
    micStatus,
    micLevel: isTransmitting ? micLevel : 0,
    micWarning,
    participants,
    screenFeeds: isMockMode() ? [...mockRemoteFeeds, ...screenFeeds] : screenFeeds,
    audioFeeds,
    connectedChannelId,
    error,
    inputDeviceId,
    outputDeviceId,
    volumes,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    setTalkMode,
    setPushToTalk,
    selectInputDevice,
    selectOutputDevice,
    setParticipantVolume,
    startShare,
    stopShare,
  };
}
