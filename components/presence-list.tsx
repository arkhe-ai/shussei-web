'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { ChannelDto, SessionUser } from '../lib/types';

export function PresenceList({
  usersById,
  onlineUserIds,
  channelOccupancy,
  channels,
  currentUserId,
}: {
  usersById: Record<string, SessionUser>;
  onlineUserIds: string[];
  channelOccupancy: Record<string, string[]>;
  channels: ChannelDto[];
  currentUserId?: string;
}) {
  const channelNameById = new Map(channels.map((channel) => [channel.id, channel.name]));
  const voiceChannelByUser = new Map<string, string>();
  for (const [channelId, occupants] of Object.entries(channelOccupancy)) {
    for (const userId of occupants) {
      voiceChannelByUser.set(userId, channelNameById.get(channelId) ?? channelId);
    }
  }

  const offlineIds = Object.keys(usersById).filter((id) => !onlineUserIds.includes(id));

  return (
    <aside
      aria-label="Presenca"
      className="flex h-full min-h-0 w-[190px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-base-900 px-3 py-3"
    >
      <Section title={'online - ' + onlineUserIds.length}>
        {onlineUserIds.length === 0 ? (
          <li className="text-[11px] text-content-muted">ninguem conectado</li>
        ) : null}
        {onlineUserIds.map((userId) => (
          <PresenceRow
            key={userId}
            name={usersById[userId]?.name ?? userId}
            voiceChannel={voiceChannelByUser.get(userId)}
            isSelf={userId === currentUserId}
            isOnline
          />
        ))}
      </Section>

      {offlineIds.length > 0 ? (
        <Section title={'offline - ' + offlineIds.length}>
          {offlineIds.map((userId) => (
            <PresenceRow key={userId} name={usersById[userId]?.name ?? userId} isOnline={false} />
          ))}
        </Section>
      ) : null}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="text-[10px] uppercase tracking-[0.28em] text-content-muted">{title}</h2>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function PresenceRow({
  name,
  voiceChannel,
  isSelf = false,
  isOnline,
}: {
  name: string;
  voiceChannel?: string;
  isSelf?: boolean;
  isOnline: boolean;
}) {
  return (
    <li className="leading-tight">
      <span
        className={clsx('text-[13px]', isOnline ? 'text-content-secondary' : 'text-content-muted')}
      >
        <span className={clsx('mr-1.5', isOnline ? 'text-online glow' : 'text-base-500')}>
          {isOnline ? '●' : '○'}
        </span>
        <span className={clsx('truncate', isSelf && 'text-amber-300')}>{name}</span>
        {isSelf ? <span className="ml-1 text-[10px] text-content-muted">(voce)</span> : null}
      </span>
      {voiceChannel ? (
        <span className="ml-[18px] block text-[10px] text-content-muted">{')) ' + voiceChannel}</span>
      ) : null}
    </li>
  );
}
