import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PresenceList } from '../../components/presence-list';
import type { ChannelDto, SessionUser } from '../../lib/types';

const channels: ChannelDto[] = [{ id: 'voice-sala', name: 'sala', type: 'voice', position: 1 }];

const ana: SessionUser = { id: 'u-ana', email: 'a@a.dev', name: 'ana', avatarUrl: null };

describe('PresenceList', () => {
  it('lists people known only from voice occupancy', () => {
    // Until GET /api/v1/users exists the directory holds just the session user,
    // so occupancy is the only evidence these ids exist at all.
    render(
      <PresenceList
        usersById={{ 'u-ana': ana }}
        onlineUserIds={['u-ana', 'u-caio']}
        channelOccupancy={{ 'voice-sala': ['u-caio'] }}
        channels={channels}
      />,
    );

    expect(screen.getByText('ana')).toBeInTheDocument();
    expect(screen.getByText('u-caio')).toBeInTheDocument();
    expect(screen.getByText('online - 2')).toBeInTheDocument();
  });

  it('moves known users who are not online into an offline section', () => {
    render(
      <PresenceList
        usersById={{ 'u-ana': ana }}
        onlineUserIds={[]}
        channelOccupancy={{}}
        channels={channels}
      />,
    );

    expect(screen.getByText('offline - 1')).toBeInTheDocument();
    expect(screen.getByText('ninguem conectado')).toBeInTheDocument();
  });

  it('explains raw ids when the directory endpoint is missing', () => {
    render(
      <PresenceList
        usersById={{}}
        onlineUserIds={['u-caio']}
        channelOccupancy={{}}
        channels={channels}
        isDirectoryAvailable={false}
      />,
    );

    expect(screen.getByText(/\/api\/v1\/users/)).toBeInTheDocument();
  });
});
