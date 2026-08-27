import { io, type Socket } from 'socket.io-client';
import { getApiBaseUrl, isMockMode } from './env';
import { createMockSocket } from './mock/mock-socket';

export type SocketHandler = (...args: any[]) => void;

/**
 * The slice of the Socket.IO client surface the app actually uses. Keeping it
 * explicit lets the mock transport stand in for the real one.
 */
export interface AppSocket {
  readonly connected: boolean;
  on(event: string, handler: SocketHandler): void;
  off(event: string, handler?: SocketHandler): void;
  emit(event: string, payload?: unknown): void;
  connect(): void;
  disconnect(): void;
}

let socket: AppSocket | null = null;

export function getAppSocket(): AppSocket {
  if (!socket) {
    socket = isMockMode()
      ? createMockSocket()
      : (io(`${getApiBaseUrl()}/app`, {
          withCredentials: true,
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 500,
          reconnectionDelayMax: 5_000,
        }) as unknown as Socket as unknown as AppSocket);
  }

  return socket;
}

/** Drops the singleton (logout, tests). */
export function resetAppSocket(): void {
  socket?.disconnect();
  socket = null;
}
