import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpriteStrip } from '../../components/sprite-strip';
import type { VoiceParticipant } from '../../lib/types';

const room: VoiceParticipant[] = [
  { id: 'u-ana', name: 'ana', audioLevel: 0.6, isSpeaking: true },
  { id: 'u-caio', name: 'caio', audioLevel: 0 },
  { id: 'u-dani', name: 'dani', audioLevel: 0.9, isMuted: true },
];

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: reduce,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

describe('SpriteStrip', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stays out of the way when the room is empty', () => {
    const { container } = render(<SpriteStrip participants={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('draws one character per person in the room', () => {
    const { container } = render(<SpriteStrip participants={room} channelName="sala" />);

    expect(container.querySelectorAll('svg')).toHaveLength(room.length);
    expect(screen.getByText(/sala/)).toBeInTheDocument();
  });

  it('halts whoever is talking and names them', () => {
    // Silence is motion and speech is stillness: the inversion is what makes
    // the talker findable in a crowd.
    const { container } = render(<SpriteStrip participants={room} />);

    expect(container.querySelectorAll('.sprite-halted')).toHaveLength(1);
    expect(screen.getByText('ana')).toBeInTheDocument();
    expect(screen.queryByText('caio')).not.toBeInTheDocument();
  });

  it('never animates a muted mouth, whatever level came through last', () => {
    const { container } = render(<SpriteStrip participants={[room[2]]} />);

    expect(container.querySelectorAll('.sprite-halted')).toHaveLength(0);
    expect(screen.queryByText('dani')).not.toBeInTheDocument();
  });

  it('spreads everyone out and stops walking under reduced motion', () => {
    // The walk would otherwise collapse to its end state and stack the whole
    // room on the right edge.
    stubReducedMotion(true);
    const { container } = render(<SpriteStrip participants={room} />);

    const walkers = [...container.querySelectorAll('span[style]')].filter((element) =>
      (element.getAttribute('style') ?? '').includes('left'),
    );

    expect(walkers).toHaveLength(room.length);
    expect(container.innerHTML).not.toContain('sprite-walk');
  });

  it('walks each person on their own cycle', () => {
    stubReducedMotion(false);
    const { container } = render(<SpriteStrip participants={room} />);

    const durations = [...container.querySelectorAll('span[style]')]
      .map((element) => (element.getAttribute('style') ?? '').match(/sprite-walk ([0-9.]+)s/)?.[1])
      .filter(Boolean);

    expect(durations).toHaveLength(room.length);
    // Marching in lockstep would read as one animation, not a room of people.
    expect(new Set(durations).size).toBeGreaterThan(1);
  });
});

describe('SpriteStrip anchoring', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('turns the character around without moving it', () => {
    // The travelling track is as wide as the strip. Anchoring the flip to it
    // meant `scaleX(-1)` mirrored a strip-wide box and threw the sprite clean
    // off the right edge on every turn, so it was visible half the time.
    stubReducedMotion(false);
    const { container } = render(<SpriteStrip participants={room} />);

    const flipped = [...container.querySelectorAll('span[style]')].filter((element) =>
      (element.getAttribute('style') ?? '').includes('sprite-face'),
    );

    expect(flipped).toHaveLength(room.length);
    for (const element of flipped) {
      expect(element.className).toContain('w-[22px]');
    }
  });

  it('keeps the name out of the mirrored box', () => {
    stubReducedMotion(false);
    const { container } = render(<SpriteStrip participants={room} />);

    const flipped = [...container.querySelectorAll('span[style]')].find((element) =>
      (element.getAttribute('style') ?? '').includes('sprite-face'),
    );

    // Inside it, the label would render back to front every other lap.
    expect(flipped?.textContent).toBe('');
    expect(screen.getByText('ana')).toBeInTheDocument();
  });

  it('centres the name on the character, not on the strip', () => {
    stubReducedMotion(false);
    const { container } = render(<SpriteStrip participants={room} />);

    const label = screen.getByText('ana');
    const anchor = label.parentElement;

    // `left-1/2 -translate-x-1/2` is only correct if the box it centres in is
    // the character, so the anchor has to carry the sprite's width.
    expect(label.className).toContain('left-1/2');
    expect(anchor?.className).toContain('w-[22px]');
    expect(container.contains(anchor)).toBe(true);
  });
});
