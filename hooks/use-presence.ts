'use client';

import { useEffect, useState } from 'react';
import { getAppSocket } from '../lib/socket';
import type { PresenceChange, PresenceSnapshot } from '../lib/types';

export function usePresence(userId: string | null): {
  onlineUserIds: string[];
  channelOccupancy: Record<string, string[]>;
  isConnected: boolean;
} {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>({
    onlineUserIds: [],
    channelOccupancy: {},
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const socket = getAppSocket();

    const identify = () => {
      setIsConnected(true);
      socket.emit('presence.identify', { userId });
    };

    const handleDisconnect = () => setIsConnected(false);

    const handleSnapshot = (payload: PresenceSnapshot) => {
      setSnapshot({
        onlineUserIds: payload.onlineUserIds ?? [],
        channelOccupancy: payload.channelOccupancy ?? {},
      });
    };

    const handleChange = (change: PresenceChange) => {
      setSnapshot((current) => {
        const onlineUserIds = new Set(current.onlineUserIds);
        if (change.status === 'online') {
          onlineUserIds.add(change.userId);
        } else {
          onlineUserIds.delete(change.userId);
        }

        const channelOccupancy: Record<string, string[]> = {};
        for (const [channelId, occupants] of Object.entries(current.channelOccupancy)) {
          channelOccupancy[channelId] = occupants.filter((id) => id !== change.userId);
        }

        if (change.channelId && change.status === 'online') {
          channelOccupancy[change.channelId] = [
            ...(channelOccupancy[change.channelId] ?? []),
            change.userId,
          ];
        }

        return { onlineUserIds: [...onlineUserIds], channelOccupancy };
      });
    };

    if (socket.connected) identify();
    socket.on('connect', identify);
    socket.on('disconnect', handleDisconnect);
    socket.on('presence.snapshot', handleSnapshot);
    socket.on('presence.changed', handleChange);

    return () => {
      socket.off('connect', identify);
      socket.off('disconnect', handleDisconnect);
      socket.off('presence.snapshot', handleSnapshot);
      socket.off('presence.changed', handleChange);
    };
  }, [userId]);

  return { ...snapshot, isConnected };
}
