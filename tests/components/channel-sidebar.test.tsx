import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChannelSidebar } from '../../components/channel-sidebar';
import type { ChannelDto } from '../../lib/types';

const channels: ChannelDto[] = [
  { id: 'text-geral', name: 'geral', type: 'text', position: 1 },
  { id: 'text-dev', name: 'dev', type: 'text', position: 2 },
  { id: 'voice-sala', name: 'sala', type: 'voice', position: 3 },
];

function renderSidebar(props: Partial<Parameters<typeof ChannelSidebar>[0]> = {}) {
  return render(
    <ChannelSidebar
      channels={channels}
      activeChannelId="text-geral"
      channelOccupancy={{}}
      usersById={{}}
      onSelect={vi.fn()}
      {...props}
    />,
  );
}

describe('ChannelSidebar', () => {
  it('badges channels with unread messages', () => {
    renderSidebar({ unreadByChannel: { 'text-dev': 4 } });

    expect(screen.getByRole('button', { name: /dev, 4 nao lidas/i })).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('never badges the channel already on screen', () => {
    // The count can be non-zero for a moment: a message can land between the
    // socket event and the effect that clears the open channel.
    renderSidebar({ unreadByChannel: { 'text-geral': 2 } });

    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('caps the badge so a long absence cannot stretch the row', () => {
    renderSidebar({ unreadByChannel: { 'text-dev': 240 } });

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('selects a channel on click', () => {
    const onSelect = vi.fn();
    renderSidebar({ onSelect });

    fireEvent.click(screen.getByRole('button', { name: /# dev/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'text-dev' }));
  });
});
