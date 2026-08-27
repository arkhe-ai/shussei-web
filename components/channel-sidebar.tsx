'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { ChannelDto, SessionUser } from '../lib/types';
import { Wordmark } from './ui/wordmark';

function displayName(userId: string, usersById: Record<string, SessionUser>): string {
  return usersById[userId]?.name ?? userId;
}

export function ChannelSidebar({
  channels,
  activeChannelId,
  connectedVoiceChannelId = null,
  channelOccupancy,
  usersById,
  isLoading = false,
  onSelect,
}: {
  channels: ChannelDto[];
  activeChannelId: string | null;
  connectedVoiceChannelId?: string | null;
  channelOccupancy: Record<string, string[]>;
  usersById: Record<string, SessionUser>;
  isLoading?: boolean;
  onSelect: (channel: ChannelDto) => void;
}) {
  const textChannels = channels.filter((channel) => channel.type === 'text');
  const voiceChannels = channels.filter((channel) => channel.type === 'voice');

  return (
    <nav
      aria-label="Canais"
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto border-r border-line bg-base-900 px-3 py-3"
    >
      <div className="border-b border-line pb-2">
        <Wordmark variant="inline" />
      </div>

      {isLoading ? (
        <p className="text-[12px] text-content-muted">
          <span className="text-amber-700">$</span> carregando canais
          <span className="animate-caret">_</span>
        </p>
      ) : null}

      <Group title="canais de texto">
        {textChannels.map((channel) => (
          <ChannelItem
            key={channel.id}
            sigil="#"
            label={channel.name}
            isActive={channel.id === activeChannelId}
            onSelect={() => onSelect(channel)}
          />
        ))}
      </Group>

      <Group title="canais de voz">
        {voiceChannels.map((channel) => {
          const occupants = channelOccupancy[channel.id] ?? [];
          const badge =
            channel.id === connectedVoiceChannelId
              ? 'live'
              : occupants.length > 0
                ? String(occupants.length)
                : undefined;

          return (
            <div key={channel.id}>
              <ChannelItem
                sigil="))"
                label={channel.name}
                isActive={channel.id === activeChannelId}
                badge={badge}
                onSelect={() => onSelect(channel)}
              />
              {occupants.length > 0 ? (
                <ul className="mb-1 ml-6 space-y-0.5">
                  {occupants.map((userId) => (
                    <li key={userId} className="truncate text-[11px] text-content-muted">
                      <span className="text-amber-700">-</span> {displayName(userId, usersById)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </Group>
    </nav>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="px-1 text-[10px] uppercase tracking-[0.28em] text-content-muted">{title}</h2>
      <div className="space-y-[2px]">{children}</div>
    </div>
  );
}

function ChannelItem({
  sigil,
  label,
  isActive,
  badge,
  onSelect,
}: {
  sigil: string;
  label: string;
  isActive: boolean;
  badge?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? 'page' : undefined}
      className={clsx(
        'focus-ring flex w-full items-center gap-2 px-2 py-1 text-left text-[13px] transition-colors',
        isActive
          ? 'bg-amber-500 text-content-inverse'
          : 'text-content-secondary hover:bg-base-800 hover:text-amber-300',
      )}
    >
      <span className={clsx('shrink-0 text-[11px]', isActive ? 'opacity-70' : 'text-amber-700')}>
        {sigil}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span
          className={clsx(
            'shrink-0 text-[10px] uppercase tracking-wider',
            isActive ? 'opacity-80' : 'text-content-muted',
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
