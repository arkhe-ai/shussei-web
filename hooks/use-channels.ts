'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { ChannelDto } from '../lib/types';

export function useChannels(): {
  channels: ChannelDto[];
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const data = await apiFetch<{ channels: ChannelDto[] }>('/api/v1/channels');
      return [...data.channels].sort((a, b) => a.position - b.position);
    },
  });

  return {
    channels: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
