'use client';

import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '../../components/app-shell';

/**
 * The shell lives in the layout rather than in `[channelId]/page.tsx`.
 *
 * App Router remounts a page when its dynamic segment changes, so keeping the
 * shell there tore down the LiveKit room on every channel click — the voice
 * dock is built on the room surviving exactly that navigation. A layout
 * persists across sibling segments and simply re-renders with the new param.
 */
export default function ChannelsLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ channelId?: string }>();
  const channelId = params?.channelId;

  // `/channels` itself has no id; that route only redirects to the first one.
  if (!channelId) return <>{children}</>;

  return <AppShell initialChannelId={channelId} />;
}
