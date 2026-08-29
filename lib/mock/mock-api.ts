import type { ChannelDto, EphemeralMessage, SessionUser, VoiceTokenResponse } from '../types';
import { mockChannels, mockMessages, mockSessionUser, mockUsers } from './data';
import * as store from './mock-files';

/**
 * In-memory stand-in for the REST surface of `shussei-api`, used when
 * NEXT_PUBLIC_MOCK=1. Kept deliberately dumb: same paths, same payload shapes.
 *
 * Uploads are the one exception — they need progress, so they go through
 * `lib/upload.ts` and `mock-upload.ts` rather than through here.
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

/** The contract spells the channel root as the literal `null` on the wire. */
function scopeFrom(query: string, name: 'parentId' | 'folderId'): string | null {
  const value = new URLSearchParams(query).get(name);
  return value === null || value === 'null' ? null : value;
}

function method(init?: RequestInit): string {
  return (init?.method ?? 'GET').toUpperCase();
}

function body<T>(init?: RequestInit): T {
  return JSON.parse(String(init?.body ?? '{}')) as T;
}

/**
 * Wrapped rather than returned bare, because a successful `DELETE` resolves to
 * `undefined` and that is a real answer here — not "no route matched".
 */
type Handled<T> = { value: T };

async function handleFiles<T>(
  pathname: string,
  query: string,
  init: RequestInit | undefined,
): Promise<Handled<T> | null> {
  const verb = method(init);

  const channelFolders = pathname.match(/^\/api\/v1\/channels\/([^/]+)\/folders$/);
  if (channelFolders) {
    const channelId = decodeURIComponent(channelFolders[1]);

    if (verb === 'POST') {
      const input = body<{ parentId: string | null; name: string }>(init);
      return {
        value: await delay({
          folder: store.createFolder(channelId, input.parentId, input.name, mockSessionUser.id),
        } as T),
      };
    }

    return {
      value: await delay({
        folders: store.listFolders(channelId, scopeFrom(query, 'parentId')),
      } as T),
    };
  }

  const channelFiles = pathname.match(/^\/api\/v1\/channels\/([^/]+)\/files$/);
  if (channelFiles && verb === 'GET') {
    const channelId = decodeURIComponent(channelFiles[1]);
    return {
      value: await delay({ files: store.listFiles(channelId, scopeFrom(query, 'folderId')) } as T),
    };
  }

  const breadcrumbs = pathname.match(/^\/api\/v1\/folders\/([^/]+)\/breadcrumbs$/);
  if (breadcrumbs) {
    return {
      value: await delay({
        breadcrumbs: store.getBreadcrumbs(decodeURIComponent(breadcrumbs[1])),
      } as T),
    };
  }

  const folder = pathname.match(/^\/api\/v1\/folders\/([^/]+)$/);
  if (folder) {
    const folderId = decodeURIComponent(folder[1]);

    if (verb === 'PATCH') {
      return { value: await delay({ folder: store.updateFolder(folderId, body(init)) } as T) };
    }
    if (verb === 'DELETE') {
      store.deleteFolder(folderId);
      return { value: await delay(undefined as T) };
    }

    return { value: await delay({ folder: store.getFolder(folderId) } as T) };
  }

  const file = pathname.match(/^\/api\/v1\/files\/([^/]+)$/);
  if (file) {
    const fileId = decodeURIComponent(file[1]);

    if (verb === 'PATCH') {
      return { value: await delay({ file: store.updateFile(fileId, body(init)) } as T) };
    }
    if (verb === 'DELETE') {
      store.deleteFile(fileId);
      return { value: await delay(undefined as T) };
    }

    return { value: await delay({ file: store.getFile(fileId) } as T) };
  }

  return null;
}

export async function mockApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const [pathname, query = ''] = path.split('?');

  if (pathname === '/api/v1/health') {
    return delay({ status: 'ok' } as T);
  }

  if (pathname === '/api/v1/auth/me') {
    if (method(init) === 'PATCH') {
      const patch = body<{ spriteId?: SessionUser['spriteId'] }>(init);
      mockSessionUser.spriteId = patch.spriteId ?? null;
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
  if (voiceTokenMatch && method(init) === 'POST') {
    return delay({
      token: 'mock-token',
      roomName: voiceTokenMatch[1],
      wsUrl: 'mock://livekit',
    } satisfies VoiceTokenResponse as T);
  }

  // Raises the same `ApiError` statuses the real API would for a conflict, a
  // missing folder or an invalid name, so the UI's error states are reachable.
  const handled = await handleFiles<T>(pathname, query, init);
  if (handled) return handled.value;

  throw new Error(`mock_api_unhandled:${path}`);
}
