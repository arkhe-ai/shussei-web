import type {
  ChannelDto,
  EphemeralMessage,
  FileAttachmentDto,
  FolderDto,
  SessionUser,
  StoredFileDto,
} from '../types';

/*
 * `avatarUrl` stays null across the board: people are drawn as pixel characters
 * derived from their user id (`lib/sprites.ts`), so the field is carried for
 * the API contract but never rendered. See README, "Bonecos".
 */
export const mockSessionUser: SessionUser = {
  id: 'u-you',
  email: 'voce@shussei.dev',
  name: 'voce',
  avatarUrl: null,
};

export const mockUsers: SessionUser[] = [
  mockSessionUser,
  { id: 'u-ana', email: 'ana@shussei.dev', name: 'ana', avatarUrl: null },
  { id: 'u-caio', email: 'caio@shussei.dev', name: 'caio', avatarUrl: null },
  { id: 'u-dani', email: 'dani@shussei.dev', name: 'dani', avatarUrl: null },
  { id: 'u-edu', email: 'edu@shussei.dev', name: 'edu', avatarUrl: null },
];

export const mockChannels: ChannelDto[] = [
  { id: 'text-geral', name: 'geral', type: 'text', position: 1 },
  { id: 'text-dev', name: 'dev', type: 'text', position: 2 },
  { id: 'text-aleatorio', name: 'aleatorio', type: 'text', position: 3 },
  { id: 'voice-principal', name: 'sala-principal', type: 'voice', position: 4 },
  { id: 'voice-pareamento', name: 'pareamento', type: 'voice', position: 5 },
  { id: 'voice-jogos', name: 'jogos', type: 'voice', position: 6 },
];

export const mockOnlineUserIds = ['u-you', 'u-ana', 'u-caio', 'u-dani'];

export const mockChannelOccupancy: Record<string, string[]> = {
  'voice-principal': ['u-ana', 'u-caio'],
  'voice-pareamento': [],
  'voice-jogos': ['u-dani'],
};

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function findUser(id: string): SessionUser {
  return mockUsers.find((user) => user.id === id) ?? mockSessionUser;
}

export const mockMessages: Record<string, EphemeralMessage[]> = {
  'text-geral': [
    {
      id: 'm-1',
      channelId: 'text-geral',
      author: findUser('u-ana'),
      body: 'bom dia, subi o coturn no host novo',
      sentAt: minutesAgo(24),
    },
    {
      id: 'm-2',
      channelId: 'text-geral',
      author: findUser('u-caio'),
      body: 'testei aqui, o TURN respondeu de primeira',
      sentAt: minutesAgo(21),
    },
    {
      id: 'm-3',
      channelId: 'text-geral',
      author: findUser('u-dani'),
      body: 'lembrando que o historico some depois de 1h, nao vale como registro',
      sentAt: minutesAgo(12),
    },
  ],
  'text-dev': [
    {
      id: 'm-4',
      channelId: 'text-dev',
      author: findUser('u-caio'),
      body: 'o token do livekit ta expirando junto com a sessao, precisa renovar',
      sentAt: minutesAgo(38),
    },
    {
      id: 'm-5',
      channelId: 'text-dev',
      author: findUser('u-ana'),
      body: 'abro issue no shussei-api',
      sentAt: minutesAgo(35),
    },
  ],
  'text-aleatorio': [
    {
      id: 'm-6',
      channelId: 'text-aleatorio',
      author: findUser('u-edu'),
      body: 'alguem no jogos hoje a noite?',
      sentAt: minutesAgo(90),
    },
  ],
};

/** Ambient chatter for mock mode; see `isMockTrafficEnabled`. */
export const mockChatter: string[] = [
  'subi a branch, da uma olhada quando puder',
  'o coturn caiu de novo? aqui deu timeout',
  'reuniao em 10, alguem entra no sala-principal?',
  'esse ttl de 1h ta curto demais pro meu gosto',
  'consegui reproduzir o bug do token expirando',
  'to compartilhando a tela no jogos',
  'alguem mexeu no compose ontem?',
  'boa, funcionou de primeira aqui',
  'vou almocar, volto em 40',
  'o livekit ta reclamando de codec, ja viram isso?',
];

/**
 * Mock images are inline SVG data URIs, not files on a host: mock mode has to
 * render a real `<img>` with no backend, no `public/` round trip, and no
 * network at all.
 */
function pixelImage(label: string, ink: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">` +
    `<rect width="480" height="300" fill="#0f0b07"/>` +
    `<rect x="10" y="10" width="460" height="280" fill="none" stroke="${ink}" stroke-width="2"/>` +
    `<text x="240" y="158" fill="${ink}" font-family="monospace" font-size="24" ` +
    `text-anchor="middle">${label}</text>` +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export const mockFolders: FolderDto[] = [
  {
    id: 'folder-infra',
    channelId: 'text-geral',
    parentId: null,
    name: 'infra',
    createdByUserId: 'u-ana',
    createdAt: daysAgo(9),
    updatedAt: daysAgo(9),
  },
  {
    id: 'folder-prints',
    channelId: 'text-geral',
    parentId: null,
    name: 'prints',
    createdByUserId: 'u-you',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
  {
    id: 'folder-coturn',
    channelId: 'text-geral',
    parentId: 'folder-infra',
    name: 'coturn',
    createdByUserId: 'u-ana',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: 'folder-vazia',
    channelId: 'text-geral',
    parentId: 'folder-infra',
    name: 'sem-nada',
    createdByUserId: 'u-caio',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: 'folder-dev-specs',
    channelId: 'text-dev',
    parentId: null,
    name: 'specs',
    createdByUserId: 'u-caio',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  },
];

export const mockFiles: StoredFileDto[] = [
  {
    id: 'file-topologia',
    channelId: 'text-geral',
    folderId: null,
    originalName: 'topologia.svg',
    mimeType: 'image/svg+xml',
    sizeBytes: 48_120,
    createdByUserId: 'u-ana',
    createdAt: daysAgo(5),
    downloadUrl: pixelImage('topologia.svg', '#ff9d2f'),
  },
  {
    id: 'file-runbook',
    channelId: 'text-geral',
    folderId: null,
    originalName: 'runbook.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1_284_400,
    createdByUserId: 'u-dani',
    createdAt: daysAgo(2),
    downloadUrl: 'mock://files/runbook.pdf',
  },
  {
    id: 'file-turn-log',
    channelId: 'text-geral',
    folderId: 'folder-coturn',
    originalName: 'turnserver.log',
    mimeType: 'text/plain',
    sizeBytes: 9_640,
    createdByUserId: 'u-ana',
    createdAt: daysAgo(3),
    downloadUrl: 'mock://files/turnserver.log',
  },
  {
    id: 'file-print-dock',
    channelId: 'text-geral',
    folderId: 'folder-prints',
    originalName: 'dock-de-voz.svg',
    mimeType: 'image/svg+xml',
    sizeBytes: 22_800,
    createdByUserId: 'u-you',
    createdAt: daysAgo(4),
    downloadUrl: pixelImage('dock-de-voz', '#ffc46b'),
  },
  {
    id: 'file-print-sala',
    channelId: 'text-geral',
    folderId: 'folder-prints',
    originalName: 'sala-principal.svg',
    mimeType: 'image/svg+xml',
    sizeBytes: 31_450,
    createdByUserId: 'u-caio',
    createdAt: daysAgo(4),
    downloadUrl: pixelImage('sala-principal', '#e0a851'),
  },
  {
    id: 'file-contrato',
    channelId: 'text-dev',
    folderId: 'folder-dev-specs',
    originalName: 'contrato-livekit.json',
    mimeType: 'application/json',
    sizeBytes: 4_210,
    createdByUserId: 'u-caio',
    createdAt: daysAgo(6),
    downloadUrl: 'mock://files/contrato-livekit.json',
  },
];

/** Attachments already sitting in the ephemeral buffer, as the API would replay them. */
export const mockAttachments: Record<string, FileAttachmentDto> = {
  'file-topologia': {
    id: 'file-topologia',
    originalName: 'topologia.svg',
    mimeType: 'image/svg+xml',
    sizeBytes: 48_120,
    downloadUrl: pixelImage('topologia.svg', '#ff9d2f'),
  },
  'file-runbook': {
    id: 'file-runbook',
    originalName: 'runbook.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1_284_400,
    downloadUrl: 'mock://files/runbook.pdf',
  },
};
