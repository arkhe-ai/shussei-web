'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useChannels } from '../../hooks/use-channels';

/**
 * Landing route after the backend OAuth redirect: sends the user to the first
 * channel it can see, or back to login when there is no session.
 */
export default function ChannelsIndexPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { channels, isLoading: areChannelsLoading } = useChannels();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace('/login');
      return;
    }

    if (areChannelsLoading || channels.length === 0) return;

    const first = channels.find((channel) => channel.type === 'text') ?? channels[0];
    router.replace(`/channels/${first.id}`);
  }, [areChannelsLoading, channels, isAuthLoading, router, user]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-[13px] text-content-muted">
        <span className="text-amber-700">$</span> abrindo canal
        <span className="animate-caret text-amber-500">_</span>
      </p>
    </main>
  );
}
