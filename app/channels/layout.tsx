'use client';

import { useParams, useSelectedLayoutSegments } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '../../components/app-shell';

/**
 * The shell lives in the layout rather than in `[channelId]/page.tsx`.
 *
 * App Router remounts a page when its dynamic segment changes, so keeping the
 * shell there tore down the LiveKit room on every channel click — the voice
 * dock is built on the room surviving exactly that navigation. A layout
 * persists across sibling segments and simply re-renders with the new param.
 *
 * The same reasoning decides how `/channels/:id/files` is reached. It is a real
 * URL, so it deep-links and the back button works, but rendering it as a
 * sibling page would remount this shell and drop the call. Instead the layout
 * reads which segment is active and the shell swaps its main pane, leaving the
 * sidebar, the dock and the room untouched. That is also why `children` is
 * discarded below: every segment under `[channelId]` renders through the shell.
 */
export default function ChannelsLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ channelId?: string }>();
  const segments = useSelectedLayoutSegments();
  const channelId = params?.channelId;

  // `/channels` itself has no id; that route only redirects to the first one.
  if (!channelId) return <>{children}</>;

  // ['<channelId>'] for the chat, ['<channelId>', 'files'] for the browser.
  return <AppShell initialChannelId={channelId} view={segments[1] === 'files' ? 'files' : 'chat'} />;
}
