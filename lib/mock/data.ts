import type { ChannelDto, EphemeralMessage, SessionUser } from '../types';

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
