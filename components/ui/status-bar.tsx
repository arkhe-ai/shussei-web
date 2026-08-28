'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { buildLogoutUrl } from '../../lib/auth';
import { resetAppSocket } from '../../lib/socket';
import { LiveDot } from './live-dot';
import { SoundToggle } from './sound-toggle';
import { SpritePicker } from './sprite-picker';

export function StatusBar({
  hints,
  userName,
  isConnected,
}: {
  hints: ReactNode;
  userName?: string;
  isConnected: boolean;
}) {
  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-base-950 px-3 py-1.5">
      {hints}
      <span className="ml-auto flex items-center gap-3">
        <SpritePicker />
        <SoundToggle />
        {userName ? <span className="text-[11px] text-content-secondary">@{userName}</span> : null}
        <a
          href={buildLogoutUrl()}
          // The socket is a module singleton: without dropping it, a login as
          // someone else on the same tab would keep identifying as this user.
          onClick={() => resetAppSocket()}
          className="focus-ring text-[11px] text-content-muted transition-colors hover:text-danger-500"
        >
          [sair]
        </a>
        <span
          className={clsx(
            'flex items-center gap-1.5 text-[11px]',
            isConnected ? 'text-online' : 'text-danger-500',
          )}
        >
          {/* A steady dot means connected; the blink means it is still trying. */}
          <LiveDot
            active={!isConnected}
            filled={isConnected}
            tone={isConnected ? 'online' : 'danger'}
          />
          {isConnected ? 'conectado' : 'reconectando'}
        </span>
      </span>
    </footer>
  );
}
