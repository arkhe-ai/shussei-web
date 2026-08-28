'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { playCue, showMessageNotification } from '../lib/notify';
import { getAppSocket } from '../lib/socket';
import type { EphemeralMessage, PresenceChange } from '../lib/types';

function isTabVisible(): boolean {
  return typeof document === 'undefined' || !document.hidden;
}

/**
 * Everything that counts as "something happened somewhere else": unread badges
 * per channel, the blip, and the desktop notification.
 *
 * This listens to `chat.message` for *every* channel, unlike `useChat` which is
 * scoped to the open one — an unread badge that only worked for the channel you
 * are already reading would be pointless.
 */
export function useChannelActivity({
  activeChannelId,
  currentUserId,
  voiceChannelId,
}: {
  activeChannelId: string | null;
  currentUserId: string | null;
  voiceChannelId: string | null;
}): {
  unreadByChannel: Record<string, number>;
  totalUnread: number;
} {
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});

  // Read inside socket handlers, which are bound once and must not capture a
  // stale channel or user id.
  const activeRef = useRef(activeChannelId);
  const userRef = useRef(currentUserId);
  const voiceRef = useRef(voiceChannelId);
  const voiceByUserRef = useRef<Record<string, string | null>>({});

  activeRef.current = activeChannelId;
  userRef.current = currentUserId;
  voiceRef.current = voiceChannelId;

  const clearChannel = useCallback((channelId: string) => {
    setUnreadByChannel((current) => {
      if (!current[channelId]) return current;
      const next = { ...current };
      delete next[channelId];
      return next;
    });
  }, []);

  // Opening a channel reads it; so does coming back to a tab already on it.
  useEffect(() => {
    if (!activeChannelId) return;

    clearChannel(activeChannelId);

    const handleFocus = () => {
      if (isTabVisible() && activeRef.current) clearChannel(activeRef.current);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [activeChannelId, clearChannel]);

  useEffect(() => {
    if (!currentUserId) return;

    const socket = getAppSocket();

    const handleMessage = (message: EphemeralMessage) => {
      if (message.author.id === userRef.current) return;

      // Already on screen and looking at it: not news.
      if (message.channelId === activeRef.current && isTabVisible()) return;

      setUnreadByChannel((current) => ({
        ...current,
        [message.channelId]: (current[message.channelId] ?? 0) + 1,
      }));

      playCue('message');
      showMessageNotification(`#${message.channelId} · ${message.author.name}`, message.body);
    };

    const handlePresence = (change: PresenceChange) => {
      if (change.userId === userRef.current) return;

      const previous = voiceByUserRef.current[change.userId] ?? null;
      const next = change.status === 'offline' ? null : change.channelId;
      voiceByUserRef.current[change.userId] = next;

      // Only the room you are standing in gets to make noise.
      const myChannel = voiceRef.current;
      if (!myChannel) return;

      if (next === myChannel && previous !== myChannel) {
        playCue('join');
      } else if (previous === myChannel && next !== myChannel) {
        playCue('leave');
      }
    };

    socket.on('chat.message', handleMessage);
    socket.on('presence.changed', handlePresence);

    return () => {
      socket.off('chat.message', handleMessage);
      socket.off('presence.changed', handlePresence);
    };
  }, [currentUserId]);

  const totalUnread = Object.values(unreadByChannel).reduce((sum, count) => sum + count, 0);

  return { unreadByChannel, totalUnread };
}
