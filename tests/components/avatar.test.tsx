import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../../components/ui/avatar';
import { SPRITE_PRESETS, mouthForLevel, presetForSeed, spritePaths } from '../../lib/sprites';

describe('presetForSeed', () => {
  it('always lands on a real preset', () => {
    for (const seed of ['u-ana', 'u-caio', '', 'ç', 'u-'.repeat(40)]) {
      expect(SPRITE_PRESETS.some((preset) => preset.id === presetForSeed(seed))).toBe(true);
    }
  });

  it('gives the same person the same character every time', () => {
    // No storage involved: everyone but you is derived from their user id.
    expect(presetForSeed('u-ana')).toBe(presetForSeed('u-ana'));
    expect(presetForSeed('u-ana')).not.toBe(presetForSeed('u-ana-2'));
  });
});

describe('mouthForLevel', () => {
  it('keeps the mouth shut below the speaking threshold', () => {
    expect(mouthForLevel(0, false)).toBe('closed');
    expect(mouthForLevel(0.1, false)).toBe('closed');
  });

  it('opens with loudness', () => {
    expect(mouthForLevel(0.2, false)).toBe('open');
    expect(mouthForLevel(0.9, false)).toBe('wide');
  });

  it('never moves a muted mouth, whatever the last level was', () => {
    expect(mouthForLevel(0.9, true)).toBe('closed');
  });
});

describe('spritePaths', () => {
  it('draws every shade', () => {
    const paths = spritePaths('curto', 'open', 'together');

    expect(paths['1'].length).toBeGreaterThan(0);
    expect(paths['2'].length).toBeGreaterThan(0);
    expect(paths['3'].length).toBeGreaterThan(0);
  });

  it('merges horizontal runs instead of emitting a box per pixel', () => {
    // A 12x14 grid drawn one box per pixel puts ~100 nodes per person on
    // screen, and the voice strip can hold forty of them.
    const paths = spritePaths('curto', 'closed', 'together');

    for (const shade of ['1', '2', '3'] as const) {
      const boxes = (paths[shade].match(/M/g) ?? []).length;
      const pixels = [...paths[shade].matchAll(/h([0-9]+)v1/g)].reduce(
        (total, match) => total + Number(match[1]),
        0,
      );

      expect(pixels).toBeGreaterThan(0);
      expect(boxes).toBeLessThan(pixels);
    }
  });

  it('returns the identical object for a repeated frame', () => {
    expect(spritePaths('curto', 'open', 'apart')).toBe(spritePaths('curto', 'open', 'apart'));
  });
});

describe('Avatar', () => {
  it('renders a sprite', () => {
    const { container } = render(<Avatar seed="u-ana" name="ana" />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelectorAll('path').length).toBe(3);
  });

  it('rings only above the noise threshold', () => {
    const { container, rerender } = render(<Avatar seed="u-ana" name="ana" level={0.02} />);
    expect(container.firstElementChild?.getAttribute('style')).toBeNull();

    rerender(<Avatar seed="u-ana" name="ana" level={0.7} />);
    expect(container.firstElementChild?.getAttribute('style')).toContain('box-shadow');
  });

  it('never rings a muted participant, whatever the last level was', () => {
    const { container } = render(<Avatar seed="u-ana" name="ana" level={0.9} isMuted />);

    expect(container.firstElementChild?.getAttribute('style')).toBeNull();
  });

  it('keeps the name reachable without rendering it', () => {
    const { container } = render(<Avatar seed="u-ana" name="ana" />);

    expect(container.firstElementChild).toHaveAttribute('title', 'ana');
    expect(container.textContent).toBe('');
  });
});
