export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type ChannelDto = {
  id: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
};

export type EphemeralMessage = {
  id: string;
  channelId: string;
  author: SessionUser;
  body: string;
  sentAt: string;
};

export type PresenceSnapshot = {
  onlineUserIds: string[];
  channelOccupancy: Record<string, string[]>;
};

export type PresenceChange = {
  userId: string;
  status: 'online' | 'offline';
  channelId: string | null;
};

export type VoiceTokenResponse = {
  token: string;
  roomName: string;
  wsUrl: string;
};

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';

export type VoiceParticipant = {
  id: string;
  name: string;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isSharingScreen?: boolean;
  /** 0..1 loudness, used by the level bars. */
  audioLevel?: number;
  connectionQuality?: ConnectionQuality;
};

/** Why the microphone is or is not producing audio right now. */
export type MicStatus = 'idle' | 'live' | 'muted' | 'unavailable';

export type ScreenShareMode = 'screen+audio' | 'screen-only';

/**
 * How the microphone is gated while connected.
 * - `open`: the mic stays published until muted (the default).
 * - `ptt`: the mic is closed unless the push-to-talk key is held.
 */
export type TalkMode = 'open' | 'ptt';
