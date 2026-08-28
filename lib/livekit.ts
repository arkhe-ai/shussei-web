import {
  ConnectionQuality,
  type LocalTrack,
  Room,
  RoomEvent,
  Track,
  createLocalScreenTracks,
} from 'livekit-client';
import { apiFetch } from './api';
import type {
  ConnectionQuality as AppConnectionQuality,
  ScreenShareMode,
  VoiceParticipant,
  VoiceTokenResponse,
} from './types';

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

/**
 * Repoints the published microphone at another input device. LiveKit republishes
 * the track under the hood, so mute state and subscribers survive the switch.
 */
export async function switchAudioInput(room: Room, deviceId: string): Promise<void> {
  await room.switchActiveDevice('audioinput', deviceId);
}

export function disconnectFromVoiceRoom(room: Room): void {
  void room.disconnect();
}

function toQuality(quality: ConnectionQuality): AppConnectionQuality {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 'excellent';
    case ConnectionQuality.Good:
      return 'good';
    case ConnectionQuality.Poor:
      return 'poor';
    case ConnectionQuality.Lost:
      return 'lost';
    default:
      return 'unknown';
  }
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
    audioLevel: local.audioLevel,
    connectionQuality: toQuality(local.connectionQuality),
  };

  const remotes = [...room.remoteParticipants.values()].map((participant) => ({
    id: participant.identity,
    name: participant.name || participant.identity,
    isSpeaking: participant.isSpeaking,
    isMuted: !participant.isMicrophoneEnabled,
    isSharingScreen: participant.isScreenShareEnabled,
    audioLevel: participant.audioLevel,
    connectionQuality: toQuality(participant.connectionQuality),
  }));

  return [self, ...remotes];
}

/**
 * Levels and speaking flags change constantly; re-rendering on every poll would
 * thrash the list, so only meaningful changes count.
 */
export function participantsChanged(
  previous: VoiceParticipant[],
  next: VoiceParticipant[],
): boolean {
  if (previous.length !== next.length) return true;

  return next.some((participant, index) => {
    const before = previous[index];
    return (
      before.id !== participant.id ||
      before.isSpeaking !== participant.isSpeaking ||
      before.isMuted !== participant.isMuted ||
      before.isSharingScreen !== participant.isSharingScreen ||
      before.connectionQuality !== participant.connectionQuality ||
      Math.round((before.audioLevel ?? 0) * 20) !== Math.round((participant.audioLevel ?? 0) * 20)
    );
  });
}

export type ScreenShareResult = {
  mode: ScreenShareMode;
  /** Why the system audio did not make it, when the browser did hand one over. */
  audioError?: string;
};

/**
 * Publishes the selected screen, and its system audio when there is one.
 *
 * Capture and publish are separate steps rather than one
 * `setScreenShareEnabled(true, { audio: true })`, because that call publishes
 * both tracks together: an audio track the SFU rejects takes the whole
 * screen share down with it, and the room renegotiates. Here the picker still
 * opens once, the picture always goes out, and a failed audio publish is
 * reported instead of being fatal.
 */
export async function startScreenShare(room: Room): Promise<ScreenShareResult> {
  const tracks = await createLocalScreenTracks({ audio: true, systemAudio: 'include' });

  const video = tracks.find((track) => track.kind === Track.Kind.Video);
  const audio = tracks.find((track) => track.kind === Track.Kind.Audio);

  if (!video) {
    tracks.forEach((track) => track.stop());
    throw new Error('screen_share_no_video');
  }

  await room.localParticipant.publishTrack(video, { source: Track.Source.ScreenShare });

  // The browser's own "stop sharing" bar ends the track without telling us.
  video.mediaStreamTrack.addEventListener('ended', () => {
    void stopScreenShare(room);
  });

  if (!audio) {
    return { mode: 'screen-only' };
  }

  try {
    await room.localParticipant.publishTrack(audio, { source: Track.Source.ScreenShareAudio });
    return { mode: 'screen+audio' };
  } catch (cause) {
    audio.stop();
    return { mode: 'screen-only', audioError: describeCause(cause) };
  }
}

/** Keeps the raw failure legible; the UI shows it so it can be reported. */
function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.name && cause.name !== 'Error' ? `${cause.name}: ${cause.message}` : cause.message;
  }
  return String(cause);
}

export async function stopScreenShare(room: Room): Promise<void> {
  // Published by hand, so they have to come down by hand: disabling the screen
  // share only unpublishes what `setScreenShareEnabled` itself put up.
  const sources = [Track.Source.ScreenShare, Track.Source.ScreenShareAudio];

  for (const source of sources) {
    const publication = room.localParticipant.getTrackPublication(source);
    const track = publication?.track as LocalTrack | undefined;
    if (track) {
      await room.localParticipant.unpublishTrack(track, true);
    }
  }
}

/**
 * A playable track, normalised so the mock transport can produce one too.
 * `attach`/`detach` hand the track to a <video>/<audio> element.
 */
export type MediaFeed = {
  id: string;
  /** Matches the app user id, so per-participant volume can key off it. */
  participantId: string;
  participantName: string;
  isLocal: boolean;
  attach: (element: HTMLMediaElement) => void;
  detach: (element: HTMLMediaElement) => void;
};

function toFeed(
  publication: {
    trackSid: string;
    track?: { attach: (el: never) => void; detach: (el: never) => void } | null;
  },
  participant: { identity: string; name?: string },
  isLocal: boolean,
): MediaFeed | null {
  const track = publication.track;
  if (!track) return null;

  return {
    id: publication.trackSid,
    participantId: participant.identity,
    participantName: participant.name || participant.identity,
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
    const feed = toFeed(localScreen, local, true);
    if (feed) feeds.push(feed);
  }

  for (const participant of room.remoteParticipants.values()) {
    const publication = participant.getTrackPublication(Track.Source.ScreenShare);
    if (!publication) continue;
    const feed = toFeed(publication, participant, false);
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
      const feed = toFeed(publication, participant, false);
      if (feed) feeds.push(feed);
    }
  }

  return feeds;
}

/**
 * Whether a feed list actually describes something different.
 *
 * `readScreenFeeds`/`readAudioFeeds` mint fresh objects on every call, and they
 * are called on every room event. Without this, each sync hands React a new
 * array of new objects, every <video> re-attaches its track, and the picture
 * blinks — that is the flicker, and it is why the same guard already exists for
 * the participant list.
 */
export function feedsChanged(previous: MediaFeed[], next: MediaFeed[]): boolean {
  if (previous.length !== next.length) return true;

  return next.some((feed, index) => {
    const before = previous[index];
    return (
      before.id !== feed.id ||
      before.participantId !== feed.participantId ||
      before.participantName !== feed.participantName ||
      before.isLocal !== feed.isLocal
    );
  });
}

/** Resumes playback after browser autoplay policies block it. */
export async function resumeRoomAudio(room: Room): Promise<void> {
  if (room.canPlaybackAudio) return;
  await room.startAudio();
}
