'use client';

import { useEffect, useState } from 'react';
import { getAppSocket } from '../lib/socket';
import type { PresenceChange, PresenceSnapshot, SpriteId, UserSprites } from '../lib/types';

export function usePresence(userId: string | null): {
  onlineUserIds: string[];
  channelOccupancy: Record<string, string[]>;
  userSprites: UserSprites;
  isConnected: boolean;
} {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>({
    onlineUserIds: [], channelOccupancy: {}, userSprites: {},
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
    const handleSnapshot = (payload: PresenceSnapshot) => setSnapshot({
      onlineUserIds: payload.onlineUserIds ?? [],
      channelOccupancy: payload.channelOccupancy ?? {},
      userSprites: payload.userSprites ?? {},
    });
    const handleChange = (change: PresenceChange) => {
      setSnapshot((current) => {
        const onlineUserIds = new Set(current.onlineUserIds);
        if (change.status === 'online') onlineUserIds.add(change.userId);
        else onlineUserIds.delete(change.userId);
        const channelOccupancy: Record<string, string[]> = {};
        for (const [id, occupants] of Object.entries(current.channelOccupancy)) {
          channelOccupancy[id] = occupants.filter((id) => id !== change.userId);
        }
        if (change.channelId && change.status === 'online') {
          channelOccupancy[change.channelId] = [...(channelOccupancy[change.channelId] ?? []), change.userId];
        }
        return { ...current, onlineUserIds: [...onlineUserIds], channelOccupancy };
      });
    };
    const handleSpriteChange = (change: { userId: string; spriteId: SpriteId | null }) => {
      setSnapshot((current) => ({ ...current, userSprites: { ...current.userSprites, [change.userId]: change.spriteId } }));
    };
    if (socket.connected) identify();
    socket.on('connect', identify);
    socket.on('disconnect', handleDisconnect);
    socket.on('presence.snapshot', handleSnapshot);
    socket.on('presence.changed', handleChange);
    socket.on('presence.sprite.changed', handleSpriteChange);
    return () => {
      socket.off('connect', identify);
      socket.off('disconnect', handleDisconnect);
      socket.off('presence.snapshot', handleSnapshot);
      socket.off('presence.changed', handleChange);
      socket.off('presence.sprite.changed', handleSpriteChange);
    };
  }, [userId]);

  return { ...snapshot, userSprites: snapshot.userSprites ?? {}, isConnected };
}
