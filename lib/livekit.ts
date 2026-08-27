import { Room, RoomEvent, Track } from 'livekit-client';
import { apiFetch } from './api';
import type { ScreenShareMode, VoiceParticipant, VoiceTokenResponse } from './types';

export const ROOM_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.ConnectionStateChanged,
] as const;

/**
 * Asks the backend for a room token and joins the matching LiveKit room with
 * the microphone published.
 *
 * Deviation from the plan: the mic is published through
 * `setMicrophoneEnabled(true)` instead of `createLocalAudioTrack` +
 * `publishTrack`, so that mute/unmute later acts on the very track LiveKit
 * manages. Publishing by hand and muting through the managed API can leave two
 * different tracks around.
 */
export async function connectToVoiceRoom(channelId: string): Promise<{
  room: Room;
  roomName: string;
}> {
  const { token, wsUrl, roomName } = await apiFetch<VoiceTokenResponse>(
    `/api/v1/channels/${channelId}/voice-token`,
    { method: 'POST' },
  );

  const room = new Room({ adaptiveStream: true, dynacast: true });
  await room.connect(wsUrl, token);
  await room.localParticipant.setMicrophoneEnabled(true);

  return { room, roomName };
}

export async function setMicrophoneEnabled(room: Room, enabled: boolean): Promise<void> {
  await room.localParticipant.setMicrophoneEnabled(enabled);
}

export function disconnectFromVoiceRoom(room: Room): void {
  void room.disconnect();
}

/** Snapshot of everyone currently in the room, local participant first. */
export function readParticipants(room: Room): VoiceParticipant[] {
  const local = room.localParticipant;

  const self: VoiceParticipant = {
    id: local.identity,
    name: local.name || local.identity,
    isSpeaking: local.isSpeaking,
    isMuted: !local.isMicrophoneEnabled,
    isSharingScreen: local.isScreenShareEnabled,
  };

  const remotes = [...room.remoteParticipants.values()].map((participant) => ({
    id: participant.identity,
    name: participant.name || participant.identity,
    isSpeaking: participant.isSpeaking,
    isMuted: !participant.isMicrophoneEnabled,
    isSharingScreen: participant.isScreenShareEnabled,
  }));

  return [self, ...remotes];
}

/**
 * Publishes the selected screen (and system audio when the browser hands it
 * over). Returns which of the two the user actually got, so the UI can explain
 * the fallback.
 */
export async function startScreenShare(room: Room): Promise<ScreenShareMode> {
  await room.localParticipant.setScreenShareEnabled(true, {
    audio: true,
    systemAudio: 'include',
  });

  const audioPublication = room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);

  return audioPublication ? 'screen+audio' : 'screen-only';
}

export async function stopScreenShare(room: Room): Promise<void> {
  await room.localParticipant.setScreenShareEnabled(false);
}

/**
 * A playable track, normalised so the mock transport can produce one too.
 * `attach`/`detach` hand the track to a <video>/<audio> element.
 */
export type MediaFeed = {
  id: string;
  participantName: string;
  isLocal: boolean;
  attach: (element: HTMLMediaElement) => void;
  detach: (element: HTMLMediaElement) => void;
};

function toFeed(
  publication: { trackSid: string; track?: { attach: (el: never) => void; detach: (el: never) => void } | null },
  participantName: string,
  isLocal: boolean,
): MediaFeed | null {
  const track = publication.track;
  if (!track) return null;

  return {
    id: publication.trackSid,
    participantName,
    isLocal,
    attach: (element) => track.attach(element as never),
    detach: (element) => track.detach(element as never),
  };
}

/** Every screen share currently published in the room, local one included. */
export function readScreenFeeds(room: Room): MediaFeed[] {
  const feeds: MediaFeed[] = [];

  const local = room.localParticipant;
  const localScreen = local.getTrackPublication(Track.Source.ScreenShare);
  if (localScreen) {
    const feed = toFeed(localScreen, local.name || local.identity, true);
    if (feed) feeds.push(feed);
  }

  for (const participant of room.remoteParticipants.values()) {
    const publication = participant.getTrackPublication(Track.Source.ScreenShare);
    if (!publication) continue;
    const feed = toFeed(publication, participant.name || participant.identity, false);
    if (feed) feeds.push(feed);
  }

  return feeds;
}

/**
 * Remote audio (microphones and shared system audio). LiveKit does not attach
 * these on its own, so the app has to render an element per feed or nobody
 * hears anything.
 */
export function readAudioFeeds(room: Room): MediaFeed[] {
  const feeds: MediaFeed[] = [];

  for (const participant of room.remoteParticipants.values()) {
    for (const source of [Track.Source.Microphone, Track.Source.ScreenShareAudio]) {
      const publication = participant.getTrackPublication(source);
      if (!publication) continue;
      const feed = toFeed(publication, participant.name || participant.identity, false);
      if (feed) feeds.push(feed);
    }
  }

  return feeds;
}

/** Resumes playback after browser autoplay policies block it. */
export async function resumeRoomAudio(room: Room): Promise<void> {
  if (room.canPlaybackAudio) return;
  await room.startAudio();
}
