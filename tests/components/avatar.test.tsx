import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../../components/ui/avatar';
import {
  SHEET_COLUMNS,
  SHEET_ROWS,
  SPRITE_PRESETS,
  hopHeightFor,
  presetForSeed,
  presetIndex,
  spriteBackgroundPosition,
} from '../../lib/sprites';

describe('the sheet', () => {
  it('has a character for every cell of the grid', () => {
    expect(SPRITE_PRESETS).toHaveLength(SHEET_COLUMNS * SHEET_ROWS);
  });

  it('gives every character a distinct id', () => {
    expect(new Set(SPRITE_PRESETS.map((preset) => preset.id)).size).toBe(SPRITE_PRESETS.length);
  });

  it('parks the sheet on a different cell for each character', () => {
    const positions = SPRITE_PRESETS.map((_, index) => spriteBackgroundPosition(index));

    expect(new Set(positions).size).toBe(SPRITE_PRESETS.length);
    // First cell is the origin, last one is the far corner.
    expect(positions[0]).toBe('0% 0%');
    expect(positions.at(-1)).toBe('100% 100%');
  });

  it('never runs off the sheet, whatever index it is handed', () => {
    for (const index of [-3, 0, SPRITE_PRESETS.length, SPRITE_PRESETS.length * 7 + 2]) {
      const [x, y] = spriteBackgroundPosition(index).split(' ').map(Number.parseFloat);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it('falls back to the first character for an id it does not know', () => {
    expect(presetIndex('nao-existe')).toBe(0);
  });
});

describe('presetForSeed', () => {
  it('always lands on a real character', () => {
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

describe('hopHeightFor', () => {
  it('keeps a quiet character on the ground', () => {
    expect(hopHeightFor(0, false)).toBe(0);
    expect(hopHeightFor(0.1, false)).toBe(0);
  });

  it('jumps higher the louder it gets', () => {
    // Drawn art cannot open a mouth without a second frame per character, so
    // the jump carries the level instead — a meter, not a badge.
    expect(hopHeightFor(0.3, false)).toBeGreaterThan(0);
    expect(hopHeightFor(0.9, false)).toBeGreaterThan(hopHeightFor(0.3, false));
  });

  it('never moves a muted character, whatever the last level was', () => {
    expect(hopHeightFor(0.9, true)).toBe(0);
  });
});

describe('Avatar', () => {
  it('renders the character from the shared sheet', () => {
    const { container } = render(<Avatar seed="u-ana" name="ana" />);
    const sprite = container.querySelector('[style*="background-image"]');

    expect(sprite?.getAttribute('style')).toContain('/sprites/characters.png');
    expect(sprite?.getAttribute('style')).toContain('background-position');
  });

  it('jumps only above the speaking threshold', () => {
    const { container, rerender } = render(<Avatar seed="u-ana" name="ana" level={0.02} />);
    expect(container.innerHTML).not.toContain('sprite-hop');

    rerender(<Avatar seed="u-ana" name="ana" level={0.7} />);
    expect(container.innerHTML).toContain('sprite-hop');
  });

  it('never jumps a muted participant, whatever the last level was', () => {
    const { container } = render(<Avatar seed="u-ana" name="ana" level={0.9} isMuted />);

    expect(container.innerHTML).not.toContain('sprite-hop');
  });

  it('keeps the name reachable without rendering it', () => {
    const { container } = render(<Avatar seed="u-ana" name="ana" />);

    expect(container.firstElementChild).toHaveAttribute('title', 'ana');
    expect(container.textContent).toBe('');
  });
});
