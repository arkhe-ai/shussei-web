'use client';

import type { Room } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LevelMeter, createLevelMeter } from '../lib/audio-level';
import { isMockMode } from '../lib/env';
import {
  type MediaFeed,
  ROOM_EVENTS,
  connectToVoiceRoom,
  disconnectFromVoiceRoom,
  participantsChanged,
  readAudioFeeds,
  readParticipants,
  readScreenFeeds,
  resumeRoomAudio,
  setMicrophoneEnabled,
  startScreenShare,
  stopScreenShare,
} from '../lib/livekit';
import { getAppSocket } from '../lib/socket';
import type { MicStatus, ScreenShareMode, VoiceParticipant } from '../lib/types';

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

export function useVoiceRoom(
  channelId: string | null,
  options: { fallbackParticipants?: VoiceParticipant[]; selfId?: string } = {},
): {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isSharingScreen: boolean;
  micStatus: MicStatus;
  micLevel: number;
  micWarning: string | null;
  participants: VoiceParticipant[];
  screenFeeds: MediaFeed[];
  audioFeeds: MediaFeed[];
  connectedChannelId: string | null;
  error: string | null;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => Promise<void>;
  startShare: () => Promise<ScreenShareMode>;
  stopShare: () => Promise<void>;
} {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [roomParticipants, setRoomParticipants] = useState<VoiceParticipant[]>([]);
  const [screenFeeds, setScreenFeeds] = useState<MediaFeed[]>([]);
  const [audioFeeds, setAudioFeeds] = useState<MediaFeed[]>([]);
  const [connectedChannelId, setConnectedChannelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [isMicAvailable, setIsMicAvailable] = useState(true);
  const [tick, setTick] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const mockScreenStreamRef = useRef<MediaStream | null>(null);
  const mockMicStreamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<LevelMeter | null>(null);
  const fallbackRef = useRef<VoiceParticipant[]>(options.fallbackParticipants ?? []);

  roomRef.current = room;
  fallbackRef.current = options.fallbackParticipants ?? [];

  const stopMockShare = useCallback(() => {
    mockScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
    mockScreenStreamRef.current = null;
    setScreenFeeds([]);
    setIsSharingScreen(false);
  }, []);

  const stopMockMic = useCallback(() => {
    meterRef.current?.stop();
    meterRef.current = null;
    mockMicStreamRef.current?.getTracks().forEach((track) => track.stop());
    mockMicStreamRef.current = null;
    setMicLevel(0);
  }, []);

  useEffect(() => {
    if (!room) return;

    const emitter = room as unknown as RoomEmitter;

    const sync = () => {
      setRoomParticipants((current) => {
        const next = readParticipants(room);
        return participantsChanged(current, next) ? next : current;
      });
      setIsMuted(!room.localParticipant.isMicrophoneEnabled);
      setIsSharingScreen(room.localParticipant.isScreenShareEnabled);
      setScreenFeeds(readScreenFeeds(room));
      setAudioFeeds(readAudioFeeds(room));
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
    };
  }, []);

  const join = useCallback(async () => {
    if (!channelId || isConnecting || isConnected) return;

    setError(null);
    setMicWarning(null);
    setIsConnecting(true);

    try {
      if (isMockMode()) {
        // Still asks for the real microphone: the level meter and the denied
        // permission path are exactly what this mode exists to exercise.
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mockMicStreamRef.current = stream;
          meterRef.current = createLevelMeter(stream);
          setIsMicAvailable(true);
        } catch (cause) {
          setIsMicAvailable(false);
          setMicWarning(describeVoiceError(cause));
        }
        setIsMuted(false);
      } else {
        const connection = await connectToVoiceRoom(channelId);
        await resumeRoomAudio(connection.room);
        setRoom(connection.room);
        setIsMicAvailable(true);
        setIsMuted(!connection.room.localParticipant.isMicrophoneEnabled);
      }

      setIsConnected(true);
      setConnectedChannelId(channelId);
      getAppSocket().emit('voice.join', { channelId });
    } catch (cause) {
      setError(describeVoiceError(cause));
    } finally {
      setIsConnecting(false);
    }
  }, [channelId, isConnected, isConnecting]);

  const leave = useCallback(async () => {
    const leavingChannelId = connectedChannelId;

    if (room) {
      disconnectFromVoiceRoom(room);
    }
    stopMockShare();
    stopMockMic();

    setRoom(null);
    setIsConnected(false);
    setRoomParticipants([]);
    setAudioFeeds([]);
    setConnectedChannelId(null);
    setError(null);
    setMicWarning(null);

    if (leavingChannelId) {
      getAppSocket().emit('voice.leave', { channelId: leavingChannelId });
    }
  }, [connectedChannelId, room, stopMockMic, stopMockShare]);

  const toggleMute = useCallback(async () => {
    if (isMockMode()) {
      const nextMuted = !isMuted;
      // Actually gate the capture so the meter drops to zero when muted.
      mockMicStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
      setIsMuted(nextMuted);
      return;
    }

    if (!room) return;

    await setMicrophoneEnabled(room, isMuted);
    setIsMuted((current) => !current);
  }, [isMuted, room]);

  const startShare = useCallback(async (): Promise<ScreenShareMode> => {
    if (isMockMode()) {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      mockScreenStreamRef.current = stream;

      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopMockShare());

      setScreenFeeds([
        {
          id: 'mock-screen',
          participantName: 'voce',
          isLocal: true,
          attach: (element) => {
            element.srcObject = stream;
            void element.play?.();
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
  }, [room, stopMockShare]);

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
      : isMuted
        ? 'muted'
        : 'live';

  const participants = useMemo<VoiceParticipant[]>(() => {
    if (roomParticipants.length > 0) return roomParticipants;

    const selfId = options.selfId;
    return fallbackRef.current.map((participant) => {
      const isSelf = participant.id === selfId;
      const level = isSelf
        ? isMuted
          ? 0
          : micLevel
        : isConnected
          ? simulatedLevel(participant.id, tick)
          : 0;

      return {
        ...participant,
        audioLevel: level,
        isSpeaking: level > 0.12,
        isMuted: isSelf ? isMuted : participant.isMuted,
        isSharingScreen: isSelf ? isSharingScreen : participant.isSharingScreen,
      };
    });
    // `tick` drives the simulated levels; fallbackRef is read fresh on purpose.
  }, [isConnected, isMuted, isSharingScreen, micLevel, options.selfId, roomParticipants, tick]);

  return {
    isConnected,
    isConnecting,
    isMuted,
    isSharingScreen,
    micStatus,
    micLevel: isMuted ? 0 : micLevel,
    micWarning,
    participants,
    screenFeeds,
    audioFeeds,
    connectedChannelId,
    error,
    join,
    leave,
    toggleMute,
    startShare,
    stopShare,
  };
}
