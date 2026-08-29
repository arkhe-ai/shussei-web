export type SpriteId =
  | 'aventureiro' | 'aventureira' | 'dev' | 'mago' | 'cavaleiro' | 'arqueiro'
  | 'gato' | 'cachorro' | 'raposa' | 'sapo' | 'robo' | 'pato'
  | 'alienigena' | 'dinossauro' | 'feiticeiro' | 'panda' | 'panda-vermelho' | 'androide'
  | 'paladino' | 'bruxa' | 'cacador' | 'clerigo' | 'diabinho' | 'mago-do-gelo';
export type UserSprites = Record<string, SpriteId | null>;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  spriteId?: SpriteId | null;
};

export type ChannelDto = {
  id: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
};

/** A durable folder inside a channel. `parentId: null` is the channel root. */
export type FolderDto = {
  id: string;
  channelId: string;
  parentId: string | null;
  name: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

/** A durable file. Outlives the ephemeral chat message that may reference it. */
export type StoredFileDto = {
  id: string;
  channelId: string;
  folderId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdByUserId: string;
  createdAt: string;
  downloadUrl: string;
};

/**
 * The slice of a stored file that travels with a chat message. Narrower than
 * `StoredFileDto` on purpose: a message carries what it needs to render, not
 * the file's placement in the folder tree, which can change under it.
 */
export type FileAttachmentDto = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  thumbnailUrl?: string;
};

/** One folder view. `folder` is null at the channel root, which has no record. */
export type FolderContents = {
  folder: FolderDto | null;
  folders: FolderDto[];
  files: StoredFileDto[];
};

export type EphemeralMessage = {
  id: string;
  channelId: string;
  author: SessionUser;
  body: string;
  sentAt: string;
  /**
   * Optional so text-only messages, and entries already sitting in the Redis
   * buffer from before attachments existed, stay valid.
   */
  attachments?: FileAttachmentDto[];
};

export type PresenceSnapshot = {
  onlineUserIds: string[];
  channelOccupancy: Record<string, string[]>;
  userSprites?: UserSprites;
};

export type PresenceSpriteChange = {
  userId: string;
  spriteId: SpriteId | null;
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
