import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoomAudio } from '../../components/room-audio';
import type { MediaFeed } from '../../lib/livekit';

function makeFeed(id: string, participantId: string): MediaFeed {
  return {
    id,
    participantId,
    participantName: participantId,
    isLocal: false,
    attach: vi.fn(),
    detach: vi.fn(),
  };
}

describe('RoomAudio', () => {
  it('plays one element per remote feed', () => {
    const { container } = render(
      <RoomAudio feeds={[makeFeed('t1', 'u-ana'), makeFeed('t2', 'u-caio')]} />,
    );

    // LiveKit hands over remote tracks but does not play them.
    expect(container.querySelectorAll('audio')).toHaveLength(2);
  });

  it('does not re-attach a track just because a new wrapper object arrived', () => {
    // Re-attaching a live audio track produces an audible gap, and the room
    // sync mints fresh MediaFeed objects on every event.
    const first = makeFeed('t1', 'u-ana');
    const { rerender } = render(<RoomAudio feeds={[first]} />);

    expect(first.attach).toHaveBeenCalledTimes(1);

    const sameTrackNewObject = makeFeed('t1', 'u-ana');
    rerender(<RoomAudio feeds={[sameTrackNewObject]} />);

    expect(first.detach).not.toHaveBeenCalled();
    expect(sameTrackNewObject.attach).not.toHaveBeenCalled();
  });

  it('applies per-participant volume', () => {
    const { container } = render(
      <RoomAudio feeds={[makeFeed('t1', 'u-ana')]} volumes={{ 'u-ana': 0.4 }} />,
    );

    expect(container.querySelector('audio')?.volume).toBeCloseTo(0.4);
  });

  it('mutes everyone while deafened, without dropping the tracks', () => {
    const feed = makeFeed('t1', 'u-ana');
    const { container, rerender } = render(<RoomAudio feeds={[feed]} isDeafened />);

    expect(container.querySelector('audio')?.muted).toBe(true);

    // Undeafening has to be instant, so the track was never unsubscribed.
    rerender(<RoomAudio feeds={[feed]} isDeafened={false} />);

    expect(container.querySelector('audio')?.muted).toBe(false);
    expect(feed.detach).not.toHaveBeenCalled();
  });
});
