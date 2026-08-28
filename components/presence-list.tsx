'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { ChannelDto, SessionUser } from '../lib/types';
import { Avatar } from './ui/avatar';

export function PresenceList({
  usersById,
  onlineUserIds,
  channelOccupancy,
  channels,
  currentUserId,
  isDirectoryAvailable = true,
}: {
  usersById: Record<string, SessionUser>;
  onlineUserIds: string[];
  channelOccupancy: Record<string, string[]>;
  channels: ChannelDto[];
  currentUserId?: string;
  isDirectoryAvailable?: boolean;
}) {
  const channelNameById = new Map(channels.map((channel) => [channel.id, channel.name]));
  const voiceChannelByUser = new Map<string, string>();
  for (const [channelId, occupants] of Object.entries(channelOccupancy)) {
    for (const userId of occupants) {
      voiceChannelByUser.set(userId, channelNameById.get(channelId) ?? channelId);
    }
  }

  /*
   * The roster is everyone we have any evidence of, not just the directory:
   * while `GET /api/v1/users` does not exist the directory holds one entry and
   * an offline section derived from it alone would always be empty. Presence
   * and voice occupancy carry ids we can list even without names.
   */
  const roster = new Set<string>([
    ...Object.keys(usersById),
    ...onlineUserIds,
    ...Object.values(channelOccupancy).flat(),
  ]);

  const online = [...roster].filter((id) => onlineUserIds.includes(id));
  const offline = [...roster].filter((id) => !onlineUserIds.includes(id));

  return (
    <aside
      aria-label="Presenca"
      className="flex h-full min-h-0 w-[190px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-base-900 px-3 py-3"
    >
      <Section title={'online - ' + online.length}>
        {online.length === 0 ? (
          <li className="text-[11px] text-content-muted">ninguem conectado</li>
        ) : null}
        {online.map((userId) => (
          <PresenceRow
            key={userId}
            userId={userId}
            user={usersById[userId]}
            voiceChannel={voiceChannelByUser.get(userId)}
            isSelf={userId === currentUserId}
            isOnline
          />
        ))}
      </Section>

      {offline.length > 0 ? (
        <Section title={'offline - ' + offline.length}>
          {offline.map((userId) => (
            <PresenceRow key={userId} userId={userId} user={usersById[userId]} isOnline={false} />
          ))}
        </Section>
      ) : null}

      {isDirectoryAvailable ? null : (
        <p className="mt-auto text-[10px] leading-snug text-content-muted">
          <span className="text-amber-700">$</span> sem diretório de usuários — a api ainda não
          expõe <span className="text-content-secondary">/api/v1/users</span>, então quem aparece
          por id não tem nome cadastrado aqui
        </p>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="text-[10px] uppercase tracking-[0.28em] text-content-muted">{title}</h2>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function PresenceRow({
  userId,
  user,
  voiceChannel,
  isSelf = false,
  isOnline,
}: {
  userId: string;
  user?: SessionUser;
  voiceChannel?: string;
  isSelf?: boolean;
  isOnline: boolean;
}) {
  const name = user?.name ?? userId;

  return (
    <li className="leading-tight">
      <span className="flex items-center gap-1.5">
        <Avatar seed={userId} name={name} size="sm" isOffline={!isOnline} />
        <span
          className={clsx('mr-0.5 text-[10px]', isOnline ? 'text-online glow' : 'text-base-500')}
        >
          {isOnline ? '●' : '○'}
        </span>
        <span
          className={clsx(
            'min-w-0 flex-1 truncate text-[13px]',
            isOnline ? 'text-content-secondary' : 'text-content-muted',
            isSelf && 'text-amber-300',
          )}
        >
          {name}
        </span>
        {isSelf ? <span className="text-[10px] text-content-muted">(voce)</span> : null}
      </span>
      {voiceChannel ? (
        <span className="ml-[26px] block text-[10px] text-content-muted">
          {')) ' + voiceChannel}
        </span>
      ) : null}
    </li>
  );
}
