'use client';

import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '../lib/auth';
import type { SessionUser } from '../lib/types';

export function useAuth(): {
  user: SessionUser | null;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
