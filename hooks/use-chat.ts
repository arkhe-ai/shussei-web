'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { getAppSocket } from '../lib/socket';
import type { EphemeralMessage } from '../lib/types';

function appendUnique(current: EphemeralMessage[], incoming: EphemeralMessage): EphemeralMessage[] {
  if (current.some((message) => message.id === incoming.id)) {
    return current;
  }

  return [...current, incoming];
}

/** `channelId` is nullable so voice channels can mount the hook without fetching. */
export function useChat(channelId: string | null): {
  messages: EphemeralMessage[];
  isLoading: boolean;
  sendMessage: (body: string, fileIds?: string[]) => void;
} {
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setMessages([]);

    if (!channelId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    apiFetch<{ messages: EphemeralMessage[] }>(`/api/v1/channels/${channelId}/messages`)
      .then((data) => {
        if (!active) return;
        setMessages(data.messages);
      })
      .catch(() => {
        // Ephemeral buffer may simply be empty or expired; the channel still works.
        if (!active) return;
        setMessages([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const socket = getAppSocket();

    const handleMessage = (message: EphemeralMessage) => {
      if (message.channelId !== channelId) return;
      setMessages((current) => appendUnique(current, message));
    };

    const handleRecent = (payload: { channelId: string; messages: EphemeralMessage[] }) => {
      if (payload.channelId !== channelId) return;
      setMessages(payload.messages);
    };

    socket.on('chat.message', handleMessage);
    socket.on('chat.recent', handleRecent);

    return () => {
      active = false;
      socket.off('chat.message', handleMessage);
      socket.off('chat.recent', handleRecent);
    };
  }, [channelId]);

  /*
   * Attachments travel as ids the backend already stored. The socket never
   * carries bytes, Base64 or a client URL, and `fileIds` is omitted entirely
   * for a plain message so the existing text-only payload is unchanged.
   */
  const sendMessage = useCallback(
    (body: string, fileIds?: string[]) => {
      if (!channelId) return;
      getAppSocket().emit('chat.send', {
        channelId,
        body,
        ...(fileIds && fileIds.length > 0 ? { fileIds } : {}),
      });
    },
    [channelId],
  );

  return useMemo(
    () => ({ messages, isLoading, sendMessage }),
    [messages, isLoading, sendMessage],
  );
}
