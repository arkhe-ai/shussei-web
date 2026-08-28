'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { SessionUser } from '../lib/types';

/**
 * Presence events only carry user ids, so the client needs a directory to
 * render names. `GET /api/v1/users` is not part of the agreed contract yet:
 * until shussei-api ships it the query fails silently and the UI falls back to
 * ids (see README, "Contract gaps"). `isAvailable` lets the UI say so instead
 * of just looking broken.
 */
export function useDirectory(seed: SessionUser[] = []): {
  usersById: Record<string, SessionUser>;
  isAvailable: boolean;
} {
  const query = useQuery({
    queryKey: ['directory'],
    queryFn: async () => {
      const data = await apiFetch<{ users: SessionUser[] }>('/api/v1/users');
      return data.users;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

  const usersById: Record<string, SessionUser> = {};
  for (const user of [...(query.data ?? []), ...seed]) {
    usersById[user.id] = user;
  }

  return { usersById, isAvailable: !query.isError };
}
