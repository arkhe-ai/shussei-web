'use client';

import type { Room } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isMockMode } from '../lib/env';
import {
  type MediaFeed,
  ROOM_EVENTS,
  connectToVoiceRoom,
  disconnectFromVoiceRoom,
  readAudioFeeds,
  readParticipants,
  readScreenFeeds,
  resumeRoomAudio,
  setMicrophoneEnabled,
  startScreenShare,
  stopScreenShare,
} from '../lib/livekit';
import { getAppSocket } from '../lib/socket';
import type { ScreenShareMode, VoiceParticipant } from '../lib/types';

/** Minimal emitter view of Room, so a single handler can cover every event. */
type RoomEmitter = {
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
};

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

export function useVoiceRoom(channelId: string | null): {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isSharingScreen: boolean;
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
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [screenFeeds, setScreenFeeds] = useState<MediaFeed[]>([]);
  const [audioFeeds, setAudioFeeds] = useState<MediaFeed[]>([]);
  const [connectedChannelId, setConnectedChannelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const mockStreamRef = useRef<MediaStream | null>(null);

  roomRef.current = room;

  const stopMockShare = useCallback(() => {
    mockStreamRef.current?.getTracks().forEach((track) => track.stop());
    mockStreamRef.current = null;
    setScreenFeeds([]);
    setIsSharingScreen(false);
  }, []);

  useEffect(() => {
    if (!room) return;

    const emitter = room as unknown as RoomEmitter;

    const sync = () => {
      setParticipants(readParticipants(room));
      setIsMuted(!room.localParticipant.isMicrophoneEnabled);
      setIsSharingScreen(room.localParticipant.isScreenShareEnabled);
      setScreenFeeds(readScreenFeeds(room));
      setAudioFeeds(readAudioFeeds(room));
    };

    const handleDisconnected = () => {
      setRoom(null);
      setIsConnected(false);
      setParticipants([]);
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

  // Leaving the app should not keep a room or a capture running.
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        disconnectFromVoiceRoom(roomRef.current);
      }
      mockStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const join = useCallback(async () => {
    if (!channelId || isConnecting || isConnected) return;

    setError(null);
    setIsConnecting(true);

    try {
      if (isMockMode()) {
        setIsMuted(false);
      } else {
        const connection = await connectToVoiceRoom(channelId);
        await resumeRoomAudio(connection.room);
        setRoom(connection.room);
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

    setRoom(null);
    setIsConnected(false);
    setParticipants([]);
    setAudioFeeds([]);
    setConnectedChannelId(null);
    setError(null);

    if (leavingChannelId) {
      getAppSocket().emit('voice.leave', { channelId: leavingChannelId });
    }
  }, [connectedChannelId, room, stopMockShare]);

  const toggleMute = useCallback(async () => {
    if (isMockMode()) {
      setIsMuted((current) => !current);
      return;
    }

    if (!room) return;

    await setMicrophoneEnabled(room, isMuted);
    setIsMuted((current) => !current);
  }, [isMuted, room]);

  const startShare = useCallback(async (): Promise<ScreenShareMode> => {
    if (isMockMode()) {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      mockStreamRef.current = stream;

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

  return {
    isConnected,
    isConnecting,
    isMuted,
    isSharingScreen,
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
