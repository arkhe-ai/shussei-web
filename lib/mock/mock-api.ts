import type { ChannelDto, EphemeralMessage, SessionUser, VoiceTokenResponse } from '../types';
import { mockChannels, mockMessages, mockSessionUser, mockUsers } from './data';

/**
 * In-memory stand-in for the REST surface of `shussei-api`, used when
 * NEXT_PUBLIC_MOCK=1. Kept deliberately dumb: same paths, same payload shapes.
 */
const buffers: Record<string, EphemeralMessage[]> = structuredClone(mockMessages);

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function getMockBuffer(channelId: string): EphemeralMessage[] {
  buffers[channelId] ??= [];
  return buffers[channelId];
}

export function pushMockMessage(message: EphemeralMessage): void {
  const buffer = getMockBuffer(message.channelId);
  buffer.push(message);
  // Mirrors the Redis retention target from the spec: last 100 per channel.
  if (buffer.length > 100) {
    buffer.splice(0, buffer.length - 100);
  }
}

export async function mockApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const [pathname] = path.split('?');

  if (pathname === '/api/v1/health') {
    return delay({ status: 'ok' } as T);
  }

  if (pathname === '/api/v1/auth/me') {
    if ((init?.method ?? 'GET').toUpperCase() === 'PATCH') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { spriteId?: SessionUser['spriteId'] };
      mockSessionUser.spriteId = body.spriteId ?? null;
    }
    return delay({ user: mockSessionUser satisfies SessionUser } as T);
  }

  if (pathname === '/api/v1/users') {
    return delay({ users: mockUsers } as T);
  }

  if (pathname === '/api/v1/channels') {
    return delay({ channels: mockChannels satisfies ChannelDto[] } as T);
  }

  const messagesMatch = pathname.match(/^\/api\/v1\/channels\/([^/]+)\/messages$/);
  if (messagesMatch) {
    return delay({ messages: [...getMockBuffer(messagesMatch[1])] } as T);
  }

  const voiceTokenMatch = pathname.match(/^\/api\/v1\/channels\/([^/]+)\/voice-token$/);
  if (voiceTokenMatch && (init?.method ?? 'GET').toUpperCase() === 'POST') {
    return delay({
      token: 'mock-token',
      roomName: voiceTokenMatch[1],
      wsUrl: 'mock://livekit',
    } satisfies VoiceTokenResponse as T);
  }

  throw new Error(`mock_api_unhandled:${path}`);
}
