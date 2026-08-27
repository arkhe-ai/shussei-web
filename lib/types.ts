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

export type VoiceParticipant = {
  id: string;
  name: string;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isSharingScreen?: boolean;
};

export type ScreenShareMode = 'screen+audio' | 'screen-only';
