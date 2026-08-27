import type { AppSocket, SocketHandler } from '../socket';
import type { EphemeralMessage } from '../types';
import { mockChannelOccupancy, mockOnlineUserIds, mockSessionUser } from './data';
import { getMockBuffer, pushMockMessage } from './mock-api';

/**
 * Socket.IO stand-in for NEXT_PUBLIC_MOCK=1. Same event names and payload
 * shapes as the `/app` namespace described in the backend contract.
 */
export function createMockSocket(): AppSocket {
  const handlers = new Map<string, Set<SocketHandler>>();
  const occupancy: Record<string, string[]> = structuredClone(mockChannelOccupancy);
  const online = new Set(mockOnlineUserIds);
  let connected = false;

  function dispatch(event: string, payload?: unknown) {
    handlers.get(event)?.forEach((handler) => handler(payload));
  }

  function snapshot() {
    dispatch('presence.snapshot', {
      onlineUserIds: [...online],
      channelOccupancy: structuredClone(occupancy),
    });
  }

  function open() {
    if (connected) return;
    setTimeout(() => {
      connected = true;
      dispatch('connect');
      snapshot();
    }, 150);
  }

  open();

  return {
    get connected() {
      return connected;
    },
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      // A listener attached after the fake handshake still needs the snapshot.
      if (event === 'presence.snapshot' && connected) {
        setTimeout(snapshot, 0);
      }
      if (event === 'connect' && connected) {
        setTimeout(() => handler(), 0);
      }
    },
    off(event, handler) {
      if (!handler) {
        handlers.delete(event);
        return;
      }
      handlers.get(event)?.delete(handler);
    },
    emit(event, payload) {
      if (event === 'chat.send') {
        const { channelId, body } = payload as { channelId: string; body: string };
        const message: EphemeralMessage = {
          id: `m-${Math.random().toString(36).slice(2, 10)}`,
          channelId,
          author: mockSessionUser,
          body,
          sentAt: new Date().toISOString(),
        };
        pushMockMessage(message);
        setTimeout(() => dispatch('chat.message', message), 60);
        return;
      }

      if (event === 'voice.join') {
        const { channelId } = payload as { channelId: string };
        occupancy[channelId] = [...new Set([...(occupancy[channelId] ?? []), mockSessionUser.id])];
        setTimeout(
          () =>
            dispatch('presence.changed', {
              userId: mockSessionUser.id,
              status: 'online',
              channelId,
            }),
          40,
        );
        return;
      }

      if (event === 'voice.leave') {
        const { channelId } = payload as { channelId: string };
        occupancy[channelId] = (occupancy[channelId] ?? []).filter((id) => id !== mockSessionUser.id);
        setTimeout(
          () =>
            dispatch('presence.changed', {
              userId: mockSessionUser.id,
              status: 'online',
              channelId: null,
            }),
          40,
        );
        return;
      }

      if (event === 'chat.recent.request') {
        const { channelId } = payload as { channelId: string };
        setTimeout(
          () => dispatch('chat.recent', { channelId, messages: [...getMockBuffer(channelId)] }),
          40,
        );
      }
    },
    connect() {
      open();
    },
    disconnect() {
      connected = false;
      dispatch('disconnect', 'io client disconnect');
    },
  };
}
